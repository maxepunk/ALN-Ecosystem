# GM Scanner File Structure Investigation - Pre-Investigation Plan

**Created**: 2025-10-01
**Purpose**: Systematic investigation strategy tailored for GM Scanner component
**Component**: ALNScanner (GM Scanner PWA)

---

## Component Characteristics (What Makes This Different)

### Unique Challenges

**1. Single-File Architecture** (6,428 lines):
- NOT distributed across multiple files like backend
- Internal modular structure WITHIN index.html
- Requires different navigation strategy than backend
- All code sections must be mapped before diving deep

**2. Dual Operation Modes**:
- **Networked Mode**: Connected to orchestrator (WebSocket + HTTP)
- **Standalone Mode**: Independent operation (NO orchestrator)
- BOTH code paths exist in same file
- Need to identify which code runs in which mode

**3. Client-Side Game Logic**:
- Scoring algorithms (MUST exist for standalone mode)
- Duplicate detection (local session tracking)
- Group completion bonuses (client-side calculation)
- Team management (local state)
- **This logic DUPLICATES backend logic** - alignment critical

**4. Defensive Code Patterns**:
- Normalization layers for backend inconsistencies (Phase 2 Finding #3)
- Fallbacks for wrapped/unwrapped events (Phase 2 Finding #2)
- Multiple || chains for missing fields
- May MASK contract violations

**5. PWA Patterns**:
- Service worker (sw.js) for offline operation
- IndexedDB or LocalStorage for persistence
- Manifest for installability
- Offline-first architecture

**6. Admin Functionality Integrated**:
- NOT a separate app
- Shares WebSocket connection with GM Scanner
- Admin commands mixed with scanner operations
- Need to map admin vs scanner responsibilities

**7. NFC Hardware Integration**:
- Web NFC API usage (Android Chrome only)
- Hardware constraints affect architecture
- May have fallback patterns for testing

---

## File Inventory (Preliminary Survey)

**Production Files**:
- `index.html` (6,428 lines) - Main application (single-file PWA)
- `sw.js` (3,300 lines est.) - Service worker
- `data/tokens.json` - Token database (submodule to ALN-TokenData)
- `.git` submodule pointer

**Test Files** (Separate from production):
- `websocket-tests.js` (40K bytes)
- `websocket-tests-fixed.js` (28K)
- `websocket-tests-correct.js` (24K)
- `integration-test.html` (11K)
- `test-verification.html` (12K)
- `test-runner.html` (7.3K)
- `test-runner.js` (9K)
- `verify-tests.js` (2.9K)
- `quick-test.js` (3.1K)
- `analyze-test-failures.js` (6.7K)
- `run-tests-headless.js` (13K - executable)

**Documentation Files**:
- `README.md` (12K)
- `CLAUDE.md` (3.3K)
- `MAINTENANCE.md` (4.4K)
- `SUBMODULE_INFO.md` (1.6K)
- `WEBSOCKET_TESTS.md` (7.2K)
- `WEBSOCKET_TEST_FIX_SUMMARY.md` (5.2K)

**Other Files**:
- `sync.py` (7.1K) - Token sync script
- `tokens.json.backup` (3.1K)
- `indextext` (1.7K)

---

## Code Structure Map (index.html Internal Modules)

**Discovered via grep analysis**:

```
index.html (6,428 lines)
├── Lines 1-1743: HTML structure + CSS
├── Line 1744: CONFIG object
├── Line 1757: AdminModule
│   ├── SessionManager class (lines ~1759-1855)
│   ├── VideoController class (lines ~1877-1968)
│   ├── SystemMonitor class (lines ~1970-2018)
│   └── AdminOperations class (lines ~2020-2061)
├── Line 2063: Debug utilities
├── Line 2135: NFCHandler
├── Line 2288: TokenManager
├── Line 2543: DataManager
│   ├── addTransaction method (~line 2670)
│   ├── calculateScores method (~line 2812)
│   ├── calculateGroupBonuses (~line 3115)
├── Line 3281: UIManager
├── Line 3812: Settings
├── Line 3864: App (main application)
├── Line 4783: SessionModeManager class
└── Line 4880: ConnectionManager class
```

**Key Modules Identified**:
1. CONFIG - Configuration constants
2. AdminModule - Admin panel functionality (4 sub-classes)
3. Debug - Debug logging utilities
4. NFCHandler - NFC hardware integration
5. TokenManager - Token data loading and validation
6. DataManager - Core game logic (scoring, transactions, groups)
7. UIManager - UI rendering and updates
8. Settings - User settings management
9. App - Main application coordinator
10. SessionModeManager - Networked vs Standalone mode switching
11. ConnectionManager - WebSocket + HTTP communication

---

## Investigation Strategy (Tailored Approach)

### Phase 1: Structural Mapping (Before Deep Dive)

**Objective**: Understand the architecture BEFORE analyzing details

**Tasks**:
1. **Map all internal modules** (complete the structure tree above)
   - Identify module boundaries (where each module starts/ends)
   - Document module responsibilities
   - Identify dependencies between modules

2. **Identify operational mode code paths**:
   - Which code runs ONLY in networked mode?
   - Which code runs ONLY in standalone mode?
   - Which code runs in BOTH modes?
   - How does mode switching work (SessionModeManager)?

3. **Map backend integration points**:
   - All HTTP fetch() calls (URLs, methods, request/response formats)
   - All WebSocket event handlers (socket.on/emit)
   - All data structures sent/received from backend
   - Field naming usage (scannerId vs deviceId)

4. **Map client-side game logic**:
   - Scoring algorithm location
   - Duplicate detection logic
   - Group completion bonus logic
   - Team management logic
   - Compare to backend logic (identify duplication/divergence)

**Method**:
- Create a "module boundary map" document
- Tag each section with: [NETWORKED], [STANDALONE], or [BOTH]
- Create "integration points inventory" (all backend calls)

---

### Phase 2: Contract Alignment Analysis

**Objective**: Identify violations of Phase 4-5 decisions

**Focus Areas**:

**2.1 Field Naming (Decision #4)**:
- Search for ALL uses of `scannerId` (should be `deviceId`)
- Search for ALL uses of `stationId` (internal field)
- Document normalization: `scannerId → stationId` conversions
- Find hardcoded field names in WebSocket handlers
- Find hardcoded field names in HTTP requests

**2.2 Event Structure (Decision #2)**:
- Identify ALL WebSocket event handlers
- Check if they handle wrapped format: `{event, data, timestamp}`
- Find defensive fallbacks: `eventData.data || eventData`
- Document which events expect wrapped vs unwrapped
- Compare to AsyncAPI contracts

**2.3 HTTP Response Handling (Decision #3, #9)**:
- Find ALL fetch() calls
- Check if responses are parsed (should be minimal per Decision #9?)
- Wait - GM Scanner is NOT Player Scanner (fire-and-forget is Player only)
- GM Scanner DOES parse HTTP responses
- Document response parsing patterns

**2.4 Error Display (Decision #10)**:
- Find ALL error handling code
- Check if errors displayed to users (not just console.log)
- Identify error display patterns
- Check if consistent across all error types

**Method**:
- Grep for specific patterns (scannerId, socket.on, fetch, etc.)
- Document each violation with line numbers
- Create violation inventory by Decision #

---

### Phase 3: Defensive Code Analysis

**Objective**: Identify normalization layers that mask issues

**Focus Areas**:

**3.1 Field Normalization** (Known from Phase 2 Finding #3):
```javascript
// Example pattern to find:
const normalizedTx = {
    stationId: transaction.scannerId || transaction.stationId || Settings.stationId,
    rfid: transaction.tokenId || transaction.rfid,
    // ... more fallbacks
};
```

**3.2 Event Fallbacks**:
```javascript
// Example pattern:
const data = eventData.data || eventData;
```

**3.3 Token Data Fallbacks**:
```javascript
// Example pattern:
memoryType: transaction.memoryType || (tokenData?.SF_MemoryType) || 'UNKNOWN'
```

**3.4 Response Parsing Fallbacks**:
```javascript
// Example pattern:
const result = response.data || response;
```

**Analysis Questions**:
- WHY does each fallback exist?
- What backend inconsistency is it defending against?
- What happens if you remove the fallback?
- Is the fallback masking a contract violation?

**Method**:
- Search for `||` chains (multiple fallbacks)
- Search for `?.` optional chaining (defensive access)
- Document each defensive pattern with:
  - Line number
  - What it's defending against
  - Backend issue it's compensating for

---

### Phase 4: Game Logic Duplication Analysis

**Objective**: Compare client-side logic to backend logic

**Focus Areas**:

**4.1 Scoring Algorithm**:
- Find client-side scoring calculation
- Compare to backend transactionService.js scoring
- Identify divergences (bugs, outdated logic, intentional differences)
- Document algorithm complexity

**4.2 Duplicate Detection**:
- Find client-side duplicate detection
- Compare to backend duplicate detection
- Check session boundaries (local vs server session)
- Check timing windows

**4.3 Group Completion Bonuses**:
- Find client-side group completion logic
- Compare to backend group logic
- Check multiplier calculations
- Check completion criteria

**4.4 Team Management**:
- Find client-side team state
- Compare to backend team management
- Check team creation/selection logic

**Why This Matters**: Standalone mode REQUIRES client logic, but divergence causes bugs

**Method**:
- Extract client-side algorithms
- Place backend algorithms side-by-side
- Document differences (line-by-line if needed)
- Classify: identical, slightly different, completely different

---

### Phase 5: PWA & Offline Analysis

**Objective**: Understand offline-first architecture

**Focus Areas**:

**5.1 Service Worker (sw.js)**:
- Cache strategies
- Offline detection
- Background sync
- Push notifications (if any)

**5.2 Local Storage/IndexedDB**:
- What data is persisted?
- Offline queue implementation
- State recovery after offline period

**5.3 Network Detection**:
- How does app detect online/offline?
- How does it switch modes?
- Auto-reconnect logic?

**5.4 Offline Queue**:
- How are transactions queued?
- Queue persistence mechanism
- Queue processing when back online
- Error handling for failed sync

---

### Phase 6: Admin Panel Integration

**Objective**: Understand admin vs scanner separation

**Focus Areas**:

**6.1 AdminModule Structure** (Lines 1757-2061):
- SessionManager responsibilities
- VideoController responsibilities
- SystemMonitor responsibilities
- AdminOperations responsibilities

**6.2 Shared vs Separate**:
- Does admin share WebSocket with scanner?
- Does admin have separate auth flow?
- How does scanner know user is admin?
- Can scanner and admin run simultaneously?

**6.3 Admin Commands**:
- All admin commands mapped
- Compare to backend gm:command handler
- Check command payload structures
- Check response handling

---

### Phase 7: UI/State Management

**Objective**: Understand state flow without framework

**Focus Areas**:

**7.1 State Management Pattern**:
- Where is state stored? (module-level? App object?)
- How is state updated?
- How does UI react to state changes?
- Is there a pub/sub pattern?

**7.2 UIManager Analysis**:
- Rendering patterns
- DOM update strategies
- Event binding patterns
- Performance considerations (6K line file)

**7.3 Reactivity**:
- How do WebSocket updates trigger UI updates?
- How do user actions trigger state changes?
- Is there a central state coordinator?

---

### Phase 8: Test Code Analysis

**Objective**: Understand test approach, identify test pollution

**Focus Areas**:

**8.1 Test Files Inventory**:
- What do tests test? (WebSocket? Offline? Integration?)
- Are tests runnable? (test-runner.html)
- Test coverage assessment

**8.2 Test Code Pollution**:
- Is test code embedded in index.html?
- Are there `if (process.env.NODE_ENV === 'test')` checks?
- Test utilities mixed with production code?

**8.3 Test Documentation**:
- WEBSOCKET_TESTS.md - what does it document?
- WEBSOCKET_TEST_FIX_SUMMARY.md - what was fixed?

---

## Investigation Execution Plan

### Step-by-Step Execution

**Step 1: Structural Mapping** (Estimated: 60-90 min)
1. Read index.html with focus on module boundaries
2. Create complete module structure tree
3. Document module responsibilities and dependencies
4. Tag code sections: [NETWORKED], [STANDALONE], [BOTH]
5. Create integration points inventory

**Step 2: Contract Violation Scan** (Estimated: 45-60 min)
1. Search for all `scannerId` usage
2. Search for all `socket.on(` event handlers
3. Search for all `fetch(` HTTP calls
4. Document violations with line numbers
5. Create findings for each violation

**Step 3: Defensive Code Audit** (Estimated: 45-60 min)
1. Search for `||` chains (fallbacks)
2. Search for `?.` optional chaining
3. Document each defensive pattern
4. Analyze what backend issue each defends against
5. Create findings for normalization layers

**Step 4: Game Logic Comparison** (Estimated: 60-90 min)
1. Extract client-side scoring algorithm
2. Compare to backend transactionService.js
3. Extract duplicate detection logic
4. Compare to backend duplicate detection
5. Extract group bonus logic
6. Compare to backend group logic
7. Document divergences as findings

**Step 5: PWA Analysis** (Estimated: 30-45 min)
1. Read sw.js service worker
2. Find offline queue implementation
3. Find network detection logic
4. Document offline-first patterns

**Step 6: Admin Panel Analysis** (Estimated: 30-45 min)
1. Read AdminModule sections
2. Map admin commands
3. Compare to backend gm:command
4. Document admin vs scanner separation

**Step 7: UI/State Analysis** (Estimated: 30-45 min)
1. Find state storage locations
2. Map state update flows
3. Document UI rendering patterns
4. Document reactivity patterns

**Step 8: Test Analysis** (Estimated: 30 min)
1. Read test file headers
2. Check for test pollution in index.html
3. Read test documentation files
4. Document test approach

**Total Estimated Time**: 5-7 hours

---

## Findings Documentation Strategy

### Findings Template (Same as Backend)

```markdown
---
**Finding #N**: [One-line summary]
**Category**: Architecture / Pattern / Violation / Dead Code / Anti-Pattern / Info
**Location**: index.html:line-range OR filename:line
**Severity**: 🔴 Critical / 🟡 Important / 🟢 Note / 🔵 Info
**Contract Alignment**: Decision #X reference

**Code Snippet**:
```javascript
// relevant code
```

**Observation**: What was found

**Backend Comparison**: How this compares to backend (if applicable)

**Operational Mode**: [NETWORKED] / [STANDALONE] / [BOTH]

**Issue**: Problem identified (if any)

**Impact**: Breaking change risk / refactor coordination required

**Action Required**: What needs to be done

**Related Findings**: #X, #Y (backend findings if applicable)
---
```

### Special Fields for GM Scanner Findings

**Operational Mode**: Tag which mode this affects
- [NETWORKED] - Only affects networked operation
- [STANDALONE] - Only affects standalone operation
- [BOTH] - Affects both modes

**Backend Comparison**: Compare to backend implementation
- Same algorithm? Different? Missing?
- Used for game logic duplication findings

### Expected Finding Categories

**Contract Violations**:
- Field naming (scannerId vs deviceId)
- Event structure (wrapped vs unwrapped)
- Response format parsing
- Error display patterns

**Defensive Code**:
- Normalization layers
- Fallback chains
- What backend issues they compensate for

**Game Logic**:
- Scoring algorithm comparison
- Duplicate detection comparison
- Group bonus comparison
- Logic divergences from backend

**Architecture**:
- Module structure quality
- State management patterns
- UI rendering patterns
- Offline-first implementation

**Integration**:
- WebSocket event usage
- HTTP endpoint usage
- Admin command implementation
- Token data loading

**PWA**:
- Service worker patterns
- Offline queue
- Network detection
- Cache strategies

**Test Code**:
- Test pollution in production
- Test file organization
- Test coverage gaps

---

## Critical Questions to Answer

### Standalone Mode Viability
1. Is client-side game logic COMPLETE?
2. Does it match backend logic?
3. Can it operate fully offline?
4. What features are lost in standalone mode?

### Backend Integration Quality
1. How many integration points exist?
2. How many violate contracts?
3. How defensive is the code?
4. What breaks if backend changes?

### Maintainability
1. Is 6K-line single file manageable?
2. Are modules well-separated?
3. Is state management clear?
4. Is code duplicated within file?

### Refactor Coordination
1. What changes require backend coordination?
2. What can be changed independently?
3. What's the atomic refactor scope?
4. What's the breaking change risk?

---

## Success Criteria

**Investigation Complete When**:
1. ✅ All modules mapped with clear boundaries
2. ✅ All backend integration points documented
3. ✅ All contract violations identified
4. ✅ All defensive code patterns analyzed
5. ✅ Game logic fully compared to backend
6. ✅ Operational modes clearly distinguished
7. ✅ PWA patterns documented
8. ✅ Admin panel integration understood
9. ✅ ~30-50 findings documented (estimated)
10. ✅ Atomic refactor requirements mapped

**Synthesis Complete When**:
1. ✅ Part 2 of 10-file-structure-current.md written
2. ✅ All findings organized by category
3. ✅ Critical issues highlighted
4. ✅ Refactor coordination map created
5. ✅ Comparison to backend synthesis
6. ✅ Next steps documented

---

## Risk Assessment

**Investigation Risks**:
- ⚠️ Single 6K-line file is dense - may take longer than estimated
- ⚠️ Defensive code may obscure real patterns
- ⚠️ Without framework, state management may be hard to trace
- ⚠️ Game logic comparison requires careful analysis

**Mitigation**:
- ✅ Break into phases (don't try to read all 6K lines at once)
- ✅ Use grep/search to find patterns first
- ✅ Document as you go (don't wait until end)
- ✅ Compare code side-by-side for game logic

---

**Pre-Investigation Status**: ✅ COMPLETE
**Next**: Execute Phase 1 (Structural Mapping) of GM Scanner investigation
**Est. Total Time**: 5-7 hours for full investigation

---
