# ALNScanner Frontend - Comprehensive Screen Flow & Architecture Document

## Executive Summary

ALNScanner is a Progressive Web App (PWA) for Game Masters to scan NFC/RFID tokens during "About Last Night" immersive gameplay. The application supports two distinct operational modes:

- **Networked Mode**: Real-time synchronization with backend orchestrator via WebSocket
- **Standalone Mode**: Fully offline operation with local-only data storage

Mode selection happens at startup and is **locked** for the duration of the game session, preventing mid-game mode switching.

---

## Part 1: Application Architecture Overview

### Technology Stack
- **Entry Point**: Single HTML file (`index.html`, 2117 lines)
- **No Build Process**: Pure HTML/CSS/JavaScript
- **Inline Styles**: CSS embedded in `<style>` tags
- **Module System**: Sequential `<script>` tags with global window object exposure
- **WebSocket**: Socket.io v4 client library for networked mode
- **NFC API**: Web NFC API (Android Chrome/Edge 89+)
- **Storage**: localStorage for persistence, Cache API for offline

### File Structure
```
ALNScanner/
├── index.html                               # Main PWA entry point (2117 lines)
├── sw.js                                    # Service worker (offline support)
├── js/
│   ├── app/
│   │   ├── app.js                           # Main coordinator (1137 lines)
│   │   ├── sessionModeManager.js            # Mode selection & locking (100 lines)
│   │   └── initializationSteps.js           # 11-phase startup sequence (200+ lines)
│   ├── core/
│   │   ├── dataManager.js                   # Transaction & scoring logic
│   │   ├── standaloneDataManager.js         # Offline-only mode
│   │   └── tokenManager.js                  # Token database & matching
│   ├── network/
│   │   ├── orchestratorClient.js            # WebSocket client (400+ lines)
│   │   ├── connectionManager.js             # Connection state management
│   │   └── networkedQueueManager.js         # Offline transaction queue
│   ├── ui/
│   │   ├── uiManager.js                     # Screen navigation (687 lines)
│   │   └── settings.js                      # Configuration persistence
│   └── utils/
│       ├── adminModule.js                   # Admin panel (Session/Video/System)
│       ├── config.js                        # Constants
│       ├── debug.js                         # Logging utilities
│       └── nfcHandler.js                    # Web NFC API wrapper
└── data/                                    # [Git submodule → ALN-TokenData]
    └── tokens.json                          # Shared token database
```

### Module Loading Order
```
index.html loads:
1. js/utils/config.js              # Configuration constants
2. js/utils/debug.js               # Debug logging
3. js/utils/nfcHandler.js          # NFC API wrapper
4. js/utils/adminModule.js         # Admin panel components
5. js/core/tokenManager.js         # Token database
6. js/core/dataManager.js          # Transaction management
7. js/core/standaloneDataManager.js  # Offline mode
8. js/ui/uiManager.js              # Screen navigation
9. js/ui/settings.js               # Configuration
10. js/network/connectionManager.js # Connection state
11. js/network/networkedQueueManager.js # Transaction queue
12. js/network/orchestratorClient.js # WebSocket client
13. js/app/sessionModeManager.js    # Mode selection
14. js/app/initializationSteps.js   # Startup phases
15. js/app/app.js                   # Main coordinator
16. Socket.io client library        # WebSocket support
17. Inline initialization script    # DOMContentLoaded handler
```

---

## Part 2: Initialization Flow (Startup Sequence)

### DOMContentLoaded Event Handler (index.html:1862-1882)

```
Window Load
    ↓
[1] App.init() → InitializationSteps.*()
    ├─ Phase 1D: InitializeUIManager()
    ├─ Phase 0: ShowLoadingScreen()
    ├─ Phase 1E: CreateSessionModeManager()
    ├─ Phase 1F: InitializeViewController()
    ├─ Phase 1G: LoadSettings()
    ├─ Phase 1H: LoadDataManager()
    ├─ Phase 1I: DetectNFCSupport()
    ├─ Phase 1A: LoadTokenDatabase()
    ├─ Phase 1B: ApplyURLModeOverride()
    ├─ Phase 1J: RegisterServiceWorker()
    └─ Phase 1C: DetermineInitialScreen()
        ├─ Check for saved mode
        ├─ Check connection readiness
        └─ Apply initial screen decision
    ↓
[2] ConnectionManager Initialize & Migratehistory()
    └─ LoadLocalStorage → Restore previous connection
    ↓
[3] ConnectionManager.connect() (non-blocking)
    └─ [100ms delay for UI render]
```

### Initialization Phase Details

**Phase 1D: UIManager Initialization**
- Register all screen elements from DOM
- Initialize error display container
- Set up screen visibility system

**Phase 0: Loading Screen**
- Display "Loading token database..." message
- Show spinning icon

**Phase 1E: SessionModeManager Creation**
- Create mode manager instance
- Check localStorage for saved session mode
- Restore previous mode if available

**Phase 1F: ViewController Initialization**
- Initialize view tabs system
- Set up admin/debug views (only in networked mode)
- Configure scanner view as default

**Phase 1G: Settings Loading**
- Load device ID from localStorage
- Load game mode (detective/blackmarket) from localStorage
- Load station name from localStorage

**Phase 1H: DataManager Loading**
- Load transactions array from localStorage
- Load scannedTokens Set (for duplicate detection)
- Update history badge count

**Phase 1I: NFC Support Detection**
- Check if `NDEFReader` available in window
- Log support status (Android Chrome/Edge required)

**Phase 1A: Token Database Loading**
- Load `data/tokens.json` asynchronously
- Parse and validate token structure
- Fail visibly if loading fails

**Phase 1B: URL Mode Override**
- Check for `?mode=blackmarket` or `?mode=black-market` query parameter
- Override Settings.mode if present

**Phase 1J: Service Worker Registration**
- Register `sw.js` for offline PWA support
- Cache assets for offline access

**Phase 1C: Initial Screen Determination**
```
DetermineInitialScreen(sessionModeManager)
├─ If mode saved and connection ready
│   └─ Show TeamEntryScreen (resume game)
├─ If mode saved but connection not ready (networked)
│   └─ Show ConnectionWizard (reconnect)
└─ If no mode saved
    └─ Show GameModeScreen (initial choice)
```

---

## Part 3: Complete Screen Inventory & Navigation

### Screen Hierarchy

```
App Container (index.html)
├── Connection Wizard Modal (Fixed overlay)
│   └── Hidden by default
│       Shown by: showConnectionWizard()
│       Hidden by: handleConnectionSubmit() or cancelNetworkedMode()
│
└── Main Container (Screens + Views)
    ├── Header
    │   ├── Connection Status Indicator
    │   ├── History Button (🗂)
    │   ├── Scoreboard Button (🏆) [Black Market mode only]
    │   ├── Settings Button (⚙️)
    │   ├── Mode Indicator (Detective/Black Market)
    │   └── Device ID Display
    │
    ├── View Selector Tabs (Networked mode only)
    │   ├── Scanner View Tab (📱)
    │   ├── Admin View Tab (⚙️)
    │   └── Debug View Tab (🐛)
    │
    ├── Scanner View (Default)
    │   ├── Loading Screen
    │   ├── Game Mode Selection Screen
    │   ├── Settings Screen
    │   ├── Team Entry Screen
    │   ├── Scan Screen
    │   ├── Result Screen
    │   ├── History Screen (Overlay)
    │   ├── Scoreboard Screen (Overlay)
    │   └── Team Details Screen (Overlay)
    │
    ├── Admin View (Networked mode only)
    │   ├── Session Management Panel
    │   ├── Video Controls Panel
    │   ├── System Status Panel
    │   ├── Team Scores Panel
    │   └── Recent Transactions Panel
    │
    └── Debug View (Networked mode only)
        └── Real-time Debug Console
```

### Screen: Loading Screen

**ID**: `loadingScreen`
**Purpose**: Show initial loading state while token database loads
**Visual**: Loading icon + "Loading token database..." message
**CSS Class**: `.screen` → Active on startup
**DOM Structure** (index.html:1463-1468):
```html
<div id="loadingScreen" class="screen">
    <div class="status-message">
        <div class="scan-icon">⏳</div>
        <p>Loading token database...</p>
    </div>
</div>
```

**Show Conditions**:
- During Phase 0 of initialization
- Before Settings screen or Game Mode screen

**Navigation**:
- **To**: Game Mode Screen (if new session) OR Team Entry Screen (if resuming)
- **Hidden When**: Token database loads successfully

**State Management**:
- No local state
- Waits for TokenManager.loadDatabase() promise

**Key Components**:
- Loading icon (⏳) - animated
- Status message text
- No user interaction

---

### Screen: Game Mode Selection Screen

**ID**: `gameModeScreen`
**Purpose**: Initial choice between networked and standalone modes
**Visual**: Two large button cards (🌐 Networked, 📱 Standalone)
**CSS Class**: `.screen`
**DOM Structure** (index.html:1508-1551):
```html
<div id="gameModeScreen" class="screen">
    <div class="mode-selection">
        <h2>How are you playing today?</h2>
        <!-- Two mode buttons with icons and descriptions -->
    </div>
</div>
```

**Show Conditions**:
- No previous game session detected
- On page load if localStorage.gameSessionMode is empty
- After `cancelNetworkedMode()` returns from connection wizard

**Navigation**:
- **Networked Mode Button**: 
  - Calls `App.selectGameMode('networked')`
  - Shows Connection Wizard Modal
  - **To**: Team Entry Screen (after successful connection)
- **Standalone Mode Button**:
  - Calls `App.selectGameMode('standalone')`
  - **To**: Team Entry Screen (immediate)

**State Management**:
- SessionModeManager.setMode() locks mode selection
- Saves to localStorage.gameSessionMode
- Initializes appropriate connection logic

**Key Components**:
- Mode selection buttons with hover effects
- Icon cards (🌐, 📱)
- Description text for each mode

**User Interactions**:
- Click "Networked Game" → Connection wizard
- Click "Standalone Game" → Team entry screen

---

### Screen: Settings Screen

**ID**: `settingsScreen`
**Purpose**: Configure station before gameplay starts
**Visual**: Input fields for Device ID, Mode toggle, data management buttons
**CSS Class**: `.screen`
**DOM Structure** (index.html:1471-1505):
```html
<div id="settingsScreen" class="screen">
    <div class="settings-panel">
        <!-- Device ID input -->
        <!-- Mode toggle switch -->
        <!-- Save button -->
    </div>
    <!-- Data Management section -->
</div>
```

**Show Conditions**:
- Accessed via Settings button (⚙️) in header
- Can be opened at any time from main UI

**Navigation**:
- **Save Button**: Returns to previous screen (typically Team Entry)
- **Back**: Uses UIManager.previousScreen navigation

**State Management**:
- Device ID: localStorage via Settings.deviceId
- Mode: localStorage via Settings.mode (toggles detective/blackmarket)
- Toggle switch shows current mode

**Key Components**:
- Device ID input field (text)
- Mode toggle switch (detective ↔ blackmarket)
- Mode text display below toggle
- Data management buttons:
  - Export JSON
  - Export CSV
  - Clear All Data
  - Various test buttons (token match, group parsing, bonus calculations)

**User Interactions**:
- Type device ID
- Toggle mode switch
- Click Save & Start Station
- Export/clear data for debugging

---

### Screen: Team Entry Screen

**ID**: `teamEntryScreen`
**Purpose**: Accept team ID via numeric keypad before scanning begins
**Visual**: Large numeric keypad (3×4 grid), team ID display
**CSS Class**: `.screen`
**DOM Structure** (index.html:1553-1570):
```html
<div id="teamEntryScreen" class="screen">
    <div class="team-display" id="teamDisplay">_</div>
    <div class="numpad">
        <!-- 12 buttons: 1-9, Clear, 0, Enter -->
    </div>
</div>
```

**Show Conditions**:
- After Game Mode selection and connection (if networked) established
- Or after mode selection (if standalone)
- After team finishes scanning (via `App.finishTeam()`)

**Navigation**:
- **Enter Button**: 
  - Validates team ID length > 0
  - **To**: Scan Screen
- **Settings Button** (header):
  - **To**: Settings Screen

**State Management**:
- App.currentTeamId: String (accumulates digits)
- Display updates via UIManager.updateTeamDisplay()
- No backend sync (local only)

**Key Components**:
- Team display area (shows "___" or entered digits)
- Numeric keypad (3×3 grid + 1 row)
  - Buttons 1-9: Append digit
  - Button "0": Append zero
  - Button "Clear": Reset App.currentTeamId
  - Button "Enter": Confirm and move to scan screen

**User Interactions**:
- Tap numeric buttons to enter team ID
- Tap Clear to reset
- Tap Enter to confirm

**CSS Classes**:
- `.numpad button` - Individual button styling
- `.numpad button.clear` - Yellow (Clear button)
- `.numpad button.enter` - Green (Enter button)

---

### Screen: Scan Screen

**ID**: `scanScreen`
**Purpose**: Main gameplay screen where tokens are scanned
**Visual**: Scan icon, status message, scan button, stats display
**CSS Class**: `.screen`
**DOM Structure** (index.html:1572-1595):
```html
<div id="scanScreen" class="screen">
    <div class="status-message">Team <strong id="currentTeam"></strong> Ready</div>
    <div class="scan-area">
        <div class="scan-icon">📡</div>
        <h2>Tap Memory Token</h2>
        <p id="scanStatus">Waiting for NFC tag...</p>
    </div>
    <!-- Buttons: Start Scanning, Manual Entry, Back to Team Entry -->
    <!-- Stats display: Token count, Total value/score -->
</div>
```

**Show Conditions**:
- After Team ID confirmed in Team Entry Screen
- Returned to after scanning each token

**Navigation**:
- **Start Scanning Button**: Initiates NFC read via `App.startScan()`
- **Manual Entry (Debug) Button**: Shows prompt for manual RFID input
- **Back to Team Entry Button**: Returns via `App.cancelScan()`
- **Automatic**: → Result Screen (after token processed)

**WebSocket Events** (Networked Mode Only):
- `gm:scan` - Emit scanned token to backend
- `← gm:scan:ack` - Receive backend confirmation
- `← transaction:new` - Broadcast when transaction accepted (for other stations)
- `← score:updated` - Broadcast when score changes (admin adjustments)

**State Management**:
- App.currentTeamId: Current team being scanned
- DataManager.scannedTokens: Set of token IDs (prevents duplicates)
- Session stats computed from DataManager.getSessionStats()

**Key Components**:
- Team display (current team ID)
- Status message area
- Scan area with icon (📡)
- Scan status text ("Waiting for NFC tag...")
- Buttons:
  - "Start Scanning" (calls App.startScan())
  - "Manual Entry" (debug fallback)
  - "Back to Team Entry"
- Stats display:
  - Token count (team tokens scanned)
  - Total value (team total score/value)

**User Interactions**:
- Click "Start Scanning" → NFC reader activates
  - Android: Browser prompts to "Scan NFC tag"
  - Tap token to reader
- If NFC unavailable: Simulate scan automatically
- Click "Manual Entry" → Prompt for RFID ID
- Click "Back" → Return to Team Entry

**NFC Processing Flow** (App.startScan → App.processNFCRead):
```
Start Scan
    ↓
NFC Reader Active (30s timeout)
    ↓
Token Tapped
    ↓
NDEF Message Read
    ↓
RFID Extracted
    ↓
TokenManager.findToken(rfid)
    ├─ Found: Use token data
    └─ Not found: Record as UNKNOWN
    ↓
Check for Duplicate
    ├─ Already scanned: Show duplicate error → Result Screen
    └─ New token: Process transaction
    ↓
RecordTransaction(token, tokenId, isUnknown)
    ├─ Networked mode: Queue via NetworkedQueueManager
    └─ Standalone: Add to DataManager.transactions
    ↓
Update UI stats
    ↓
Show Result Screen
```

---

### Screen: Result Screen

**ID**: `resultScreen`
**Purpose**: Display result of token scan (success, duplicate, or unknown)
**Visual**: Status message, token details, next action buttons
**CSS Class**: `.screen`
**DOM Structure** (index.html:1597-1623):
```html
<div id="resultScreen" class="screen">
    <div id="resultStatus" class="status-message success">
        <h2>Transaction Complete!</h2>
    </div>
    <div class="transaction-result">
        <!-- Token details: RFID, Type, Group, Value -->
    </div>
    <!-- Buttons: Scan Another, Finish Team -->
</div>
```

**Show Conditions**:
- Shown by `UIManager.showTokenResult()` after token processing
- Displays result of scan (success, duplicate, or unknown)

**Navigation**:
- **Scan Another Token Button**: 
  - Calls `App.continueScan()`
  - **To**: Scan Screen (same team)
- **Finish Team Button**:
  - Calls `App.finishTeam()`
  - **To**: Team Entry Screen (new team can be selected)

**State Management**:
- Shows result of last scan
- No persistent state after navigation

**Key Components**:
- Status message (changes color based on result):
  - Green (success): "Transaction Complete!"
  - Red (duplicate): "Token Already Scanned"
  - Red (unknown): "Unknown Token"
- Token details (read-only display):
  - RFID/Token ID
  - Memory Type (Personal/Business/Technical/UNKNOWN)
  - Group
  - Value Rating (stars or dollar amount)
- Buttons:
  - "Scan Another Token" (green, primary)
  - "Finish Team" (gray, secondary)

**Display Logic** (UIManager.showTokenResult):
- **Success**: Green background, show token details
- **Duplicate**: Red background, show "Token Already Scanned"
- **Unknown**: Red background, show "Unknown Token - Not in database"

**User Interactions**:
- Click "Scan Another Token" → Continue with same team
- Click "Finish Team" → Return to team entry

---

### Screen: History Screen (Overlay)

**ID**: `historyScreen`
**Purpose**: View all transactions with filtering and statistics
**Visual**: Summary stats, search/filter, transaction cards, back button
**CSS Class**: `.screen`
**DOM Structure** (index.html:1625-1662):
```html
<div id="historyScreen" class="screen">
    <!-- Summary statistics cards -->
    <!-- Filter bar: search input, mode filter -->
    <!-- History container with transaction cards -->
    <!-- Back button -->
</div>
```

**Show Conditions**:
- Opened via History button (📋) in header
- Badge shows transaction count

**Navigation**:
- **Back Button**: Returns to UIManager.previousScreen (or teamEntry)
- **History Badge**: Shown in header, updated via UIManager.updateHistoryBadge()

**State Management**:
- Displays DataManager.transactions array
- Filter state: searchFilter input, modeFilter select
- Not tracked in back button history (overlay screen)

**Key Components**:
- Summary stats (4 cards):
  - Total Scans count
  - Unique Teams count
  - Total Value / Total Score
  - Average Value / Average Score
- Filter bar:
  - Search input (searches RFID, team ID, type, group)
  - Mode filter dropdown (All/Detective/Black Market)
- Transaction cards (scrollable list):
  - Team ID
  - RFID
  - Value / Stars
  - Memory Type
  - Mode indicator
  - Timestamp
- Back button

**User Interactions**:
- Type in search field → Filters transactions
- Select mode filter → Filters by Detective/Black Market
- See all transactions with timestamps

**Filtering Logic** (UIManager.filterTransactions):
```javascript
transactions.filter(t => {
  matchesSearch = searchText in (rfid, teamId, type, group)
  matchesMode = !modeFilter OR t.mode === modeFilter
  return matchesSearch && matchesMode
})
```

---

### Screen: Scoreboard Screen (Overlay, Black Market Mode Only)

**ID**: `scoreboardScreen`
**Purpose**: Display ranked team scores (Black Market mode only)
**Visual**: Ranked entries with medals, scores, token counts
**CSS Class**: `.screen`
**DOM Structure** (index.html:1664-1676):
```html
<div id="scoreboardScreen" class="screen">
    <h2>🏆 Black Market Scoreboard</h2>
    <div id="scoreboardContainer" class="scoreboard-container">
        <!-- Ranked team entries populated by JavaScript -->
    </div>
    <!-- Back button -->
</div>
```

**Show Conditions**:
- Detective mode: Hidden (button not visible)
- Black Market mode: Visible via `App.showScoreboard()`
- Shows live scores from backend (networked) or local (standalone)

**Navigation**:
- **Team Card Click**: 
  - Calls `App.showTeamDetails(teamId)`
  - **To**: Team Details Screen
- **Back Button**: Returns to UIManager.previousScreen

**State Management**:
- DataManager.getTeamScores() - Returns ranked teams
- Uses backend scores if available (networked mode)
- Falls back to local calculation (standalone)

**Key Components**:
- Scoreboard container (scrollable)
- Team entries (rank-ordered):
  - Medal (🥇 rank 1, 🥈 rank 2, 🥉 rank 3, #N rank 4+)
  - Team ID
  - Token count
  - Total score ($)
- Special styling:
  - Rank 1: Gold gradient background
  - Rank 2: Silver gradient background
  - Rank 3: Bronze gradient background
  - Clickable entries
- Back button

**Score Source Indicator**:
- 🔗 "Live from Orchestrator" (networked mode)
- 📱 "Local Calculation" (standalone mode)

**CSS Classes**:
- `.scoreboard-entry` - Base styling
- `.scoreboard-entry.rank-1` - Gold background
- `.scoreboard-entry.rank-2` - Silver background
- `.scoreboard-entry.rank-3` - Bronze background

---

### Screen: Team Details Screen (Overlay)

**ID**: `teamDetailsScreen`
**Purpose**: Show detailed breakdown of team's tokens with group completions
**Visual**: Grouped tokens, completion bonuses, score breakdown, admin controls
**CSS Class**: `.screen`
**DOM Structure** (index.html:1678-1719):
```html
<div id="teamDetailsScreen" class="screen">
    <!-- Team header and summary -->
    <!-- Completed groups section -->
    <!-- In-progress groups section -->
    <!-- Individual ungrouped tokens -->
    <!-- Unknown tokens section -->
    <!-- Score breakdown -->
    <!-- GM Intervention controls (networked only) -->
    <!-- Back button -->
</div>
```

**Show Conditions**:
- Opened from Scoreboard via team card click
- Opened via `App.showTeamDetails(teamId)`
- Only Black Market mode

**Navigation**:
- **Back Button**: Returns to Scoreboard Screen
- Previous transaction/history context lost

**State Management**:
- Team ID stored in App.currentInterventionTeamId (for admin actions)
- Enhanced data from DataManager.getEnhancedTeamTransactions(teamId)
- Score data from DataManager.calculateTeamScoreWithBonuses(teamId)
- Backend scores (if available) from DataManager.backendScores.get(teamId)

**Key Components**:

**Header**:
- Team ID display
- Transaction count summary

**Completed Groups Section**:
- Group header (green background, "✅ Completed Groups")
  - Group name
  - Completion badge (🏆)
  - "COMPLETE" text
  - Bonus amount (e.g., "+$5000 bonus (5x)")
- Token cards under each group

**In-Progress Groups Section**:
- Group header (orange background, "🔶 In Progress Groups")
  - Group name
  - Progress badge (⏳)
  - Progress text (e.g., "2/3")
  - Progress bar showing percentage
- Token cards under each group

**Individual Tokens Section**:
- "📦 Individual Tokens" divider
- Token cards for ungrouped tokens

**Unknown Tokens Section**:
- "❓ Unknown Tokens" divider
- Token cards for tokens not in database

**Token Cards** (Recurring component):
- RFID
- Memory Type
- Base Rating (stars)
- Status (✅ Bonus Applied, ⏳ No Bonus, ❓ Unknown)
- Calculation breakdown
- Value display ($)
- Delete button (networked mode only)

**Score Breakdown**:
- Base Score
- Group Bonuses
- Admin Adjustments (if any, networked mode)
- Total Score

**Admin Adjustments Display** (Networked Mode):
- If present: Shows warning background (yellow)
- Lists each adjustment:
  - Delta amount
  - Reason
  - Timestamp and GM station

**GM Intervention Controls** (Networked Mode Only):
- Score adjustment input (+ or -)
- Reason input
- "Adjust Score" button
- Warning text about changes syncing across scanners

**User Interactions**:
- Click team card from scoreboard
- View detailed breakdown
- Read group completions and bonuses
- See admin adjustments (if any)
- Enter score adjustment (networked mode)
- Delete transactions (networked mode)
- Return to scoreboard

---

### View: Admin View (Networked Mode Only)

**ID**: `admin-view`
**Purpose**: Orchestrator control panel for GMs
**Visual**: Multiple sections (Session, Video, System, Scores, Transactions)
**CSS Class**: `.view-content`
**DOM Structure** (index.html:1724-1817):
```html
<div id="admin-view" class="view-content" style="display: none;">
    <!-- Session Management Section -->
    <!-- Video Controls Section -->
    <!-- System Status Section -->
    <!-- Team Scores Section -->
    <!-- Recent Transactions Section -->
</div>
```

**Show Conditions**:
- Networked mode only
- Hidden by default
- Shown via tab click on "Admin" tab (when visible)

**Access**: Tab selector shows "Admin" button (⚙️)

**Navigation**:
- Click "Scanner" tab → Return to Scanner View
- Click "Debug" tab → Switch to Debug View

**State Management**:
- Managed by App.viewController.adminInstances
- AdminModule components:
  - SessionManager: Creates and manages sessions
  - VideoController: Controls VLC playback
  - SystemMonitor: Health checks
  - AdminOperations: Reset scores, clear transactions
  - MonitoringDisplay: Event-driven UI updates

**Key Components**:

**Session Management Panel**:
- Current session display (updated via broadcasts)
- Buttons:
  - "Create Session" → Prompts for session name
  - "Pause Session" → Pauses gameplay
  - "Resume Session" → Resumes gameplay
  - "End Session" → Ends current session
  - "Reset & Create New" → Archive and start fresh
  - "View Details" → Shows session info

**Video Controls Panel**:
- Current video display
- Queue length display
- Video progress bar (when playing)
- Buttons:
  - "Play" → Resume playback
  - "Pause" → Pause playback
  - "Stop" → Stop and clear
  - "Skip" → Skip to next video
- Video queue display (scrollable list)
- Manual video control:
  - Autocomplete input for available videos
  - "Add to Queue" button
  - "Clear Entire Queue" button

**System Status Panel**:
- Orchestrator status (colored dot)
- VLC status (colored dot)
- Device count
- Connected devices list (scrollable)

**Team Scores Panel**:
- Score board table (Team ID, Token Count, Score)
- "Reset All Scores" button

**Recent Transactions Panel**:
- Transaction log (last 10)
  - Time, Team, Token ID, Type
- "Clear History" button

**WebSocket Events**:
- `session:update` - Updates session display
- `video:status` - Updates video queue and progress
- `game:state` - Updates all displays
- `transaction:new` - Adds to transaction log
- `score:updated` - Updates team scores

---

### View: Debug View (Networked Mode Only)

**ID**: `debug-view`
**Purpose**: Real-time debug console for troubleshooting
**Visual**: Monospace terminal-style output
**CSS Class**: `.view-content`
**DOM Structure** (index.html:1820-1822):
```html
<div id="debug-view" class="view-content" style="display: none;">
    <div id="debugContent" class="debug-content"></div>
</div>
```

**Show Conditions**:
- Networked mode only
- Hidden by default
- Shown via tab click on "Debug" tab (when visible)

**Access**: Tab selector shows "Debug" button (🐛)

**Navigation**:
- Click "Scanner" tab → Return to Scanner View
- Click "Admin" tab → Switch to Admin View

**State Management**:
- Populated by Debug.log() calls throughout app
- Scrollable history

**Key Components**:
- Debug console (black background, green text)
- Real-time log entries
- Shows:
  - Initialization steps
  - Token operations
  - Connection status changes
  - WebSocket events
  - Error messages

---

## Part 4: Connection Wizard Modal

### Overview
The Connection Wizard is a **fixed-position modal overlay** (not a screen) that appears for networked mode setup.

**ID**: `connectionModal`
**Purpose**: Connect to backend orchestrator
**Type**: Modal dialog box
**Z-Index**: 10000 (above all screens)
**DOM Structure** (index.html:1377-1417):
```html
<div id="connectionModal" class="modal">
    <div class="modal-content">
        <h2>🎮 Connect to Game Server</h2>
        <!-- Discovery section -->
        <!-- Manual configuration form -->
    </div>
</div>
```

### Modal State

**Hidden** (display: none):
- Initial page load
- During standalone mode

**Shown** (display: flex):
- After "Networked Mode" button clicked
- When `showConnectionWizard()` called
- Automatic scan triggered on show

**Closed**:
- After successful connection
- Via "Cancel" button
- Via connection timeout

### Modal Sections

**Discovery Section** (Primary):
- "Scan for Game Servers" button
  - Calls `scanForServers()` via ConnectionManager
  - Initiates UDP broadcast discovery
  - Shows progress ("Scanning...")
- Discovered servers list (dynamic)
  - Shows up to N discovered servers
  - Each with "Select" button
  - Clicking "Select" auto-fills server URL
- Discovery status message

**Divider**: "─── OR Enter Manually ───"

**Manual Configuration Form**:
- Server Address input
  - Placeholder: "http://10.0.0.135:3000"
  - Auto-normalizes protocol (adds https:// if needed)
- Station Name input
  - Placeholder: "GM Station 1"
  - Auto-increments on repeat visits
- GM Password input (type="password")
  - Required for authentication
- Connection status message (dynamic)
  - Shows: ⏳ Connecting..., ✅ Connected!, ❌ Error
- Button group:
  - "Connect" button (green, primary)
  - "Cancel" button (gray)

### Connection Process

```
Show Connection Wizard
    ↓
[Optional] Scan for Servers
    ├─ UDP broadcast to discover orchestrators
    ├─ Display found servers
    └─ User clicks "Select"
    ↓
[Manual] Fill form fields
    ├─ Server Address (auto-normalized)
    ├─ Station Name
    └─ GM Password
    ↓
Click "Connect"
    ↓
Validate inputs (all required)
    ↓
Health Check: GET /health (3s timeout)
    ├─ Timeout or not OK → Error message
    └─ OK → Continue
    ↓
Authenticate: POST /api/admin/auth with password
    ├─ Invalid password → Error message
    └─ Success → Get JWT token
    ↓
Store connection data via ConnectionManager
    ├─ URL (normalized)
    ├─ JWT token
    ├─ Station name & device ID
    └─ Update lastStationNum for next session
    ↓
Establish WebSocket connection
    ├─ Connect with JWT in handshake.auth
    └─ Receive sync:full event
    ↓
Modal dismissed (1s delay)
    ↓
Show Team Entry Screen
```

### Functions

**showConnectionWizard()**:
- Show modal (display: flex)
- Clear previous inputs
- Trigger auto-scan

**scanForServers()**:
- Call ConnectionManager.discoverServers()
- UDP broadcast to port 8888
- Display results via displayDiscoveredServers()

**displayDiscoveredServers(servers)**:
- Populate discovered servers list
- Each server has "Select" button
- Show count message

**selectServer(url)**:
- Auto-fill serverUrl input
- Generate station name if empty
- Show "Server selected" message

**handleConnectionSubmit(event)**:
- Validate all inputs
- Health check
- Authentication
- Store connection data
- Establish WebSocket
- Close modal
- Show Team Entry Screen

**cancelNetworkedMode()**:
- Close modal
- Clear SessionModeManager lock
- Return to Game Mode Screen

---

## Part 5: State Management System

### Data Storage Architecture

```
Window Object (Global Scope)
├── App (Main coordinator)
│   ├── currentTeamId: String
│   ├── nfcSupported: Boolean
│   ├── currentInterventionTeamId: String (for admin actions)
│   ├── viewController: Object
│   │   ├── currentView: 'scanner' | 'admin' | 'debug'
│   │   └── adminInstances: AdminModule components
│   └── [Methods for all user interactions]
│
├── DataManager (Transaction & scoring)
│   ├── transactions: Array
│   ├── scannedTokens: Set
│   ├── backendScores: Map (team → score data)
│   └── [Scoring & calculation methods]
│
├── UIManager (Screen navigation)
│   ├── screens: Object (screen references)
│   ├── previousScreen: String
│   └── [Screen display methods]
│
├── TokenManager (Token database)
│   ├── database: Object (token_id → token data)
│   └── [Token lookup methods]
│
├── Settings (Configuration)
│   ├── deviceId: String
│   ├── mode: 'detective' | 'blackmarket'
│   └── [Settings persistence]
│
├── SessionModeManager (Mode selection)
│   ├── mode: 'networked' | 'standalone' | null
│   ├── locked: Boolean
│   └── [Mode management methods]
│
├── ConnectionManager (Connection state)
│   ├── url: String (localStorage)
│   ├── token: String (JWT, localStorage)
│   ├── stationName: String (localStorage)
│   ├── deviceId: String (localStorage)
│   ├── mode: String (localStorage)
│   └── [Connection methods]
│
├── OrchestratorClient (WebSocket)
│   ├── socket: Socket.io client
│   ├── isConnected: Boolean
│   ├── eventHandlers: Map
│   └── [WebSocket methods]
│
├── NetworkedQueueManager (Offline queue)
│   ├── queue: Array
│   └── [Queue management methods]
│
└── NFCHandler (NFC API)
    ├── supported: Boolean
    └── [NFC methods]
```

### LocalStorage Keys

```
localStorage
├── aln_transactions         # JSON array of scanned transactions
├── aln_scanned_tokens       # JSON array of token IDs (for dedup)
├── aln_deviceId             # Station device ID
├── aln_stationName          # Human-readable station name
├── aln_mode                 # 'detective' | 'blackmarket'
├── orchestratorUrl          # Backend server URL
├── gmToken                  # JWT authentication token
├── deviceId                 # [From ConnectionManager]
├── stationName              # [From ConnectionManager]
├── mode                     # [From ConnectionManager]
├── gameSessionMode          # 'networked' | 'standalone'
├── lastStationNum           # For auto-incrementing station names
├── orchestratorOfflineQueue # Queued transactions (networked only)
└── [Various test data keys]
```

### State Flow for Transaction Processing

**Standalone Mode**:
```
User Scans Token
    ↓
App.processNFCRead(rfid)
    ├─ TokenManager.findToken(rfid)
    └─ Check DataManager.scannedTokens for duplicate
    ↓
App.recordTransaction(token, tokenId, isUnknown)
    ├─ DataManager.addTransaction(tx)
    ├─ DataManager.markTokenAsScanned(tokenId)
    └─ DataManager.saveTransactions() to localStorage
    ↓
UIManager.updateSessionStats()
    ├─ Get stats from DataManager.getSessionStats()
    └─ Update display elements
    ↓
UIManager.showTokenResult(token, tokenId, isUnknown)
    └─ Show Result Screen
```

**Networked Mode**:
```
User Scans Token
    ↓
App.processNFCRead(rfid)
    ├─ TokenManager.findToken(rfid)
    └─ Check DataManager.scannedTokens for duplicate
    ↓
App.recordTransaction(token, tokenId, isUnknown)
    ├─ DataManager.markTokenAsScanned(tokenId) [Local dedup]
    ├─ NetworkedQueueManager.queueTransaction(tx)
    │   └─ Queue in localStorage if offline
    │   └─ Send immediately if online
    │       ├─ OrchestratorClient.emit('gm:scan', tx)
    │       └─ Wait for 'gm:scan:ack'
    │           ├─ Success: Transaction added locally
    │           └─ Failure: Remains in queue
    └─ Update UI stats
    ↓
Backend Processes Transaction
    ├─ Validates token
    ├─ Calculates score
    └─ Broadcasts 'transaction:new' event
    ↓
OrchestratorClient Receives Broadcast
    ├─ Add to local DataManager.transactions
    ├─ Update DataManager.backendScores[teamId]
    └─ Emit local 'transaction:received'
    ↓
UIManager.updateSessionStats()
    ├─ Get stats from DataManager
    └─ Update display elements
    ↓
UIManager.showTokenResult(token, tokenId, isUnknown)
    └─ Show Result Screen
```

### State Synchronization Events

**WebSocket Events** (Networked Mode):
```
OrchestratorClient listens for:
├─ gm:scan:ack
│   └─ Transaction acknowledged by backend
├─ transaction:new (broadcast)
│   └─ New transaction processed
├─ score:updated (broadcast)
│   └─ Team score changed (admin adjustments)
├─ session:update (broadcast)
│   └─ Session lifecycle change
├─ video:status (broadcast)
│   └─ Video playback state
├─ device:connected/disconnected (broadcast)
│   └─ Device status change
└─ game:state (broadcast)
    └─ Full state snapshot
```

**Event Handler Registration** (AdminModule):
- AdminModule listens to WebSocket broadcasts
- Updates display elements directly
- No intermediate state management
- MonitoringDisplay handles all UI updates

---

## Part 6: WebSocket Connection Lifecycle (Networked Mode)

### Authentication Flow

```
1. HTTP Authentication
   ├─ POST /api/admin/auth { password: "..." }
   └─ ← { token: "eyJ...", expiresIn: 86400 }

2. Store JWT Token
   └─ ConnectionManager.token = "eyJ..."

3. WebSocket Handshake
   ├─ io.connect(url, {
   │   auth: {
   │     token: "eyJ...",
   │     deviceId: "GM_Station_1",
   │     deviceType: "gm",
   │     version: "1.0.0"
   │   }
   │ })
   └─ [Middleware validates JWT]

4. Connection Established
   ├─ Server sends sync:full event (auto-sync)
   └─ Client receives all current state

5. Join Room
   └─ Client joins 'gm-stations' room
```

### Connection States

```
Disconnected
    ↓ [Connect button clicked]
Connecting
    ├─ Health check pending
    ├─ Authentication pending
    └─ WebSocket pending
    ↓
Connected
    ├─ ✅ Can scan tokens
    ├─ ✅ Can use admin panel
    ├─ ✅ Can receive broadcasts
    └─ ✅ Can submit admin commands
    ↓ [Loss of network]
Reconnecting
    ├─ Exponential backoff (5s, 10s, 20s, ...)
    ├─ ✅ Local scanning works (queued)
    ├─ ❌ Admin panel unavailable
    └─ Retry up to 5 times
    ↓ [Reconnect successful or give up]
```

### Connection Status Indicator

**Header Element**: `#connectionStatus`
**Classes**:
- `.connected` - Green dot, "Connected" text
- `.connecting` - Orange dot (pulsing), "Connecting" text
- `.disconnected` - Red dot, "Disconnected" text

**User Interaction**: Click to show Connection Wizard (allows manual reconnection)

### Auto-Sync on Connect

**sync:full Event**:
- Sent immediately after connection established
- Contains:
  ```javascript
  {
    event: 'sync:full',
    data: {
      session: {...},           // Current session object
      scores: {...},            // Team scores
      recentTransactions: [],   // Last N transactions
      videoStatus: {...},       // VLC state
      devices: [],              // Connected devices
      systemStatus: {...}       // System health
    },
    timestamp: "2025-01-01T..."
  }
  ```
- Handled by MonitoringDisplay.onSync()

### Offline Queue Management

**NetworkedQueueManager**:
- Queues transactions when offline
- Stored in localStorage
- Retried on reconnect with exponential backoff
- Deduplicates to prevent double-submission
- Rate limits to prevent server overload

**Queue Persistence**:
- Survives page reload
- Persists across tabs (localStorage)
- Survives browser restart

**Sync on Reconnect**:
- Query backend for current state
- Compare queued transactions
- Submit any missing transactions
- Clear queue if successful

---

## Part 7: NFC Scanning Flow

### NFC API Integration

**Web NFC API** (JS):
- Android Chrome 89+ / Edge 89+
- Requires HTTPS (except localhost)
- API: `navigator.nfc.scan()`

**Fallback**:
- Manual entry via prompt dialog
- Demo mode simulation

### Scan Process

```
User clicks "Start Scanning"
    ↓
NFCHandler.startScan()
    ├─ Check if Web NFC API available
    ├─ Request NFC permission (browser)
    └─ Start NDEFReader session
    ↓
Display "Scanning... Tap a token"
    ↓
User Taps Token
    ↓
NDEF Message Received
    └─ Event: 'reading'
    ↓
NFCHandler.handleScan(ndefMessage)
    ├─ Parse NDEF records
    ├─ Extract RFID from record payload
    └─ Return {id, source, raw}
    ↓
App.processNFCRead(result)
    ├─ Validate team selected
    ├─ Clean/trim RFID
    ├─ Check for duplicate
    └─ Look up token in database
    ↓
[If found]: Record with token data
[If not found]: Record as UNKNOWN
    ↓
Show Result Screen
```

### NFC Support Detection

```
Phase 1I: DetectNFCSupport()
    ↓
Check if 'NDEFReader' in window
    ├─ True: nfcSupported = true
    │   └─ "Start Scanning" button uses real NFC
    └─ False: nfcSupported = false
        └─ "Start Scanning" button uses simulation
```

### Manual Entry (Fallback)

**When Used**:
- NFC not available
- Testing/demo mode
- User selects "Manual Entry (Debug)" button

**Flow**:
```
User clicks "Manual Entry (Debug)"
    ↓
Browser prompt: "Enter RFID manually:"
    ↓
User types RFID
    ↓
App.processNFCRead({id, source: 'manual', raw})
    ↓
Process same as NFC scan
```

### Token Matching

**TokenManager.findToken(rfid)**:
- Fuzzy matching on RFID
- Handles case variations
- Handles format variations (with/without colons)
- Returns: `{token, matchedId}` or `null`

**Token Data Structure**:
```javascript
{
  SF_RFID: "token_id",                    // Required
  SF_ValueRating: 1-5,                    // Required
  SF_MemoryType: "Personal|Business|Technical", // Required
  SF_Group: "Group Name (xN)"             // Required
}
```

**Deduplication**:
- Check DataManager.scannedTokens Set
- Uses normalized/matched token ID
- Prevents same token being scanned twice
- Allows re-scanning in standalone mode after deletion

---

## Part 8: Scoring System

### Configuration (DataManager.SCORING_CONFIG)

```javascript
{
  BASE_VALUES: {
    1: 500,   // 1-star rating
    2: 1000,  // 2-star rating
    3: 1500,  // 3-star rating
    4: 2000,  // 4-star rating
    5: 2500   // 5-star rating
  },
  TYPE_MULTIPLIERS: {
    Personal: 1,
    Business: 3,
    Technical: 5,
    UNKNOWN: 0
  },
  GROUP_COMPLETION_BONUS: 0.5  // 50% bonus when group completed
}
```

### Black Market Scoring

**Token Value Calculation**:
```
Base = BASE_VALUES[valueRating]
TypeMultiplier = TYPE_MULTIPLIERS[memoryType]
TokenValue = Base × TypeMultiplier

If group completed:
  GroupMultiplier = parseInt(group.match(/\(x(\d+)\)/)[1])
  FinalValue = TokenValue × GroupMultiplier
Else:
  FinalValue = TokenValue
```

### Group Completion Bonus

**Group Definition**:
- Format: "Group Name (xN)" where N is multiplier
- Completion: All tokens in group scanned by same team

**Bonus Calculation**:
```
CompletedGroups = teams tokens by group
GroupBonus = SUM(TokenValue × (Multiplier - 1)) for each completed group
TotalScore = BaseScore + GroupBonus
```

### Detective Mode

- No scoring
- Tracks tokens by star rating
- Group completions not calculated
- Value display: ⭐⭐⭐ (stars only)

### Score Display

**Networked Mode**:
- Shows backend-calculated scores (authoritative)
- Includes admin adjustments
- Real-time updates via score:updated events

**Standalone Mode**:
- Shows locally-calculated scores
- No admin adjustments
- Updates on local transaction

---

## Part 9: UI Components & Styling

### Key CSS Classes

**Screen Management**:
- `.screen` - Base screen class (display: none)
- `.screen.active` - Currently visible screen (display: block)

**Buttons**:
- `.btn` - Base button styling
- `.btn-primary` - Blue primary action button
- `.btn-secondary` - Gray secondary action button

**Status Indicators**:
- `.status-message` - Base status box (light gray)
- `.status-message.success` - Green success message
- `.status-message.error` - Red error message
- `.status-message.warning` - Orange warning message

**Mode Indicators**:
- `.mode-indicator.mode-detective` - Green badge
- `.mode-indicator.mode-blackmarket` - Orange badge

**Connection Status**:
- `.connection-status.connected` - Green dot
- `.connection-status.connecting` - Orange pulsing dot
- `.connection-status.disconnected` - Red dot

**Transaction Cards**:
- `.transaction-card` - Base card styling
- `.transaction-card.detective` - Green left border
- `.transaction-card.blackmarket` - Orange left border
- `.transaction-card.unknown` - Gray left border

**Scoreboard Entries**:
- `.scoreboard-entry` - Base entry
- `.scoreboard-entry.rank-1` - Gold gradient (🥇)
- `.scoreboard-entry.rank-2` - Silver gradient (🥈)
- `.scoreboard-entry.rank-3` - Bronze gradient (🥉)

**Token Detail Cards**:
- `.token-detail-card` - Base card
- `.token-detail-card.unknown` - Gray for unknown tokens
- `.token-detail-card.bonus-applied` - Green for bonus tokens

**Group Sections**:
- `.group-header.completed` - Green completed header
- `.group-header.in-progress` - Orange in-progress header

### Responsive Design

**Mobile** (< 480px):
- Reduced padding and font sizes
- Numpad buttons smaller (20px → 20px font)
- Connection status text hidden, icon only

**Tablet** (481-768px):
- Full-size interface
- Side-by-side layouts

**Desktop** (> 768px):
- Header layout adjusts for larger screens

---

## Part 10: Error Handling & User Feedback

### Error Display System (Phase 4.3)

**UIManager.showError(message, duration)**:
- Creates error div with message
- Auto-dismisses after duration (default 5s)
- Slide-in/out animation
- Top-right corner fixed position
- Red background with white text

**UIManager.showToast(message, type, duration)**:
- Creates toast notification
- Types: 'info' (blue), 'success' (green), 'warning' (orange), 'error' (red)
- Auto-dismisses after duration (default 3s)
- Slide-in/out animation
- Stacks if multiple toasts shown

### Error Scenarios

**Token Processing**:
- NFC read error → "Read error. Try again."
- NFC not available → "NFC not available. Using demo mode."
- Duplicate token → Show Result Screen with red status
- Unknown token → Show Result Screen with red status
- No team selected → "Please select a team before scanning tokens"

**Network Issues** (Networked Mode):
- Connection timeout → Status indicator turns red
- Server not responding → "Server not responding"
- Invalid password → "Invalid password"
- Token expired → Reconnect prompt

**Initialization**:
- Token database fail-to-load → Block app with error
- Service worker registration fail → Warning but app continues

---

## Part 11: Navigation Map

### Complete State Transition Diagram

```
APP START
    ↓
Load Config
    ├─ Token Database: OK
    ├─ Settings: (Restore)
    ├─ Previous Session: (Restore if exists)
    └─ NFC Support: Detect
    ↓
┌─────────────────────────────────┐
│ LOADING SCREEN                   │
│ (Transient, ~1-2 seconds)       │
└─────────────────────────────────┘
    ↓
Check Saved Mode
    ├─ Mode exists + Connection ready
    │   └─→ TEAM ENTRY SCREEN (resume)
    ├─ Mode exists + Connection not ready (networked)
    │   └─→ CONNECTION WIZARD (reconnect)
    └─ No mode saved
        └─→ GAME MODE SELECTION SCREEN (new game)
    ↓
┌─────────────────────────────────┐
│ GAME MODE SELECTION SCREEN      │
│ [New Session Only]              │
│ ├─ Networked Game Button        │
│ │   └─→ CONNECTION WIZARD MODAL  │
│ └─ Standalone Game Button       │
│     └─→ TEAM ENTRY SCREEN       │
└─────────────────────────────────┘
    ↓
┌─────────────────────────────────┐
│ CONNECTION WIZARD MODAL         │
│ [Networked Mode Only]           │
│ ├─ Discovery Section            │
│ ├─ Manual Configuration         │
│ ├─ Auto-scan for servers        │
│ └─ [On success]                 │
│     └─→ Close modal             │
│         └─→ TEAM ENTRY SCREEN   │
└─────────────────────────────────┘
    ↓
┌─────────────────────────────────┐
│ TEAM ENTRY SCREEN               │
│ ├─ Enter team ID via numpad     │
│ ├─ Settings (⚙️) Button          │
│ │   └─→ SETTINGS SCREEN        │
│ │       [EDIT MODE]            │
│ │       └─→ Back to TEAM ENTRY │
│ └─ Confirm Team ID              │
│     └─→ SCAN SCREEN             │
└─────────────────────────────────┘
    ↓
┌─────────────────────────────────┐
│ SCAN SCREEN                     │
│ ├─ Start Scanning (NFC)          │
│ │   └─→ [Tap token]             │
│ ├─ Manual Entry (Debug)          │
│ │   └─→ [Type RFID]             │
│ ├─ Back to Team Entry            │
│ │   └─→ [Cancel scan]           │
│ ├─ History (📋) Button           │
│ │   └─→ HISTORY SCREEN (overlay)│
│ │       └─→ TEAM ENTRY          │
│ ├─ Scoreboard (🏆) Button        │
│ │   [Black Market only]         │
│ │   └─→ SCOREBOARD SCREEN (overlay)
│ │       └─→ Click team          │
│ │           └─→ TEAM DETAILS    │
│ │               └─→ SCOREBOARD  │
│ └─ [Token processed]             │
│     └─→ RESULT SCREEN            │
└─────────────────────────────────┘
    ↓
┌─────────────────────────────────┐
│ RESULT SCREEN                   │
│ ├─ Scan Another Token            │
│ │   └─→ SCAN SCREEN (same team) │
│ └─ Finish Team                   │
│     └─→ TEAM ENTRY SCREEN        │
│         [New team can be selected]
└─────────────────────────────────┘
```

### History Navigation (Overlay Screens)

```
Active Screen (any)
    ↓ [Click History button]
┌─────────────────────────────────┐
│ HISTORY SCREEN (overlay)        │
│ ├─ Search & Filter              │
│ └─ Back Button                  │
│     └─→ Return to Previous Screen│
│         (tracked via previousScreen)
└─────────────────────────────────┘
```

### Scoreboard Navigation (Overlay Screen, Black Market Only)

```
SCAN SCREEN (Black Market mode)
    ↓ [Click Scoreboard button]
┌─────────────────────────────────┐
│ SCOREBOARD SCREEN (overlay)     │
│ ├─ Ranked Team Entries          │
│ │   └─→ Click team              │
│ │       └─→ TEAM DETAILS SCREEN │
│ │           ├─ Token Breakdown  │
│ │           ├─ Score Breakdown  │
│ │           ├─ Admin Controls   │
│ │           │   [Networked only]│
│ │           └─ Back Button      │
│ │               └─→ SCOREBOARD  │
│ └─ Back Button                  │
│     └─→ SCAN SCREEN             │
└─────────────────────────────────┘
```

### Admin Panel Navigation (Networked Mode Only)

```
SCAN SCREEN (any mode, when networked)
    ↓ [Click Admin Tab]
┌─────────────────────────────────┐
│ ADMIN VIEW (tab)                │
│ ├─ Session Management Panel     │
│ ├─ Video Controls Panel         │
│ ├─ System Status Panel          │
│ ├─ Team Scores Panel            │
│ ├─ Recent Transactions Panel    │
│ │                               │
│ ├─ All WebSocket-driven         │
│ │   (No local forms)            │
│ │                               │
│ └─ Click Scanner Tab            │
│     └─→ Return to SCAN SCREEN   │
└─────────────────────────────────┘
```

---

## Part 12: Event Flow Diagrams

### Transaction Processing (Networked Mode)

```
┌─ GM SCANNER ────────────────────┐
│ 1. User scans token             │
│    ↓                            │
│ 2. App.processNFCRead()         │
│    - Find token in database     │
│    - Check for duplicate        │
│    ↓                            │
│ 3. App.recordTransaction()      │
│    - Mark token scanned         │
│    - Create transaction object  │
│    ↓                            │
│ 4. NetworkedQueueManager.queue()│
│    - Queue transaction          │
│    - Send via WebSocket if OK   │
│    ↓                            │
│ 5. UIManager.updateUI()         │
│    - Update stats               │
│    - Show result screen         │
└────────────────────────────────┘
         ↓
    Network/Queue
         ↓
┌─ BACKEND ──────────────────────┐
│ 6. Receive 'gm:scan' event     │
│    ↓                            │
│ 7. Validate & Process          │
│    - Check token valid         │
│    - Calculate score           │
│    - Update session            │
│    ↓                            │
│ 8. Send 'gm:scan:ack'          │
│    ↓                            │
│ 9. Broadcast 'transaction:new' │
│    - All connected stations get│
│      the new transaction       │
└────────────────────────────────┘
         ↓
┌─ GM SCANNER (Receive) ──────────┐
│ 10. Receive 'transaction:new'  │
│     ↓                           │
│ 11. Update DataManager         │
│     - Add to transactions array│
│     - Update backendScores Map │
│     ↓                           │
│ 12. Update Stats Display       │
│     - Show new team score      │
│     - Show token count         │
└────────────────────────────────┘
```

### Admin Adjustment Flow (Score Modification)

```
┌─ GM SCANNER (Admin Panel) ─────┐
│ 1. Enter score adjustment      │
│    - Delta amount              │
│    - Reason (optional)         │
│    ↓                            │
│ 2. Click "Adjust Score"        │
│    ↓                            │
│ 3. AdminModule.adjustScore()   │
│    - Send 'admin:intervention' │
│    - Include gmStation, reason │
│    ↓                            │
│ 4. WebSocket emit              │
└────────────────────────────────┘
         ↓
┌─ BACKEND ──────────────────────┐
│ 5. Receive 'admin:intervention'│
│    ↓                            │
│ 6. Validate & Process          │
│    - Authorize admin           │
│    - Update team score         │
│    - Record adjustment         │
│    ↓                            │
│ 7. Broadcast 'score:updated'   │
│    - All stations notified     │
│    - Includes admin audit info │
└────────────────────────────────┘
         ↓
┌─ GM SCANNER (Receive) ──────────┐
│ 8. Receive 'score:updated'     │
│    ↓                            │
│ 9. Update DataManager          │
│    - Update backendScores      │
│    - Store admin adjustments   │
│    ↓                            │
│ 10. Update Team Details Display│
│     - Show new total score     │
│     - Show adjustment list     │
└────────────────────────────────┘
```

---

## Part 13: Known Limitations & Important Notes

### Mode Locking
- Once game mode selected (networked/standalone), cannot switch without page reload
- Prevents accidental data loss during active gameplay
- Design decision to maintain data consistency

### NFC Limitations
- Android Chrome/Edge 89+ required
- HTTPS required (except localhost)
- One token at a time (sequential scanning)
- May timeout if device doesn't tap within 30 seconds

### Offline Operation
- Networked mode: Queues transactions, syncs on reconnect
- Standalone mode: No backend connection possible
- Both modes cache token database locally

### Browser Compatibility
- Chrome 89+ (Desktop: NFC via Android phone required)
- Edge 89+ (Android)
- Firefox: Manual entry only (no NFC API support)
- Safari: Manual entry only (no NFC API support)

---

## Part 14: Common User Flows

### New Game Session (Networked Mode)

```
1. Load page
   → Loading Screen (1-2s)
   → Game Mode Selection Screen
2. Click "Networked Game"
   → Connection Wizard Modal shows
3. Enter server details or scan for servers
   → Connection established
   → Modal closes
4. Team Entry Screen shows
5. Enter team number (numpad)
6. Scan first token
   → Result Screen shows
7. "Scan Another" → Back to Scan Screen
8. Scan more tokens or finish team
   → Back to Team Entry for next team
```

### New Game Session (Standalone Mode)

```
1. Load page
   → Loading Screen (1-2s)
   → Game Mode Selection Screen
2. Click "Standalone Game"
   → Proceed immediately
3. Team Entry Screen shows
4. Enter team number (numpad)
5. Scan first token (manual entry or NFC)
   → Result Screen shows
6. Continue as networked mode...
```

### Resume Previous Session

```
1. Load page
   → Loading Screen (1-2s)
   → [If networked and disconnected]
     → Connection Wizard (reconnect)
   → [If networked and connected]
     → Team Entry (resume)
   → [If standalone]
     → Team Entry (resume)
2. Previous data preserved
   → Transaction history available
   → Scores remain unchanged
```

### View Leaderboard (Black Market Mode)

```
1. During scanning (Black Market mode)
2. Click "Scoreboard" (🏆) button in header
   → Scoreboard Screen shows
   → Ranked teams with scores
3. Click team entry
   → Team Details Screen shows
   → Grouped tokens
   → Completed groups with bonuses
   → In-progress groups
4. [Optional] Adjust score (networked mode)
   → Enter delta amount
   → Click "Adjust Score"
5. Back button returns to Scoreboard or Scan
```

---

## Conclusion

The ALNScanner frontend is a sophisticated single-page application with:

1. **Dual Mode Architecture**: Networked and standalone modes with locked selection
2. **Real-time Synchronization**: WebSocket-driven state updates in networked mode
3. **Offline Capability**: Queued transactions and local data persistence
4. **Flexible Token Recognition**: Fuzzy matching and unknown token handling
5. **Rich Scoring System**: Group completions, multipliers, admin adjustments
6. **Comprehensive Admin Interface**: Session, video, and system controls
7. **Mobile-First Design**: Responsive layout, NFC API integration
8. **Error Resilience**: Graceful fallbacks and retry mechanisms

The architecture prioritizes **separation of concerns** with modular components, **event-driven design** for state management, and **user-centric navigation** with overlay screens and modal dialogs.

---

## Appendix: File Size Reference

| File | Lines | Purpose |
|------|-------|---------|
| index.html | 2,117 | Main entry point + all styles/layout |
| app.js | 1,137 | Main coordinator + UI events |
| uiManager.js | 687 | Screen navigation + rendering |
| adminModule.js | 800+ | Admin panel components |
| dataManager.js | 600+ | Transaction + scoring logic |
| connectionManager.js | 300+ | Connection state management |
| orchestratorClient.js | 400+ | WebSocket client |
| tokenManager.js | 300+ | Token database + matching |
| **Total** | **~8,000** | **Pure HTML/JS, no build process** |

