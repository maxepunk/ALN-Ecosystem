# ALNScanner Standalone Mode Initialization Trace - Complete Documentation

## Overview

This directory contains comprehensive documentation of the complete initialization flow for standalone mode selection in ALNScanner. These documents trace every step from the user clicking the "Standalone Game" button through to the StandaloneDataManager being fully initialized and ready to accept transactions.

---

## Documents in This Index

### 1. STANDALONE_INITIALIZATION_SUMMARY.md (Quick Reference)
**Purpose:** Visual flowchart and quick-lookup reference  
**Length:** 313 lines / 15KB  
**Best for:** Understanding the overall flow at a glance, debugging, quick reference

**Contains:**
- ASCII flowchart showing complete call chain
- File:line references for each function
- Data structures created
- Timing breakdown
- Critical points to remember
- Error handling scenarios
- Debug commands
- What happens next

**When to use:**
- Need a visual understanding of the flow
- Looking for a specific file:line reference
- Debugging initialization issues
- Quick verification of what gets initialized

---

### 2. STANDALONE_MODE_INITIALIZATION_TRACE.md (Complete Technical Reference)
**Purpose:** Deep technical reference with full code snippets  
**Length:** 469 lines / 17KB  
**Best for:** Detailed understanding, code review, implementation reference

**Contains:**
- Complete call stack with code snippets at each level
- Detailed explanation of what each function does
- Step-by-step initialization process
- Data flow from scan to storage
- UI screens shown during initialization
- Key files and their roles
- localStorage keys used
- What does NOT happen in standalone mode
- Error scenarios with resolutions
- Initialization timing details
- Complete debug commands
- Summary and architecture overview

**When to use:**
- Implementing new standalone features
- Debugging complex initialization issues
- Code review of mode selection logic
- Understanding data persistence
- Learning the architecture

---

## The Complete Call Stack (Summary)

```
User clicks "Standalone Game" (index.html:1535)
    ↓
App.selectGameMode('standalone') (app.js:119-133)
    ↓
SessionModeManager.setMode('standalone') (sessionModeManager.js:7-26)
    ├─ Lock mode: this.locked = true
    ├─ Persist: localStorage.setItem('gameSessionMode', 'standalone')
    └─ Dispatch: this.initStandaloneMode()
    ↓
SessionModeManager.initStandaloneMode() (sessionModeManager.js:44-51)
    ├─ Create: window.dataManager = new StandaloneDataManager()
    └─ UI: UIManager.showScreen('teamEntry')
    ↓
StandaloneDataManager.constructor() (standaloneDataManager.js:8-20)
    ├─ Initialize: this.sessionData = {...}
    └─ Call: this.loadLocalSession()
    ↓
StandaloneDataManager.loadLocalSession() (standaloneDataManager.js:216-235)
    ├─ Retrieve: localStorage.getItem('standaloneSession')
    ├─ Restore session if from today
    └─ Keep fresh if missing or from different day
    ↓
User sees team entry screen (ready for input)
```

---

## Key File Locations

| File | Purpose | Key Functions |
|------|---------|---------------|
| `index.html:1535` | User interaction button | Click triggers `App.selectGameMode('standalone')` |
| `js/app/app.js:119-133` | Mode selection routing | `selectGameMode()` validates and delegates |
| `js/app/sessionModeManager.js:7-26` | Mode locking | `setMode()` locks mode, persists to localStorage |
| `js/app/sessionModeManager.js:44-51` | Standalone setup | `initStandaloneMode()` creates StandaloneDataManager |
| `js/core/standaloneDataManager.js:8-20` | Session initialization | Constructor initializes session data |
| `js/core/standaloneDataManager.js:216-235` | Session restoration | `loadLocalSession()` restores from localStorage |

---

## Critical Concepts

### 1. Mode Locking
Once `SessionModeManager.setMode('standalone')` is called:
- `this.locked = true`
- Mode cannot be changed until page reload
- Prevents accidental switching during gameplay

### 2. StandaloneDataManager Creation
- Created synchronously (not async)
- Uses lazy initialization: `window.dataManager || new StandaloneDataManager()`
- Prevents duplicate instances
- Ready immediately for transactions

### 3. Session Persistence
- Previous session restored from localStorage if from same day
- Session ID generated: `LOCAL_${timestamp}_${random}`
- All transactions saved to localStorage
- Session survives page reloads on same day

### 4. No Network Features
Standalone mode does NOT have:
- ConnectionManager
- WebSocket connection
- Backend synchronization
- Admin panel
- Video playback

### 5. Timing
Total time from click to ready state: **~100-160ms**
- Most time is browser rendering (~100-150ms)
- Actual JavaScript execution: <10ms

---

## How to Use These Documents

### For Understanding the Architecture
1. Start with: **STANDALONE_INITIALIZATION_SUMMARY.md** Section "The Complete Call Chain (Visual)"
2. Read: ASCII flowchart to see the overall structure
3. Deep dive: **STANDALONE_MODE_INITIALIZATION_TRACE.md** Section "2. CALL STACK TRACE" for detailed code

### For Debugging Initialization Issues
1. Check: **STANDALONE_INITIALIZATION_SUMMARY.md** Section "How to Debug"
2. Run: Console commands to verify each initialization step
3. Reference: **STANDALONE_MODE_INITIALIZATION_TRACE.md** Section "11. ERROR SCENARIOS"

### For Implementing New Features
1. Read: **STANDALONE_MODE_INITIALIZATION_TRACE.md** Section "3. STANDALONEDATA MANAGER INITIALIZATION"
2. Understand: Data structures and initialization order
3. Check: Section "6. DATA FLOW: FROM SCAN TO STORAGE" for transaction handling

### For Code Review
1. Review: **STANDALONE_INITIALIZATION_SUMMARY.md** "Key Functions and Their File:Line References"
2. Check: All file:line references match your codebase
3. Verify: Data structures in Section "Data Structures Created"

---

## Quick Reference: File:Line Locations

To jump directly to code:

```
index.html:1535                    "Standalone Game" button
js/app/app.js:119-133             App.selectGameMode()
js/app/sessionModeManager.js:7-26  SessionModeManager.setMode()
js/app/sessionModeManager.js:44-51 SessionModeManager.initStandaloneMode()
js/core/standaloneDataManager.js:8-20 StandaloneDataManager.constructor()
js/core/standaloneDataManager.js:216-235 StandaloneDataManager.loadLocalSession()
```

---

## Related Documentation

For context on the broader ALNScanner architecture, see:
- `ALNScanner/CLAUDE.md` - Overall ALNScanner architecture
- `ALNScanner/DOCUMENTATION_INDEX.md` - UI documentation index
- `ALNScanner/UI_STRUCTURE_MAP.md` - Screen and UI details
- `ALNScanner/SCREEN_FLOW_DIAGRAMS.md` - Complete transition diagrams

---

## Questions This Documentation Answers

### "What function handles standalone mode selection?"
**Answer:** `SessionModeManager.setMode('standalone')` (sessionModeManager.js:7-26)

### "What gets initialized during standalone mode setup?"
**Answer:** `StandaloneDataManager` instance with sessionData structure containing transactions, teams, and metadata

### "Is StandaloneDataManager created at this point?"
**Answer:** Yes, immediately in `SessionModeManager.initStandaloneMode()` (sessionModeManager.js:48)

### "What is the COMPLETE call stack?"
**Answer:** See "The Complete Call Stack (Summary)" section above, or detailed version in STANDALONE_MODE_INITIALIZATION_TRACE.md

### "How long does initialization take?"
**Answer:** ~100-160ms total (most is browser rendering), <10ms for actual JavaScript

### "What localStorage keys are used?"
**Answer:** 
- `gameSessionMode` - mode selection
- `standaloneSession` - session data

### "What does NOT happen in standalone mode?"
**Answer:** No network connection, no backend, no admin panel, no video playback

---

## Version Information

- **Created:** October 28, 2024
- **Covers:** ALNScanner standalone mode initialization flow
- **Applies to:** Current ALNScanner implementation with SessionModeManager and StandaloneDataManager

---

## How to Keep This Documentation Updated

When making changes to the initialization flow:

1. **Modified SessionModeManager:** Update file:line references in both documents
2. **Added new initialization step:** Add to flowchart in SUMMARY.md and detail to TRACE.md
3. **Changed StandaloneDataManager constructor:** Update code snippets in both documents
4. **Modified localStorage keys:** Update tables in both documents
5. **Changed timing characteristics:** Update timing breakdown section

---

## Index of All Sections

### STANDALONE_INITIALIZATION_SUMMARY.md
1. The Complete Call Chain (Visual)
2. Key Functions and Their File:Line References
3. Data Structures Created
4. Timing Breakdown
5. Critical Points to Remember
6. Complete Initialization Checklist
7. Error Handling
8. How to Debug
9. What Happens Next
10. File Organization

### STANDALONE_MODE_INITIALIZATION_TRACE.md
1. User Action: Clicks Button
2. Call Stack Trace (6 levels)
3. StandaloneDataManager Initialization
4. Complete Call Stack Summary
5. Critical Initialization Points
6. Data Flow: From Scan to Storage
7. UI Screens During Initialization
8. Key Files and Their Roles
9. localStorage Keys Used
10. What Does Not Happen
11. Error Scenarios
12. Initialization Timing
13. Debug Commands
14. Summary

---

## Quick Links

- **Start here:** STANDALONE_INITIALIZATION_SUMMARY.md
- **Need details:** STANDALONE_MODE_INITIALIZATION_TRACE.md
- **Visual learner:** Look for the ASCII flowchart in SUMMARY.md
- **Debugging:** Search for "How to Debug" in SUMMARY.md

