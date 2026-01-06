# GM Scanner Architecture Refactoring Plan

**Status:** Phase 2 Complete
**Created:** 2025-01-05
**Last Updated:** 2025-01-05

## Executive Summary

This document outlines a comprehensive refactoring plan for the ALN GM Scanner to address DRY/SOLID violations while achieving feature parity between Standalone and Networked deployment modes. The plan also documents deprecated code for removal and identifies opportunities to leverage rich Notion metadata for future detective mode enhancements.

### Completion Status

| Phase | Description | Status |
|-------|-------------|--------|
| **Phase 1** | Foundation (Scoring DRY, deprecated code, summary display) | ✅ **COMPLETE** |
| **Phase 2** | Unification (Strategy pattern, unified DataManager) | ✅ **COMPLETE** |
| Phase 3 | Admin Parity (Command executor, standalone admin) | 🔲 Not started |
| Phase 4 | Future Prep (Notion metadata, detective enhancements) | 🔲 Not started |

---

## Table of Contents

1. [Completed Work Summary](#completed-work-summary)
2. [Current Architecture Analysis](#current-architecture-analysis)
3. [Deployment Mode Context](#deployment-mode-context)
4. [Remaining DRY Violations](#remaining-dry-violations)
5. [SOLID Violations Analysis](#solid-violations-analysis)
6. [Notion Metadata Gap Analysis](#notion-metadata-gap-analysis)
7. [Detective Mode: Current vs Future](#detective-mode-current-vs-future)
8. [Proposed Architecture (Phases 2-4)](#proposed-architecture-phases-2-4)
9. [Implementation Phases](#implementation-phases)
10. [Risk Assessment](#risk-assessment)

---

## Completed Work Summary

### Phase 1.1: Shared Scoring Configuration ✅

**Problem Solved:** Scoring values were duplicated in 3 locations with potential drift.

**Solution Implemented:**
- Created `ALN-TokenData/scoring-config.json` as single source of truth
- Backend loads config at startup (`backend/src/config/index.js:13-25`)
- Frontend imports at build time (`ALNScanner/src/core/scoring.js:12`)
- Both now use identical values with env var override capability

**Files Changed:**
| File | Change |
|------|--------|
| `ALN-TokenData/scoring-config.json` | Created - single source of truth |
| `backend/src/config/index.js` | Added shared config loading (+15 lines) |
| `backend/src/services/tokenService.js` | Fixed UNKNOWN type handling |
| `ALNScanner/src/core/scoring.js` | Now imports from shared config |

**Tests Added:**
- `backend/tests/unit/services/scoring-config.test.js` (4 tests)
- `ALNScanner/tests/unit/core/scoring-config.test.js` (5 tests)

### Phase 1.2: Deprecated Code Removal ✅

**Problem Solved:** `detectiveValue` accumulated star ratings for detective mode, but detective mode has no scoring.

**Solution Implemented:**
- Removed all `detectiveValue` accumulation from `dataManager.js`
- Removed all `detectiveValue` accumulation from `standaloneDataManager.js`
- Verified no UI references (uiManager.js never displayed it)

**Verification:** `grep -r "detectiveValue" ALNScanner/src/` returns 0 matches.

### Phase 1.3: Summary Display in All Modes ✅

**Problem Solved:** Token summary (intel) only displayed in detective mode result cards.

**Solution Implemented:**
- Result screen now shows summary for ALL modes (`uiManager.js:820-826`)
- Game Activity already displayed summaries correctly (no change needed)
- Removed dead code: `renderTransactions()` and `filterTransactions()` (~84 lines)
- Updated all documentation referencing removed methods

**Files Changed:**
| File | Change |
|------|--------|
| `src/ui/uiManager.js` | Removed mode check, removed dead code (-84 lines) |
| `CLAUDE.md` | Updated examples |
| `src/ui/ScreenUpdateManager.js` | Updated JSDoc example |
| `docs/PLAYWRIGHT_TESTING_GUIDE.md` | Updated 5 references |

### Bug Fixes During Phase 1

**UNKNOWN Type Multiplier Alignment:**
- **Issue:** Frontend fell back to `|| 1` for unknown types, backend used `|| 0`
- **Fix:** Frontend now uses `SCORING_CONFIG.TYPE_MULTIPLIERS.UNKNOWN ?? 0`
- **Impact:** Unknown tokens now consistently score 0 in both modes (security fix)

---

## Current Architecture Analysis

### File Inventory (Updated After Phase 2)

| File | Lines | Purpose | Status |
|------|-------|---------|--------|
| `ALNScanner/src/core/unifiedDataManager.js` | 432 | **NEW** Unified data manager | Phase 2 |
| `ALNScanner/src/core/storage/IStorageStrategy.js` | 161 | **NEW** Interface contract | Phase 2 |
| `ALNScanner/src/core/storage/LocalStorage.js` | 505 | **NEW** Standalone strategy | Phase 2 |
| `ALNScanner/src/core/storage/NetworkedStorage.js` | 421 | **NEW** Networked strategy | Phase 2 |
| `ALNScanner/src/core/dataManagerUtils.js` | ~50 | **NEW** Shared utilities | Phase 2 |
| `ALNScanner/src/core/dataManager.js` | 1050 | Legacy (kept for reference) | Superseded |
| `ALNScanner/src/core/standaloneDataManager.js` | 727 | Legacy (kept for tests) | Superseded |
| `ALNScanner/src/core/scoring.js` | 104 | Scoring calculations | Phase 1 |
| `ALNScanner/src/ui/uiManager.js` | ~950 | UI management | Phase 2 updated |
| `backend/src/config/index.js` | 177 | Backend configuration | Phase 1 |

**Total Duplicated Logic:** ~~400+ lines~~ → **Eliminated** via strategy pattern

### Consumer Dependency Map

#### DataManager (Networked) Consumers

```
dataManager.js
├── src/main.js:46 - imports DataManager
├── src/ui/uiManager.js:26 - UIManager constructor
├── src/ui/uiManager.js:199 - _getDataSource() returns it
├── src/scanner/scanProcessor.js:103 - getDataSource() references
├── src/admin/SessionManager.js - session state queries
├── src/admin/AdminOperations.js - transaction operations
└── src/admin/MonitoringDisplay.js - game activity display
```

#### StandaloneDataManager Consumers

```
standaloneDataManager.js
├── src/main.js:47 - imports StandaloneDataManager
├── src/ui/uiManager.js:27 - imports StandaloneDataManager
├── src/ui/uiManager.js:199 - _getDataSource() returns it
├── src/scanner/scanProcessor.js - via getDataSource()
└── src/admin/SessionManager.js:29 - imports (unused?)
```

#### scoring.js Consumers

```
scoring.js
├── standaloneDataManager.js:11 - imports SCORING_CONFIG, calculateTokenValue
├── standaloneDataManager.js:418-471 - group completion logic
└── (No other direct consumers - networked mode uses backend)
```

---

## Deployment Mode Context

### Key Insight

> "GM scanner may run standalone without orchestrator backend, but orchestrator backend will never run without at least one GM scanner running alongside it in networked deployment."

This means scoring configuration can flow FROM the GM Scanner package TO the backend, not vice versa.

### Deployment Scenarios

| Scenario | GM Scanners | Backend | Data Authority |
|----------|-------------|---------|----------------|
| Small Event | 1-2 | None | Local (each GM independent) |
| Standard Event | 2+ | Yes | Backend (real-time sync) |
| A/V Event | 2+ | Yes + VLC | Backend + Video |

### Mode Detection (Current)

```javascript
// Player Scanner Web
const pathname = window.location.pathname;
this.isStandalone = !pathname.startsWith('/player-scanner/');

// GM Scanner
// User selects at startup, locked for session duration
```

### Feature Parity Requirements

| Feature | Networked | Standalone (Current) | Standalone (Target) |
|---------|-----------|---------------------|---------------------|
| Token Scanning | ✅ | ✅ | ✅ |
| Team Management | ✅ | ✅ | ✅ |
| Transaction Logging | ✅ | ✅ | ✅ |
| Score Calculation | Backend | Local | Local |
| Group Bonuses | Backend | Local | Local |
| Score Adjustments | ✅ | ❌ | ✅ |
| Score Reset | ✅ | ❌ | ✅ |
| Transaction Deletion | ✅ | ❌ | ✅ |
| Game Activity View | ✅ | ❌ | ✅ |
| Session Create/End | ✅ | ❌ | ✅ |
| Video Control | ✅ | N/A | N/A |
| Display Control | ✅ | N/A | N/A |

---

## Remaining DRY Violations

### ~~1. Scoring Configuration (3 Locations)~~ ✅ RESOLVED

**Status:** Fixed in Phase 1.1

Single source of truth now at `ALN-TokenData/scoring-config.json`:
```json
{
  "version": "1.0",
  "baseValues": {
    "1": 10000, "2": 25000, "3": 50000, "4": 75000, "5": 150000
  },
  "typeMultipliers": {
    "Personal": 1, "Business": 3, "Technical": 5, "UNKNOWN": 0
  }
}
```

### ~~2. DataManager Method Duplication (~400 LOC)~~ ✅ RESOLVED

**Status:** Fixed in Phase 2

Unified into single `UnifiedDataManager` with strategy pattern:
- Common methods extracted to `DataManagerUtils.js`
- `IStorageStrategy` interface defines contract
- `LocalStorage` and `NetworkedStorage` implement strategies
- All methods now available in both modes via delegation

| Method | UnifiedDataManager | Notes |
|--------|-------------------|-------|
| `isTokenScanned()` | ✅ Delegates to DataManagerUtils | |
| `markTokenAsScanned()` | ✅ Delegates to DataManagerUtils | |
| `getTeamScores()` | ✅ Delegates to strategy | |
| `getEnhancedTeamTransactions()` | ✅ Delegates to strategy | |
| `adjustTeamScore()` | ✅ Delegates to strategy | Now in both modes |
| `getGameActivity()` | ✅ Delegates to strategy | Now in both modes |

### ~~3. Group Completion Logic (2 Locations)~~ ✅ RESOLVED

**Status:** Fixed in Phase 2

Group completion logic now consolidated:
- `LocalStorage.js` implements group completion for standalone mode
- Uses shared `scoring.js` for calculations
- Backend still handles networked mode (authoritative)

**Standalone Implementation:**
```javascript
// ALNScanner/src/core/storage/LocalStorage.js:270-330
// Group bonus detection using shared scoring config
```

---

## SOLID Violations Analysis

### Single Responsibility Principle (SRP) - ✅ IMPROVED

**Original Violation:** DataManager handles too many concerns (1050 lines)

**Phase 2 Fix:**
- `UnifiedDataManager` (432 LOC) - orchestration and public API
- `IStorageStrategy` (161 LOC) - interface contract
- `LocalStorage` (505 LOC) - standalone persistence
- `NetworkedStorage` (421 LOC) - WebSocket communication
- `DataManagerUtils` - shared utility methods
- `scoring.js` - calculation logic

### Open/Closed Principle (OCP) - ✅ FIXED

**Original Violation:** Adding standalone admin features requires modifying StandaloneDataManager directly.

**Phase 2 Fix:** Strategy pattern allows new storage backends without modifying UnifiedDataManager. New strategies implement `IStorageStrategy` interface.

### Liskov Substitution Principle (LSP) - ✅ FIXED

**Original Violation:** DataManager and StandaloneDataManager have different APIs.

**Phase 2 Fix:** Both `LocalStorage` and `NetworkedStorage` implement identical `IStorageStrategy` interface:
- ✅ `adjustTeamScore()` - now in both
- ✅ `getGameActivity()` - now in both
- ✅ Consistent event emission patterns

### Interface Segregation Principle (ISP) - ⚠️ PARTIALLY ADDRESSED

**Original Violation:** Consumers import entire manager.

**Phase 2 Status:** `IStorageStrategy` defines focused interface. Future work could further segregate into `ITransactionStorage`, `ITeamStorage`, etc.

### Dependency Inversion Principle (DIP) - ✅ FIXED

**Original Violation:** High-level modules depend on concrete DataManager implementations.

**Phase 2 Fix:**
- `UnifiedDataManager` depends on `IStorageStrategy` abstraction
- Consumers depend on `UnifiedDataManager` interface, not concrete strategies
- Strategy selected at runtime based on mode

---

## ~~Deprecated Code Removal~~ ✅ COMPLETE

### ~~Detective Mode Star Scoring~~ ✅ REMOVED

The cumulative star scoring system for detective mode has been **completely removed**. Detective mode is about content organization, NOT scoring.

**Verification:**
```bash
$ grep -r "detectiveValue" ALNScanner/src/
# Returns 0 matches
```

**Removed From:**
- `dataManager.js` - getGlobalStats() no longer calculates detectiveValue
- `standaloneDataManager.js` - getGlobalStats() no longer calculates detectiveValue
- Tests updated to expect `detectiveValue` to be undefined

---

## Notion Metadata Gap Analysis

### Source of Truth: Notion Elements Database

The Notion Elements database contains rich metadata that is only partially synced to `tokens.json`.

### Currently Synced (via sync_notion_to_tokens.py)

| Field | Notion Property | tokens.json Key |
|-------|-----------------|-----------------|
| Token ID | Name (parsed) | `SF_RFID` |
| Star Rating | Description (parsed) | `SF_ValueRating` |
| Memory Type | Description (parsed) | `SF_MemoryType` |
| Group | Description (parsed) | `SF_Group` |
| Summary | Description (parsed) | `summary` |
| Image | Files & media | `image` |
| Audio | Files & media | `audio` |
| Video | Files & media | `video` |

### NOT Currently Synced (Available in Notion)

| Field | Notion Property | Potential Use |
|-------|-----------------|---------------|
| **Owner** | Relation → Characters | "Whose memory is this?" |
| **Narrative Threads** | Multi-select (14 options) | Detective mode grouping |
| **Timeline Event** | Relation → Timeline | Chronological organization |
| **Required For** | Relation → Puzzles | Puzzle dependency hints |
| **Rewarded by** | Relation → Puzzles | Source puzzle context |
| **Container Puzzle** | Relation → Puzzles | Physical location context |
| **First Available** | Select (Act 1/2/3) | Progressive reveal |
| **Critical Path** | Checkbox | Priority highlighting |
| **Location Found** | Text | Physical game context |

### Narrative Threads (14 Categories)

```
- Funding & Espionage
- Legacy & Succession
- Murder Timeline
- Criminal Enterprise
- Corporate Dealings
- Family Secrets
- Tech & Security
- Relationships
- Personal Struggles
- Political Connections
- Evidence Trail
- Character Development
- Red Herrings
- Background Lore
```

### Detective Mode Opportunities

This rich metadata could power intelligent detective mode organization:

1. **Character Grouping:** "All of Marcus's memories" or "Memories involving Victoria"
2. **Thread-Based Views:** "Show all Murder Timeline evidence"
3. **Chronological Display:** Timeline event ordering
4. **Act-Based Reveals:** Show only Act 1 tokens initially
5. **Critical Path Highlights:** Emphasize must-find tokens

---

## Detective Mode: Current vs Future

### Current Implementation ✅ Updated in Phase 1.3

Detective mode transactions:
1. Store token reference with `mode: 'detective'`
2. Display on scoreboard "Classified Evidence Terminal"
3. **Show summary text to GMs in ALL modes** (Phase 1.3 change)
4. **No scoring** (points always 0)

**Key Files:**
- `backend/src/services/transactionService.js:176-192` - Points = 0 for detective
- `backend/public/scoreboard.html:1096` - Filters `mode === 'detective'`
- `ALNScanner/src/ui/uiManager.js:820-826` - Summary display in ALL modes

### Future Vision (Per User Feedback)

> "The detective mode logic is going to (in the future) be much more involved in the backend logic to intelligently group/cycle through/organize and display the exposed token summaries in the scoreboard display."

**Planned Capabilities:**
- Intelligent grouping by Narrative Thread
- Character-based organization
- Timeline-ordered display
- Cycling through evidence categories
- Priority highlighting of Critical Path items

### ~~Summary Display Enhancement~~ ✅ COMPLETE

**Before Phase 1.3:** Summary only shown for detective mode transactions

**After Phase 1.3:** Summary displays in BOTH modes:
- ✅ Black Market result cards (GM visibility)
- ✅ Detective result cards (already worked)
- ✅ Admin panel Game Activity (already worked)

---

## Proposed Architecture (Phases 2-4)

### Strategy Pattern for Data Storage (Phase 2)

```
┌─────────────────────────────────────────────────────────────┐
│                     UnifiedDataManager                       │
│  (Common interface, event emission, public API)             │
├─────────────────────────────────────────────────────────────┤
│  storageStrategy: IStorageStrategy                          │
│  scoringEngine: ScoringEngine (shared)                      │
├─────────────────────────────────────────────────────────────┤
│  + processTransaction(tokenId, teamId, mode)                │
│  + getTeamScore(teamId)                                     │
│  + adjustTeamScore(teamId, delta, reason)                   │
│  + getGameActivity()                                        │
│  + getGlobalStats()                                         │
│  + createSession(name, teams)                               │
│  + endSession()                                             │
└─────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┴───────────────┐
              ▼                               ▼
┌─────────────────────────┐     ┌─────────────────────────┐
│   NetworkedStorage      │     │    LocalStorage         │
│   (WebSocket sync)      │     │    (localStorage)       │
├─────────────────────────┤     ├─────────────────────────┤
│ - socket                │     │ - storageKey            │
│ - eventHandlers         │     │ - sessionData           │
├─────────────────────────┤     ├─────────────────────────┤
│ + connect()             │     │ + load()                │
│ + sendCommand()         │     │ + save()                │
│ + onStateSync()         │     │ + executeCommand()      │
└─────────────────────────┘     └─────────────────────────┘
```

### ~~Shared Scoring Configuration~~ ✅ IMPLEMENTED

```
ALN-TokenData/
  tokens.json
  scoring-config.json  ← IMPLEMENTED: Single source of truth
```

**Benefits Realized:**
- ✅ Single source of truth in shared submodule
- ✅ Backend loads at startup
- ✅ GM Scanner bundles at build time
- 🔲 Notion sync could update values (future)

### Command Executor Pattern for Admin (Phase 3)

```
┌─────────────────────────────────────────────────────────────┐
│                   AdminOperations                            │
│  (High-level admin interface)                               │
├─────────────────────────────────────────────────────────────┤
│  commandExecutor: ICommandExecutor                          │
├─────────────────────────────────────────────────────────────┤
│  + adjustScore(teamId, delta, reason)                       │
│  + resetAllScores()                                         │
│  + deleteTransaction(transactionId)                         │
│  + createSession(name, teams)                               │
│  + endSession()                                             │
└─────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┴───────────────┐
              ▼                               ▼
┌─────────────────────────┐     ┌─────────────────────────┐
│   NetworkedExecutor     │     │    LocalExecutor        │
│   (CommandSender wrap)  │     │    (Direct execution)   │
├─────────────────────────┤     ├─────────────────────────┤
│ + execute(command)      │     │ + execute(command)      │
│   → socket.emit()       │     │   → dataManager.method()│
└─────────────────────────┘     └─────────────────────────┘
```

### Unified Team Entry UI (Phase 3)

Both modes use same component structure:
- Dropdown with existing teams
- "Add Team" button opens input
- Input validates and adds to dropdown
- Standalone stores teams in localStorage session

---

## Implementation Phases

### Phase 1: Foundation (Low Risk) ✅ COMPLETE

1. **Create shared scoring config** ✅
   - ✅ Added `ALN-TokenData/scoring-config.json`
   - ✅ Updated backend to load from shared config
   - ✅ Updated GM Scanner to import at build
   - ✅ Verified identical calculations
   - ✅ Fixed UNKNOWN type alignment

2. **Remove deprecated star scoring** ✅
   - ✅ Deleted `detectiveValue` everywhere
   - ✅ Updated tests
   - ✅ Verified no regressions

3. **Add summary to all modes** ✅
   - ✅ Show summary in Black Market result cards
   - ✅ Admin panel transaction views (already worked)
   - ✅ Removed dead code (renderTransactions, filterTransactions)
   - ✅ Updated all documentation

### Phase 2: Unification (Medium Risk) ✅ COMPLETE

4. **Create unified DataManager** ✅
   - ✅ Extracted common interface (`IStorageStrategy.js` - 161 LOC)
   - ✅ Implemented strategy pattern (`UnifiedDataManager.js` - 432 LOC)
   - ✅ Created LocalStorage strategy (`LocalStorage.js` - 505 LOC)
   - ✅ Created NetworkedStorage strategy (`NetworkedStorage.js` - 421 LOC)
   - ✅ Migrated consumers to UnifiedDataManager
   - ✅ Comprehensive testing (862 tests pass)

5. **Implement missing standalone methods** ✅
   - ✅ Added `getGameActivity()` to LocalStorage (line 407)
   - ✅ Added `adjustTeamScore()` to unified interface (line 367)
   - ✅ Added session lifecycle methods (`createSession`, `endSession`)

**Files Created/Modified:**
| File | Change |
|------|--------|
| `src/core/storage/IStorageStrategy.js` | Created - interface contract |
| `src/core/storage/LocalStorage.js` | Created - standalone strategy |
| `src/core/storage/NetworkedStorage.js` | Created - networked strategy |
| `src/core/unifiedDataManager.js` | Created - unified manager |
| `src/core/dataManagerUtils.js` | Created - shared utilities |
| `src/main.js` | Updated - uses UnifiedDataManager |
| `src/app/app.js` | Updated - initializes strategies by mode |
| `src/ui/uiManager.js` | Updated - removed `_getDataSource()` |
| `tests/unit/core/unifiedDataManager.test.js` | Created - 20 tests |
| `tests/integration/storage-strategies.test.js` | Created - integration tests |

### Phase 3: Admin Parity (Medium Risk) 🔲 NOT STARTED

6. **Command executor pattern**
   - Abstract admin commands
   - Implement LocalExecutor
   - Enable standalone admin panel

7. **Unify team entry UI**
   - Create shared TeamEntry component
   - Same UX in both modes
   - localStorage persistence for standalone

### Phase 4: Future Prep (Optional) 🔲 NOT STARTED

8. **Expand Notion sync**
   - Add Narrative Threads to tokens.json
   - Add Owner references
   - Add Timeline Event references
   - Consider adding Critical Path flag

9. **Detective mode enhancements**
   - Backend intelligent grouping
   - Thread-based cycling
   - Character-based views

---

## Risk Assessment

### ~~Phase 1 Risks~~ ✅ MITIGATED

| Risk | Likelihood | Impact | Status |
|------|------------|--------|--------|
| Scoring mismatch | Low | High | ✅ Mitigated with tests |
| Missing star display breaks UI | Low | Low | ✅ Verified no UI references |

### ~~Phase 2 Risks~~ ✅ MITIGATED

| Risk | Likelihood | Impact | Status |
|------|------------|--------|--------|
| State sync issues | Medium | High | ✅ Mitigated with integration tests |
| Event handler leaks | Medium | Medium | ✅ Fixed with `_strategyListeners` Map and `dispose()` |
| localStorage corruption | Low | Medium | ✅ LocalStorage handles gracefully |

### Phase 3 Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Admin operation failures | Medium | Medium | Transaction rollback support |
| UI inconsistency | Low | Low | Component-level testing |

### Rollback Strategy

Each phase is independently deployable:
- ~~Phase 1: Revert scoring config, restore star logic~~ (Complete - no rollback needed)
- ~~Phase 2: Switch strategy back to original managers~~ (Complete - no rollback needed)
- Phase 3: Disable local admin, require networked mode

---

## Appendix A: Code Flow Traces

### Transaction Processing Flow (Networked)

```
scanProcessor.js:handleScan()
  → UIManager:_getDataSource()
    → returns dataManager (networked)
  → dataManager.processTransaction(tokenId, teamId, mode)
    → socket.emit('scan:process', payload)
      → backend receives
        → transactionService.processScan()
          → tokenService.loadTokens() gets token
          → calculateTokenValue(rating, type)
          → Check duplicate (GM only)
          → Create transaction
          → sessionService persists
          → emit 'transaction:accepted'
            → broadcasts to all clients
              → dataManager.onTransactionNew()
                → emit 'transaction:added'
                  → UIManager updates display
```

### Transaction Processing Flow (Standalone)

```
scanProcessor.js:handleScan()
  → UIManager:_getDataSource()
    → returns standaloneDataManager
  → standaloneDataManager.processTransaction(tokenId, teamId, mode)
    → Load token from cache
    → calculateTokenValue() from scoring.js  ← Uses shared config
    → Check duplicate (uses scannedTokens Map)
    → Create transaction
    → Update team score
    → Check group completion
    → localStorage.setItem()
    → emit 'transaction:added'
      → UIManager updates display
```

### Detective Mode Data Flow

```
Transaction Created (mode: 'detective')
  → transactionService sets points = 0
  → Enriches with token.summary (tokenService)
  → sessionService persists
  → broadcasts 'transaction:new'
    ↓
Scoreboard (public/scoreboard.html)
  → WebSocket receives 'transaction:new'
  → Filters: tx.mode === 'detective'
  → Renders "Classified Evidence Terminal"
    → Hero card (latest evidence)
    → Evidence grid (all detective transactions)
    → Cycling with adaptive intervals
    ↓
GM Scanner Admin (MonitoringDisplay.js)
  → getGameActivity() includes detective transactions
  → Displays with "🔍 EXPOSED" marker
  → Shows summary text
    ↓
GM Scanner Result Screen (uiManager.js)  ← UPDATED Phase 1.3
  → showTokenResult() shows summary for ALL modes
  → No longer checks for detective mode
```

---

## Appendix B: Notion Elements Schema Reference

```yaml
Properties:
  # Identity
  - Name: title
  - Basic Type: select [Memory Token Image, Memory Token Audio, Memory Token Video, ...]
  - Status: status [Not started, In progress, Done]

  # Scoring (currently synced)
  - Description/Text: rich_text (contains SF_ fields)

  # Relationships (NOT currently synced)
  - Owner: relation → Characters
  - Timeline Event: relation → Timeline
  - Required For: relation → Puzzles
  - Rewarded by: relation → Puzzles
  - Container Puzzle: relation → Puzzles
  - Children: relation → Elements (self)
  - Parent: relation → Elements (self)

  # Classification (NOT currently synced)
  - Narrative Threads: multi_select [14 options]
  - First Available: select [Act 1, Act 2, Act 3]
  - Critical Path: checkbox
  - Location Found: rich_text

  # Media
  - Files & media: files
  - Additional Images: files
```

---

## Appendix C: Test Coverage Requirements

### Unit Tests

- [x] Scoring config loads correctly from JSON (Phase 1.1)
- [x] calculateTokenValue matches for all rating/type combinations (Phase 1.1)
- [x] UNKNOWN type returns 0 in both frontend and backend (Phase 1.1)
- [x] detectiveValue removal doesn't break existing data (Phase 1.2)
- [x] Summary displays in all transaction modes (Phase 1.3)
- [x] Group bonus calculation identical in both modes (Phase 2) ✅
- [x] UnifiedDataManager delegates to correct strategy (Phase 2) ✅
- [x] LocalStorage persists and loads sessions (Phase 2) ✅

### Integration Tests

- [x] Standalone session lifecycle (create → scan → end) (Phase 2) ✅
- [x] Standalone score adjustment persists to localStorage (Phase 2) ✅
- [x] Networked → Standalone data format compatibility (Phase 2) ✅
- [x] Strategy pattern switches correctly based on mode (Phase 2) ✅

**Phase 2 Test Summary:** 862 tests passing (20 new UnifiedDataManager tests + integration tests)

### E2E Tests

- [ ] Standalone admin operations work without backend (Phase 3)
- [ ] Team entry UI consistent across modes (Phase 3)
- [ ] Game activity view works in standalone (Phase 3)
- [x] Detective mode scoreboard displays correctly (existing)
