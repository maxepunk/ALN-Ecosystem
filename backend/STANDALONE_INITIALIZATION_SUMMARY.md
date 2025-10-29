# Standalone Mode Initialization - Quick Reference

## The Complete Call Chain (Visual)

```
┌─────────────────────────────────────────────────────────────────┐
│ USER CLICKS "Standalone Game" Button                             │
│ (index.html:1535)                                               │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│ App.selectGameMode('standalone')                                 │
│ (app.js:119-133)                                                │
│                                                                  │
│ • Validate: window.sessionModeManager exists                    │
│ • Call: window.sessionModeManager.setMode('standalone')         │
│ • Catch: Error handling with UIManager.showError()              │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│ SessionModeManager.setMode('standalone')                         │
│ (sessionModeManager.js:7-26)                                    │
│                                                                  │
│ • Check: if (this.locked) throw Error                           │
│ • Validate: if mode not valid throw Error                       │
│ • Set: this.mode = 'standalone'                                 │
│ • Lock: this.locked = true [PERMANENT]                          │
│ • Persist: localStorage.setItem('gameSessionMode', mode)        │
│ • Branch: if mode === 'networked' ? No → else                   │
│ • Dispatch: this.initStandaloneMode()                           │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│ SessionModeManager.initStandaloneMode()                          │
│ (sessionModeManager.js:44-51)                                   │
│                                                                  │
│ • Log: 'Initializing standalone mode...'                        │
│ • Create: window.dataManager = new StandaloneDataManager()      │
│   (Only if not already created - lazy initialization)           │
│ • Transition: UIManager.showScreen('teamEntry')                 │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│ StandaloneDataManager.constructor()                              │
│ (standaloneDataManager.js:8-20)                                 │
│                                                                  │
│ Initialize this.sessionData:                                    │
│ • sessionId: LOCAL_${timestamp}_${random}                       │
│ • startTime: new Date().toISOString()                           │
│ • transactions: []                                              │
│ • teams: {}                                                     │
│ • mode: 'standalone'                                            │
│                                                                  │
│ • Call: this.loadLocalSession()                                 │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│ StandaloneDataManager.loadLocalSession()                         │
│ (standaloneDataManager.js:216-235)                              │
│                                                                  │
│ • Retrieve: localStorage.getItem('standaloneSession')           │
│ • If found:                                                     │
│   • Parse JSON                                                  │
│   • Check date: Is session from today?                          │
│   • If YES: Restore this.sessionData = parsed                   │
│   • If NO: Keep fresh sessionData                               │
│ • If error: Continue with fresh sessionData                     │
│                                                                  │
│ [Constructor completes]                                         │
│ • Assign: window.dataManager (global reference)                 │
│ • UI: UIManager.showScreen('teamEntry')                         │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
        ┌─────────────────────────────────────┐
        │ READY FOR USER INPUT                │
        │ (Team Entry Screen Displayed)       │
        │                                     │
        │ User can now enter team ID and      │
        │ begin scanning tokens               │
        └─────────────────────────────────────┘
```

---

## Key Functions and Their File:Line References

### 1. User Interaction Point
- **File:** `/home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/ALNScanner/index.html`
- **Line:** 1535
- **Element:** `<button onclick="App.selectGameMode('standalone')">`
- **Trigger:** User clicks "Standalone Game" button

### 2. Mode Selection Routing
- **File:** `/home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/ALNScanner/js/app/app.js`
- **Lines:** 119-133
- **Function:** `App.selectGameMode(mode)`
- **Purpose:** Route mode selection to SessionModeManager, validate SessionModeManager exists

### 3. Mode Locking & Initialization Dispatch
- **File:** `/home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/ALNScanner/js/app/sessionModeManager.js`
- **Lines:** 7-26
- **Function:** `SessionModeManager.setMode(mode)`
- **Purpose:** Lock mode selection, persist to localStorage, dispatch to initStandaloneMode()
- **Critical:** Sets `this.locked = true` - mode cannot change after this

### 4. Standalone Mode Setup
- **File:** `/home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/ALNScanner/js/app/sessionModeManager.js`
- **Lines:** 44-51
- **Function:** `SessionModeManager.initStandaloneMode()`
- **Purpose:** Create StandaloneDataManager, transition to team entry screen
- **Creates:** `window.dataManager` (global reference to data manager)

### 5. Session Data Initialization
- **File:** `/home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/ALNScanner/js/core/standaloneDataManager.js`
- **Lines:** 8-20
- **Function:** `StandaloneDataManager.constructor()`
- **Purpose:** Initialize session structure, call loadLocalSession() to restore previous session
- **Creates:** this.sessionData object with sessionId, startTime, transactions, teams

### 6. Session Restoration (Optional)
- **File:** `/home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/ALNScanner/js/core/standaloneDataManager.js`
- **Lines:** 216-235
- **Function:** `StandaloneDataManager.loadLocalSession()`
- **Purpose:** Restore previous session from localStorage if from same day
- **Check:** Session date matching (same calendar day only)

---

## Data Structures Created

### sessionModeManager State
```javascript
{
  mode: 'standalone',           // Selected mode
  locked: true                  // Cannot change mode now
}
```

### Stored in localStorage
```javascript
// sessionModeManager persistence
localStorage['gameSessionMode'] = 'standalone'

// StandaloneDataManager persistence (if available)
localStorage['standaloneSession'] = JSON.stringify({
  sessionId: 'LOCAL_1234567890_abc123def',
  startTime: '2024-10-28T12:34:56.789Z',
  transactions: [/*...*/],
  teams: {},
  mode: 'standalone'
})
```

### window.dataManager Object
```javascript
window.dataManager = {
  sessionData: {
    sessionId: 'LOCAL_...',
    startTime: '2024-10-28T...',
    transactions: [],
    teams: {}
  },
  addTransaction(tx) { /* ... */ },
  updateLocalScores(tx) { /* ... */ },
  getTeamScores() { /* ... */ },
  // ... more methods
}
```

---

## Timing Breakdown

| Step | Duration | Cumulative |
|------|----------|-----------|
| User clicks button | - | 0ms |
| selectGameMode() execution | <1ms | <1ms |
| setMode() validation & lock | <1ms | <1ms |
| initStandaloneMode() call | <1ms | <1ms |
| StandaloneDataManager creation | <1ms | <1ms |
| loadLocalSession() localStorage read | 0-10ms | 0-10ms |
| showScreen('teamEntry') | <1ms | <1ms |
| Browser paint & render | ~100-150ms | ~100-160ms |
| **User sees team entry screen** | | **~100-160ms** |

---

## Critical Points to Remember

### 1. Mode is Locked PERMANENTLY
Once `setMode()` is called, `this.locked = true`. Any attempt to call `setMode()` again will throw an error. User must reload page to change modes.

### 2. StandaloneDataManager is Created Immediately
The data manager is created synchronously (not async), so it's ready for transactions immediately after mode selection.

### 3. Session May Be Restored
If there's a saved session from today, `loadLocalSession()` will restore it. This allows continuing a session across page reloads.

### 4. Session is NOT Connected to Network
StandaloneDataManager operates entirely offline. There is no:
- ConnectionManager
- WebSocket connection
- Backend synchronization
- Admin panel (no orchestrator to control)
- Video playback (no VLC integration)

### 5. Lazy Initialization
```javascript
window.dataManager = window.dataManager || new StandaloneDataManager();
```
Uses logical OR to create only if not already created. Prevents duplicate instances.

---

## Complete Initialization Checklist

After selecting standalone mode, the following are initialized:

- [x] SessionModeManager.mode = 'standalone'
- [x] SessionModeManager.locked = true
- [x] localStorage['gameSessionMode'] = 'standalone'
- [x] window.dataManager = StandaloneDataManager instance
- [x] window.dataManager.sessionData = {...}
- [x] localStorage['standaloneSession'] = JSON.stringify(sessionData) [optional if restoring]
- [x] UIManager.showScreen('teamEntry')
- [ ] ConnectionManager (NOT created)
- [ ] OrchestratorClient (NOT created)
- [ ] NetworkedQueueManager (NOT created)
- [ ] WebSocket connection (NOT created)

---

## Error Handling

### If SessionModeManager not initialized
```
ERROR: 'System error: SessionModeManager not initialized. Please reload the page.'
RESOLUTION: Reload page
```

### If mode already locked
```
ERROR: 'Cannot change session mode after game start'
RESOLUTION: User must reload page to change modes
```

### If previous session corrupted
```
ERROR: 'Failed to load previous session: [error]'
RESOLUTION: Continues with fresh sessionData (old data lost)
```

---

## How to Debug

```javascript
// Check mode selection worked
console.log(window.sessionModeManager.mode);        // Should be 'standalone'
console.log(window.sessionModeManager.locked);      // Should be true

// Check data manager created
console.log(window.dataManager);                    // Should be StandaloneDataManager instance
console.log(window.dataManager instanceof StandaloneDataManager); // true

// Check session data
console.log(window.dataManager.sessionData);        // Session object
console.log(window.dataManager.sessionData.sessionId); // LOCAL_...

// Check localStorage persistence
console.log(localStorage.getItem('gameSessionMode')); // 'standalone'
console.log(localStorage.getItem('standaloneSession')); // JSON string or null

// Verify screen transitioned
console.log(document.getElementById('teamEntryScreen').classList.contains('active')); // true
```

---

## What Happens Next

After initialization completes and team entry screen is shown:

1. **User enters team ID:** Calls `App.confirmTeamId()`
2. **Team confirmed:** Transitions to scan screen with `UIManager.showScreen('scan')`
3. **User scans token:** Calls `App.startScan()` → NFC reading or manual entry
4. **Token processed:** Calls `App.recordTransaction()` → `DataManager.addTransaction()` → `window.dataManager.addTransaction()`
5. **Transaction stored:** Saved to localStorage and displayed in UI
6. **Scoring calculated:** `StandaloneDataManager.updateLocalScores()` calculates points and bonuses
7. **UI updates:** Transaction result displayed with scoring information

---

## File Organization

```
ALNScanner/
├── index.html                           [Button at line 1535]
└── js/
    ├── app/
    │   ├── app.js                       [selectGameMode() at line 119]
    │   ├── sessionModeManager.js        [setMode() at line 7, initStandaloneMode() at line 44]
    │   └── initializationSteps.js       [Called during app startup]
    └── core/
        └── standaloneDataManager.js     [Constructor at line 8, loadLocalSession() at line 216]
```

