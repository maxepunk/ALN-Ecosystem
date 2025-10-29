# Complete Initialization Flow: Standalone Mode Selection in ALNScanner

## Overview
This document traces the COMPLETE call stack from user clicking the "Standalone Game" button through to StandaloneDataManager initialization.

---

## 1. USER ACTION: Clicks "Standalone Game" Button

**File:** `/home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/ALNScanner/index.html:1535`

```html
<button class="mode-option" onclick="App.selectGameMode('standalone')" ...>
    <span class="mode-icon">📱</span>
    <h3>Standalone Game</h3>
    <p>Scanner only, no server required</p>
</button>
```

This HTML element has `onclick="App.selectGameMode('standalone')"` which triggers the call chain.

---

## 2. CALL STACK TRACE

### Level 1: App.selectGameMode('standalone')

**File:** `/home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/ALNScanner/js/app/app.js:119-133`

```javascript
// Game mode selection
selectGameMode(mode) {
    if (!window.sessionModeManager) {
        console.error('SessionModeManager not initialized');
        UIManager.showError('System error: SessionModeManager not initialized. Please reload the page.');
        return;
    }

    try {
        window.sessionModeManager.setMode(mode);  // <-- KEY CALL: Pass 'standalone' to setMode()
        console.log(`Game mode selected: ${mode}`);
    } catch (error) {
        console.error('Failed to set game mode:', error);
        UIManager.showError(`Failed to set game mode: ${error.message}`);
    }
}
```

**What it does:**
- Validates that `window.sessionModeManager` is initialized (initialized at startup)
- Calls `window.sessionModeManager.setMode('standalone')` with the selected mode
- Wraps call in try/catch for error handling

---

### Level 2: SessionModeManager.setMode('standalone')

**File:** `/home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/ALNScanner/js/app/sessionModeManager.js:7-26`

```javascript
setMode(mode) {
    if (this.locked) {
        throw new Error('Cannot change session mode after game start');
    }

    if (mode !== 'networked' && mode !== 'standalone') {
        throw new Error('Invalid session mode');
    }

    this.mode = mode;
    this.locked = true;  // <-- CRITICAL: Locks mode after selection
    localStorage.setItem('gameSessionMode', mode);  // <-- Persist mode to localStorage

    // Trigger appropriate initialization
    if (mode === 'networked') {
        this.initNetworkedMode();
    } else {
        this.initStandaloneMode();  // <-- KEY CALL: Branch to standalone initialization
    }
}
```

**What it does:**
1. Checks if mode is already locked (prevents switching modes mid-game)
2. Validates that mode is 'networked' or 'standalone'
3. Sets `this.mode = 'standalone'`
4. Sets `this.locked = true` (mode cannot change until reload)
5. Persists mode to localStorage: `localStorage.setItem('gameSessionMode', 'standalone')`
6. Calls `this.initStandaloneMode()` (dispatches to standalone initialization)

---

### Level 3: SessionModeManager.initStandaloneMode()

**File:** `/home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/ALNScanner/js/app/sessionModeManager.js:44-51`

```javascript
initStandaloneMode() {
    console.log('Initializing standalone mode...');
    // Skip all connection logic
    // Initialize local-only data manager
    window.dataManager = window.dataManager || new StandaloneDataManager();  // <-- CREATES StandaloneDataManager
    // Proceed directly to team entry
    UIManager.showScreen('teamEntry');  // <-- Shows team entry screen
}
```

**What it does:**
1. Logs initialization start
2. **Creates StandaloneDataManager instance** (only if not already created):
   - Checks `window.dataManager` (may not exist on first call)
   - Creates `new StandaloneDataManager()` if needed
   - Assigns to `window.dataManager` global
3. Transitions UI to team entry screen
   - Calls `UIManager.showScreen('teamEntry')`
   - This shows the numeric keypad for team ID input

---

## 3. STANDALONEDATA MANAGER INITIALIZATION

### StandaloneDataManager Constructor

**File:** `/home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/ALNScanner/js/core/standaloneDataManager.js:8-20`

```javascript
class StandaloneDataManager {
    constructor() {
        this.sessionData = {
            sessionId: this.generateLocalSessionId(),  // <-- Generates unique session ID
            startTime: new Date().toISOString(),       // <-- Records initialization time
            transactions: [],                          // <-- Starts with empty transaction list
            teams: {},                                 // <-- Starts with empty teams
            mode: 'standalone'                         // <-- Marks as standalone mode
        };

        // Load any previous incomplete session
        this.loadLocalSession();  // <-- KEY CALL: Attempts to load previous session from localStorage
    }
}
```

**Initialization order:**
1. Generates unique local session ID: `LOCAL_${timestamp}_${random}`
2. Records start time: Current ISO timestamp
3. Initializes empty transactions array
4. Initializes empty teams object
5. Sets mode to 'standalone'
6. **Calls `loadLocalSession()`** to restore any previous session

---

### StandaloneDataManager.loadLocalSession()

**File:** `/home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/ALNScanner/js/core/standaloneDataManager.js:216-235`

```javascript
loadLocalSession() {
    const saved = localStorage.getItem('standaloneSession');  // <-- Retrieves saved session
    if (saved) {
        try {
            const parsed = JSON.parse(saved);
            // Only load if it's from today
            const sessionDate = new Date(parsed.startTime).toDateString();
            const today = new Date().toDateString();

            if (sessionDate === today) {
                this.sessionData = parsed;  // <-- RESTORE: Overwrites session data with saved session
                console.log('Loaded previous session:', parsed.sessionId);
            } else {
                console.log('Previous session is from a different day, starting fresh');
            }
        } catch (error) {
            console.error('Failed to load previous session:', error);
        }
    }
}
```

**What it does:**
1. Attempts to load 'standaloneSession' from localStorage
2. If found and valid JSON, parses it
3. **Date check**: Only restores if session is from same calendar day
4. If same day: Restores full session data (teams, transactions, scores)
5. If different day: Starts fresh (new session ID, empty transactions)
6. Errors gracefully if JSON parsing fails

---

## 4. COMPLETE CALL STACK SUMMARY

```
User clicks "Standalone Game" button (index.html:1535)
    ↓
App.selectGameMode('standalone') (app.js:119)
    ↓
ValidationCheck: window.sessionModeManager exists (app.js:120-122)
    ↓
SessionModeManager.setMode('standalone') (sessionModeManager.js:7)
    ↓
    ├─ Mode validation check (sessionModeManager.js:12-14)
    ├─ Set this.mode = 'standalone' (sessionModeManager.js:16)
    ├─ Set this.locked = true (sessionModeManager.js:17) [CRITICAL: Prevents mode switching]
    ├─ Save to localStorage: localStorage.setItem('gameSessionMode', 'standalone') (sessionModeManager.js:18)
    ├─ Branch decision: mode === 'networked' ? (sessionModeManager.js:21)
    │   └─ false → Execute initStandaloneMode()
    ↓
SessionModeManager.initStandaloneMode() (sessionModeManager.js:44)
    ↓
    ├─ Log: 'Initializing standalone mode...'
    ├─ Initialize local data manager (sessionModeManager.js:48)
    │   └─ Check: window.dataManager || new StandaloneDataManager()
    │       └─ window.dataManager didn't exist → CREATE NEW
    ↓
StandaloneDataManager.constructor() (standaloneDataManager.js:8)
    ↓
    ├─ this.sessionData = {...} initialization (standaloneDataManager.js:10-16)
    │   ├─ sessionId: generateLocalSessionId() [LOCAL_${timestamp}_${random}]
    │   ├─ startTime: new Date().toISOString()
    │   ├─ transactions: []
    │   ├─ teams: {}
    │   └─ mode: 'standalone'
    ├─ Call loadLocalSession() (standaloneDataManager.js:19)
    ↓
StandaloneDataManager.loadLocalSession() (standaloneDataManager.js:216)
    ↓
    ├─ Retrieve localStorage.getItem('standaloneSession')
    ├─ If found:
    │   ├─ Parse JSON
    │   ├─ Check if session date matches today
    │   ├─ If yes: Restore this.sessionData = parsed
    │   └─ If no: Keep fresh sessionData (created above)
    └─ If error: Continue with fresh sessionData
    
[Constructor completes]
    ↓
Assign to window.dataManager (sessionModeManager.js:48)
    ↓
UIManager.showScreen('teamEntry') (sessionModeManager.js:50)
    ↓
Display team entry screen with numeric keypad
```

---

## 5. CRITICAL INITIALIZATION POINTS

### 5.1 Mode Locking (PERMANENT)
**File:** `sessionModeManager.js:17`
```javascript
this.locked = true;  // Once set, mode cannot change until page reload
```
- After selecting mode, `SessionModeManager.locked = true`
- Attempting `setMode()` again throws: `"Cannot change session mode after game start"`
- User must reload page to change modes

### 5.2 StandaloneDataManager Creation (LAZY)
**File:** `sessionModeManager.js:48`
```javascript
window.dataManager = window.dataManager || new StandaloneDataManager();
```
- Uses lazy initialization pattern
- Only creates instance if `window.dataManager` doesn't exist
- Subsequent selections won't create duplicate instances

### 5.3 Session Persistence
**File:** `standaloneDataManager.js:213`
```javascript
saveLocalSession() {
    localStorage.setItem('standaloneSession', JSON.stringify(this.sessionData));
}
```
- Every transaction adds to `this.sessionData.transactions`
- Every team score update modifies `this.sessionData.teams[teamId]`
- Must manually call `saveLocalSession()` after changes (called by `updateLocalScores()`)

### 5.4 Transaction Recording
**File:** `standaloneDataManager.js:26-33`
```javascript
addTransaction(transaction) {
    // Add to permanent local storage, not temporary queue
    this.sessionData.transactions.push(transaction);
    this.saveLocalSession();
    
    // Update local scores
    this.updateLocalScores(transaction);
}
```
- Adds transaction to session immediately
- Calls `saveLocalSession()` to persist to localStorage
- Calls `updateLocalScores()` to calculate scoring

---

## 6. DATA FLOW: FROM SCAN TO STORAGE

When user taps a token in standalone mode:

```
User scans token (NFC or manual entry)
    ↓
App.processNFCRead() (app.js:694)
    ↓
App.recordTransaction() (app.js:758)
    ↓
Check session mode: window.sessionModeManager.isStandalone() (app.js:813)
    ↓
DataManager.addTransaction(transaction) (app.js:810)
    └─ Adds to local DataManager
    ↓
Check if StandaloneDataManager exists: window.dataManager (app.js:816)
    ↓
If window.dataManager exists AND isStandalone():
    └─ window.dataManager.addTransaction(transaction) (app.js:817)
        ├─ Push to this.sessionData.transactions
        ├─ Call saveLocalSession()
        │   └─ localStorage.setItem('standaloneSession', JSON.stringify(...))
        └─ Call updateLocalScores()
            ├─ Calculate points from token
            ├─ Update team.baseScore
            ├─ Check group completion
            ├─ Update team.bonusPoints (if group complete)
            └─ Call saveLocalSession() again
```

---

## 7. UI SCREENS SHOWN DURING INITIALIZATION

| Step | Screen Shown | File Location | Duration |
|------|------------|---------------|----------|
| Initial | `loadingScreen` | index.html:1419 | Brief (100ms) |
| Phase 1C | `gameModeScreen` | index.html:1508 | Until mode selected |
| **User selects standalone** | → | → | → |
| Post-selection | `teamEntry` | index.html:1553 | Until team entered |
| After team entry | `scan` | index.html:1572 | Active scanning |

---

## 8. KEY FILES AND THEIR ROLES

| File | Primary Responsibility | Key Functions |
|------|------------------------|---------------|
| `index.html:1535` | UI trigger button | User interaction point |
| `app.js:119-133` | Route mode selection | Validation & delegation |
| `sessionModeManager.js:7-26` | Mode locking & persistence | Prevent mode switching, persist to localStorage |
| `sessionModeManager.js:44-51` | Standalone setup | Create StandaloneDataManager, show UI |
| `standaloneDataManager.js:8-20` | Session initialization | Create session data structure |
| `standaloneDataManager.js:216-235` | Session restoration | Load previous session from localStorage |
| `standaloneDataManager.js:26-33` | Transaction recording | Add transactions, save to localStorage |

---

## 9. LOCALSTORAGE KEYS USED

| Key | Scope | Purpose |
|-----|-------|---------|
| `gameSessionMode` | sessionModeManager | Stores selected mode ('networked' or 'standalone') |
| `standaloneSession` | StandaloneDataManager | Stores entire session data (transactions, teams, scores) |
| `transactions` | DataManager | Stores transaction history (also used by networked mode) |
| `scannedTokens` | DataManager | Stores Set of scanned token IDs (deduplication) |

---

## 10. WHAT DOES NOT HAPPEN IN STANDALONE MODE

Unlike networked mode, standalone mode:

- ❌ Does NOT create ConnectionManager
- ❌ Does NOT show connection wizard
- ❌ Does NOT authenticate with backend
- ❌ Does NOT establish WebSocket connection
- ❌ Does NOT create NetworkedQueueManager
- ❌ Does NOT create OrchestratorClient
- ❌ Does NOT broadcast to other devices
- ❌ Does NOT sync scores with backend
- ❌ Does NOT support admin panel (no backend to control)
- ❌ Does NOT support video playback (no VLC integration)

---

## 11. ERROR SCENARIOS

### Scenario A: SessionModeManager not initialized
```javascript
if (!window.sessionModeManager) {
    console.error('SessionModeManager not initialized');
    UIManager.showError('System error: SessionModeManager not initialized. Please reload the page.');
    return;  // Exit early
}
```
**Resolution:** Reload page (sessionModeManager created during app init)

### Scenario B: Mode already locked (rare)
```javascript
if (this.locked) {
    throw new Error('Cannot change session mode after game start');
}
```
**Resolution:** Reload page to reset mode

### Scenario C: Previous session corrupted
```javascript
catch (error) {
    console.error('Failed to load previous session:', error);
    // Continues with fresh sessionData
}
```
**Resolution:** Starts fresh session, old data lost (not recoverable)

---

## 12. INITIALIZATION TIMING

**From click to ready state:**

1. **0ms**: User clicks button
2. **<1ms**: `App.selectGameMode('standalone')` called
3. **<1ms**: `SessionModeManager.setMode('standalone')` called
4. **<1ms**: `SessionModeManager.initStandaloneMode()` called
5. **<1ms**: `new StandaloneDataManager()` instantiated
6. **0-10ms**: `loadLocalSession()` retrieves localStorage
7. **<1ms**: `UIManager.showScreen('teamEntry')` called
8. **~100ms**: Screen rendered and visible to user

**Total time to interactive:** ~100-200ms

---

## 13. DEBUG COMMANDS

To verify standalone mode initialization:

```javascript
// Check mode is set and locked
console.log(window.sessionModeManager.mode);      // 'standalone'
console.log(window.sessionModeManager.locked);    // true

// Check StandaloneDataManager exists
console.log(window.dataManager);                  // StandaloneDataManager instance
console.log(window.dataManager.sessionData);      // Session data object

// View stored session data
console.log(localStorage.getItem('standaloneSession'));

// Check current team scores
console.log(window.dataManager.sessionData.teams);

// View transactions
console.log(window.dataManager.sessionData.transactions);
```

---

## SUMMARY

The complete initialization flow for standalone mode:

1. **User Action**: Clicks "Standalone Game" button (HTML onclick event)
2. **Routing**: `App.selectGameMode('standalone')` validates and delegates
3. **Mode Selection**: `SessionModeManager.setMode('standalone')` locks mode and persists
4. **Initialization**: `SessionModeManager.initStandaloneMode()` creates data manager
5. **Data Manager**: `new StandaloneDataManager()` initializes session data
6. **Session Restoration**: `loadLocalSession()` optionally restores previous session
7. **UI Transition**: Shows team entry screen with numeric keypad
8. **Ready**: User can now enter team ID and begin scanning

The StandaloneDataManager is fully initialized and ready to accept transactions from the moment the user selects standalone mode.

