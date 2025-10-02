# Phase 6: File Structure Investigation Plan

**Created**: 2025-10-01
**Purpose**: Systematically investigate current file/code organization to plan target file structure aligned with contracts
**Status**: ✅ COMPLETE - Phase 6.1-6.5 ALL COMPLETE, Phase 6.6 (Refactor Plan Synthesis) NEXT
**Last Updated**: 2025-10-02 (After Phase 6.5 complete - 3 structural decisions made, ready for refactor plan synthesis)

---

## Current Progress Summary

**Overall Progress**: **100% Complete** (ALL 4 investigations done)

**Completed** ✅:
- **Phase 6.1**: Backend Investigation ✅ **COMPLETE** (49 findings, Findings #1-#49)
  - 7 sub-phases complete (File Inventory → Dependency Mapping)
  - 46 files analyzed (~10,646 lines)
  - Part 1 of 10-file-structure-current.md written (2,286 lines)

- **Phase 6.2**: GM Scanner Investigation ✅ **COMPLETE** (9 findings, Findings #50-#58)
  - Contract violations analysis complete
  - 1 file analyzed (index.html, 6,428 lines)
  - Part 2 of 10-file-structure-current.md written (530 lines)

- **Phase 6.3**: Player Scanner Investigation ✅ **COMPLETE** (9 findings, Findings #59-#67)
  - Fire-and-forget HTTP pattern validated (Decision #9 perfect compliance)
  - 3 files analyzed (index.html, orchestratorIntegration.js, sw.js - 1,800 lines total)
  - Part 3 of 10-file-structure-current.md written (634 lines)
  - 5 strengths identified (cleanest architecture in system)

- **Phase 6.4**: Cross-Cutting Concerns Investigation ✅ **COMPLETE**
  - Method: Deep analysis of Parts 1-3 + supplemental investigation
  - 2 ATOMIC refactors identified (field naming, event wrapping)
  - 8 system-wide patterns documented
  - Submodule architecture mapped (ALN-TokenData)
  - Deployment coordination strategy defined
  - Part 4 of 10-file-structure-current.md written (624 lines)

**Investigation Stats** (FINAL):
- **Total Findings Documented**: **67 findings** (Backend 49 + GM Scanner 9 + Player Scanner 9)
- **Files Analyzed**: 50 files (~12,474 lines total)
  - Backend: 46 files (~10,646 lines)
  - GM Scanner: 1 file (6,428 lines)
  - Player Scanner: 3 files (~1,800 lines)
- **Synthesis Document**: 10-file-structure-current.md **ALL 4 PARTS COMPLETE** (4,074 lines)
  - Part 1: Backend (2,286 lines) ✅
  - Part 2: GM Scanner (530 lines) ✅
  - Part 3: Player Scanner (634 lines) ✅
  - Part 4: Cross-Cutting (624 lines) ✅

**CRITICAL Architectural Discoveries (Backend + GM Scanner)**:

1. **ROOT CAUSE: Systemic Field Naming** (Finding #40):
   - Transaction model DEFINES scannerId field (source of truth)
   - Validators ENFORCE scannerId (Finding #34)
   - Services USE scannerId (Finding #15)
   - Broadcasts EMIT scannerId (Finding #28)
   - **Entire data flow uses wrong field name** - atomic refactor required

2. **Dead Code: eventWrapper.js** (Finding #21):
   - Perfect implementation of Decision #2 (wrapped envelope) EXISTS
   - NEVER IMPORTED or used by any file
   - 62% of WebSocket events manually construct wrappers (Finding #22)
   - Architectural failure: helper exists but ignored

3. **Mixed Concerns: Session.toAPIResponse()** (Finding #41):
   - Only model with presentation logic (1 of 8)
   - Violates separation of concerns
   - Contributes to "7 response patterns" confusion
   - DELETE and move logic to route layer

4. **Eliminated Events Still Emitted** (Findings #25-#27):
   - 11 WebSocket events that should be deleted
   - session:new, session:paused, session:resumed, session:ended
   - state:sync, heartbeat, heartbeat:ack
   - video:skipped, scores:reset, team:created
   - Over-engineering cleanup needed

5. **Inconsistent Serialization** (Finding #42):
   - 3 different patterns across 8 models
   - 75% pure toJSON (good), 12.5% mixed concerns (bad), 12.5% security-focused (acceptable)
   - Target: 100% consistency

6. **Strong Foundations** (Finding #43):
   - 100% consistent Joi validation across all models
   - Rich business logic (not anemic domain models)
   - Clear, non-overlapping responsibilities
   - **Overall: 75% excellent architecture, 25% needs cleanup**

7. **Circular Service Dependencies** (Finding #44):
   - sessionService ↔ stateService ↔ transactionService triangle
   - 8 lazy require statements breaking circular deps
   - No dependency injection framework
   - offlineQueueService creates dependency pressure

8. **Tight Coupling for Atomic Refactors** (Finding #47):
   - scannerId → deviceId: ~30 files must change atomically
   - Event wrapping: ~8 backend + 2 scanner repos atomically
   - Circular deps: ~10 backend files + all tests atomically
   - Documented safe vs risky refactor order

9. **GM Scanner ROOT CAUSE: Sends scannerId** (Finding #51):
   - Line 4510: App.processTransaction() sends `scannerId: Settings.stationId`
   - Violates Decision #4 (should be deviceId)
   - MUST coordinate with Backend #40 (Transaction.toJSON)
   - Atomic refactor: Backend + GM Scanner + Tests together

10. **GM Scanner Internal stationId Usage** (Finding #52):
    - 17 code locations + 3 HTML elements use `stationId`
    - Can refactor independently AFTER atomic deviceId change
    - No backend coordination needed (internal change)

11. **GM Scanner Missing Error Display** (Findings #57, #58):
    - UIManager has NO error display methods
    - 20+ catch blocks use console.error() only
    - Violates Decision #10
    - Independent frontend enhancement (~3-4 hours)

12. **GM Scanner Dead Event Handlers** (Finding #55):
    - 4 handlers for eliminated events (state:update, scores:reset, team:created, state:sync)
    - DELETE lines 5782-5785, 5808-5823, 5834-5837, 5856-5862
    - Backend stops emitting separately (no coordination)

**Investigation Methodology Evolution**:
- **Plan Expected**: Pattern documentation ("what exists")
- **Actual Execution**: Architectural analysis ("why it exists, what it reveals, systemic fixes")
- **Lens Shift**: Moved from tactical questions to strategic understanding (see session discussion)

**Next Actions**:
1. ✅ Complete Phase 6.1: Backend Investigation (**DONE** - 49 findings, 7 sub-phases)
2. ✅ Write Part 1 of 10-file-structure-current.md (**DONE** - 2,286 lines)
3. ✅ Complete Phase 6.2: GM Scanner Investigation (**DONE** - 9 findings)
4. ✅ Write Part 2 of 10-file-structure-current.md (**DONE** - 530 lines)
5. ✅ Complete Phase 6.3: Player Scanner Investigation (**DONE** - 9 findings)
6. ✅ Write Part 3 of 10-file-structure-current.md (**DONE** - 634 lines)
7. ✅ Complete Phase 6.4: Cross-Cutting Concerns Investigation (**DONE**)
8. ✅ Write Part 4 of 10-file-structure-current.md (**DONE** - 624 lines)
9. ✅ Complete Phase 6.5: Collaborative Target Structure Decisions (**DONE** - 3 decisions)
10. ✅ Write 11-file-structure-target.md (**DONE** - 560+ lines with decision log)
11. ⏳ **NEXT**: Begin Phase 6.6: Synthesize Refactor Plan (07-refactor-plan.md)

**Phases Complete**: 6.1 ✅, 6.2 ✅, 6.3 ✅, 6.4 ✅, 6.5 ✅ | **Phases Pending**: 6.6 ⏳

**Note**: Test investigation was already completed in Phase 4.5 + post-mortem (not repeated here)

---

## Phase 6.5 Results: Collaborative Target Structure Decisions ✅

**Completed**: 2025-10-02
**Duration**: ~4 hours (gap-filling + decisions + documentation)
**Output**: 11-file-structure-target.md (560+ lines, 3 structural decisions)

### Process Summary

**Phase 6.5** used collaborative decision-making (Pattern 1) to define target file organization. Key methodology refinements discovered:

1. **Document decisions IMMEDIATELY** - Risk losing context/nuance between decisions
2. **Ultrathink to prevent over-engineering** (Pattern 8) - Check existing systems before adding new ones
3. **Contracts define TARGET** - Not documenting current state, designing clean architecture

### Gap-Filling Investigations (7 gaps, ~45 minutes)

Before decisions, strategic investigations filled knowledge gaps:

| Gap | Finding | Impact |
|-----|---------|--------|
| #1 | Test organization already decided (06-test-architecture.md) | Decision eliminated |
| #2 | GM Scanner module dependencies mapped | Informed Decision #2 |
| #3 | Service initialization - no clean order possible | Informed Decision #3 |
| #4 | 8 HTTP endpoints → 5 route files natural grouping | Informed Decision #1 |
| #5 | Player Scanner has partial error UI (toast pattern) | Reference pattern exists |
| #6 | File loading: simple script tags (no build step) | Decision #2 feasible |
| #7 | Services right-sized, move tokenService to utils/ | Implementation task, not decision |

### Decisions Made (3 Structural Decisions)

#### Decision #1: Backend Route File Organization
**Result**: 5 route files (resource-based)
- admin, scan, session, state, resource
- Delete 2 files (transaction, video), prune 3, create 1
- 2 hours effort

#### Decision #2: GM Scanner Modularization
**Result**: Split 6,428-line monolith → 15 files across 5 directories
- core/ (3 files), network/ (3), ui/ (2), app/ (2), utils/ (4)
- Phased approach with validation at each step
- 12 hours effort

#### Decision #3: Event-Based Communication (System-Wide)
**Result**: EventEmitter/EventTarget pattern for circular dependencies
- **Critical Insight** (Pattern 8 ultrathinking): Domain events = WebSocket events
- **Almost created**: internal-events.yaml (duplicate contracts)
- **Realized**: asyncapi.yaml documents BOTH internal (service coordination) + external (WebSocket)
- **Result**: Single source of truth, no duplication
- 12-16 hours effort (convert lazy requires + direct calls to events)

**Key Architectural Pattern**:
```
sessionService.emit('session:ended') → {
  stateService listens (internal coordination)
  broadcasts.js listens, emits session:update WebSocket (external)
}
```

### Methodology Insights

**Pattern 8 Example** (Ultrathinking):
```
Q: Do we need internal-events.yaml for service coordination?
   → Think: When session ends, who needs to know?
     Services need to know AND GMs need to know
   → These are the SAME events!
   → asyncapi.yaml already documents these
   → NO separate internal contracts needed
```

**Lesson**: Contracts define TARGET architecture (not current lazy requires)

### Implementation Tasks Identified (Not Decisions)

These are determined by previous decisions/findings:
1. Move tokenService → utils/tokenLoader.js (Finding #20)
2. Create utils/responseBuilder.js (Decision #3 from Phase 4)
3. Import/use eventWrapper.js (Decision #2 from Phase 4)
4. Delete eliminated endpoints (Finding #13)
5. Add error display to UIManager (Decision #10 from Phase 4)

### Time Analysis

| Activity | Estimated | Actual | Note |
|----------|-----------|--------|------|
| Gap-filling | Not estimated | 45 min | Essential for informed decisions |
| Decision #1 | - | 30 min | Clear options |
| Decision #2 | - | 60 min | Complex tradeoffs |
| Decision #3 | - | 90 min | Ultrathinking caught duplication |
| Documentation | - | 45 min | Immediate capture |
| **Total** | 3.5-6.5 hours | ~4 hours | Within estimate |

### Output Statistics

- **11-file-structure-target.md**: 560+ lines
- **Decisions logged**: 3 (with context, options, rationale, impact each)
- **Cross-references**: To findings, contracts, previous decisions
- **Implementation tasks**: 5 identified (separate from structural decisions)

---

## Executive Summary

**Why This Investigation**:
- We have contract knowledge (endpoint/event architecture from Phases 1-5)
- We DON'T have detailed file structure knowledge (how code is organized)
- Cannot plan refactor without knowing BOTH what to change AND where to change it

**What We're Investigating**:
1. **Backend**: File organization, code duplication, architectural patterns, dependency structure
2. **Scanners**: Monolith vs modular, separation of concerns, shared code opportunities
3. **Tests**: File organization, level alignment, helper structure
4. **Cross-Cutting**: Shared utilities, common patterns, missing abstractions

**Investigation Output**:
- `10-file-structure-current.md` - Complete current file structure with analysis
- `11-file-structure-target.md` - Proposed target structure aligned with contracts
- `work/FILE-STRUCTURE-FINDINGS.md` - Atomic findings log (like Phase 2 scanner findings)
- Updated `00-INDEX.md` - Reflect Phase 6 progress

**Estimated Duration**: 4-6 hours of systematic investigation + 2-3 hours documentation

---

## Context: What We Already Know

### From Previous Phases

**Phase 1** (01-current-state.md):
- Route files locations: `backend/src/routes/*.js`
- Service files pattern: Singleton with `getInstance()`
- WebSocket handlers: `backend/src/websocket/*.js`
- **Known Issue**: 4 different response format patterns (no shared builder)
- **Known Issue**: Manual auth in sessionRoutes (not using middleware)

**Phase 2** (02-scanner-analysis.md):
- GM Scanner: 260KB monolith (index.html)
- Player Scanner: Modular (orchestratorIntegration.js)
- **Known Pattern**: Normalization layer in GM Scanner (scannerId → stationId)
- **Known Pattern**: Fire-and-forget HTTP in Player Scanner

**Phase 5** (contracts/):
- Target API structure formalized (24 APIs: 8 HTTP + 16 WebSocket)
- Wrapping standard defined (Decision #2)
- Field naming standard defined (Decision #4)

**Phase 4.5 Post-Mortem** (work/TEST-CLEANUP-PLAN.md):
- Test files cleaned up (1,372 harmful lines deleted)
- Test architecture defined (proper pyramid, ajv validation)
- **Known Issue**: Inverted test pyramid (most tests at wrong level)

### What We DON'T Know Yet

**Backend**:
- [ ] Complete file inventory with purposes
- [ ] Dependency map (which files import which)
- [ ] Code duplication extent (how much shared code could exist)
- [ ] Service responsibilities (are they single-purpose or tangled?)
- [ ] Missing helper opportunities (response builder, event wrapper, etc.)
- [ ] Route organization logic (resource-based? feature-based? random?)

**Scanners**:
- [ ] GM Scanner internal structure (how is 260KB organized within the file?)
- [ ] Modularization opportunities (can we split without breaking standalone mode?)
- [ ] Shared code between GM/Player scanners (any duplication?)
- [ ] Client-side game logic organization (where does it live, how tangled?)

**Tests**:
- [ ] Unit test opportunities (what logic can be extracted from integration tests?)
- [ ] Test file naming/organization conventions (if any)
- [ ] Helper/utility organization (where do shared test helpers live?)
- [ ] Coverage gaps by file (which files have no tests?)

**Cross-Cutting**:
- [ ] Utilities directory structure (does src/utils/ exist? what's in it?)
- [ ] Shared constants/configs (where do magic numbers live?)
- [ ] Error handling patterns (where is error logic? duplicated?)

---

## Investigation Methodology

### Guiding Principles (From Phases 1-3)

1. **Exhaustive, Not Sampling**: List ALL files, not "some examples"
2. **File:Line Precision**: Exact locations for code patterns
3. **Atomic Findings**: One finding = one discovery (numbered, traceable)
4. **Primary Source Verification**: Read code, don't assume
5. **Multiple Access Patterns**: Organize findings for different use cases
6. **Collaborative Decisions**: Present options for major structural changes

### Investigation Pattern

**For Each Component** (Backend, GM Scanner, Player Scanner, Tests):

**Step 1: Complete File Inventory**
- List ALL files with sizes
- Document file purposes from code reading
- Note immediate observations (monolith, small focused file, etc.)

**Step 2: Code Organization Analysis**
- Read each file to understand structure
- Document patterns (singleton, module exports, class-based, etc.)
- Identify code smells (duplication, tangled dependencies, etc.)

**Step 3: Dependency Mapping**
- Map imports/requires between files
- Identify dependency chains
- Find circular dependencies
- Note missing abstractions (should exist but doesn't)

**Step 4: Pattern Extraction**
- Document common patterns (good and bad)
- Find code duplication instances
- Identify helper opportunities
- Note inconsistencies

**Step 5: Gap Analysis**
- Compare against contract requirements
- Identify missing files/modules needed for target architecture
- Document architectural improvements needed

### Atomic Findings Log Pattern

**Following Phase 2 scanner-analysis.md pattern**:

Each finding gets:
- **Finding #N**: Title (one discovery)
- **File/Location**: Exact file:line or file range
- **Pattern**: Code pattern observed
- **Issue**: What's wrong (if anything)
- **Implication**: Why it matters for refactor
- **Contract Alignment**: How it relates to target architecture

**Example**:
```markdown
#### Finding #1: No Shared Response Builder

**File**: All route files (scanRoutes.js, sessionRoutes.js, adminRoutes.js, etc.)

**Pattern**: Each route file manually constructs responses:
- scanRoutes.js:98-126 - Pattern A (domain-specific status)
- transactionRoutes.js:63-70 - Pattern B (generic success/error)
- videoRoutes.js:68-201 - Pattern C (simple success flag)
- sessionRoutes.js:29 - Pattern Session (toAPIResponse())

**Issue**: No shared response building utility → 4 different patterns → Inconsistent APIs

**Implication**:
- Refactoring to Decision #3 (RESTful HTTP) requires updating all route files
- Without shared builder, inconsistency will persist
- Each developer will create their own pattern

**Contract Alignment**:
- Decision #3 requires consistent HTTP responses
- Need src/utils/responseBuilder.js with success(), error() helpers
- All routes should use shared builder

**Action Required**: Create response builder utility before refactoring routes
```

---

## Step-by-Step Investigation Process

### Phase 6.1: Backend File Structure Investigation

**Duration**: 4-5 hours actual (vs. 2-3 hours estimated)
**Status**: ✅ **100% COMPLETE** (7 of 7 sub-phases done)

**Steps**:

1. **Complete File Inventory** ✅ COMPLETE (30 min actual)
   - ✅ Listed all 46 backend files with line counts
   - ✅ Documented directory structure (9 directories)
   - ✅ Identified large files (stateService 675, videoQueueService 698, adminRoutes 459)
   - **Finding #1 logged** in work/FILE-STRUCTURE-FINDINGS.md

2. **Route Files Analysis** ✅ COMPLETE (60 min actual)
   - ✅ Read all 7 route files systematically
   - ✅ Identified 7 different response patterns (architectural chaos)
   - ✅ Documented 74 manual response constructions (no shared builder)
   - ✅ Found 92 lines of duplicated auth code (4 instances)
   - ✅ Mapped to contracts: 21 of 29 endpoints ELIMINATED (72% reduction)
   - ✅ Identified 870 lines of route code to remove (66% reduction)
   - **Findings #2-#13 logged** (12 comprehensive findings)

3. **Service Files Analysis** ✅ COMPLETE (75 min actual)
   - ✅ Read all 9 service files
   - ✅ Documented singleton pattern inconsistency (7 consistent, 2 inconsistent)
   - ✅ Found scannerId vs deviceId violations (Critical - Decision #4 violation)
   - ✅ Identified 6 test pollution instances across 5 files
   - ✅ Discovered circular service dependencies (require-inside-methods pattern)
   - ✅ Noted EventEmitter pattern (GOOD architecture - 7 of 9 services)
   - **Findings #14-#20 logged** (7 comprehensive findings)

4. **WebSocket Files Analysis** ✅ COMPLETE (60 min actual)
   - ✅ Read all 9 WebSocket files (eventWrapper.js, broadcasts.js, adminEvents.js, deviceTracking.js, gmAuth.js, listenerRegistry.js, roomManager.js, socketServer.js, videoEvents.js)
   - ✅ CRITICAL: eventWrapper.js implements Decision #2 perfectly but NEVER USED (Finding #21)
   - ✅ Documented 4 different wrapping patterns (62% non-compliant, Finding #22)
   - ✅ Identified 11 eliminated events still emitted (Findings #25-#27)
   - ✅ Found scannerId in broadcasts.js transaction:new (Finding #28)
   - ✅ Found session:update wrong structure (Finding #29 - Decision #7 violation)
   - ✅ Identified good pattern: listenerRegistry cleanup mechanism (Finding #32)
   - **Findings #21-#32 logged** (12 comprehensive findings)

5. **Middleware & Utilities Analysis** ✅ COMPLETE (45 min actual)
   - ✅ Read middleware/auth.js, offlineStatus.js
   - ✅ Audited utils/logger.js, validators.js
   - ✅ CRITICAL: validators.js ENFORCES scannerId (Finding #34 - blocking issue)
   - ✅ Identified missing responseBuilder utility (Finding #33)
   - ✅ Identified missing WebSocket validation schemas (Finding #36)
   - ✅ Found dead code: videoControlSchema for eliminated endpoint (Finding #35)
   - ✅ Documented good pattern: logger helper methods (Finding #38)
   - **Findings #33-#39 logged** (7 comprehensive findings)

6. **Models Analysis** ✅ COMPLETE (60 min actual)
   - ✅ Read all 8 model files (transaction.js, session.js, deviceConnection.js, teamScore.js, gameState.js, token.js, videoQueueItem.js, adminConfig.js)
   - ✅ ROOT CAUSE: Transaction.toJSON() DEFINES scannerId field (Finding #40 - source of systemic violation)
   - ✅ ANTI-PATTERN: Session.toAPIResponse() mixes concerns (Finding #41 - DELETE)
   - ✅ Documented 3 serialization patterns across 8 models (Finding #42)
   - ✅ Verified strong foundations: 100% Joi validation, rich business logic (Finding #43)
   - **Findings #40-#43 logged** (4 comprehensive findings)
   - **Answered critical questions**: toAPIResponse anti-pattern, scannerId root cause, serialization inconsistency

7. **Dependency Mapping** ✅ COMPLETE (45 min actual)
   - ✅ Mapped all 150+ import statements across 46 backend files
   - ✅ Identified circular service triangle (sessionService ↔ stateService ↔ transactionService)
   - ✅ Documented 8 lazy require instances (anti-pattern breaking circular deps)
   - ✅ Created visual ASCII dependency graphs
   - ✅ Mapped tight coupling points for atomic refactor coordination
   - ✅ Documented cross-layer violation (stateService → listenerRegistry)
   - ✅ Analyzed DI absence and recommended manual DI pattern
   - ✅ Created standalone comprehensive map: docs/api-alignment/work/DEPENDENCY-MAP-PHASE-6-1-7.md
   - **Findings #44-#49 logged** (6 comprehensive findings)

**Outputs**:
- Atomic findings in work/FILE-STRUCTURE-FINDINGS.md (Backend section)
- **Part 1: Backend Structure** written in 10-file-structure-current.md (organized analysis)

**CHECKPOINT**: After Phase 6.1 completes, immediately write Part 1 of 10-file-structure-current.md from backend findings

---

### Phase 6.2: Scanner File Structure Investigation

**Duration**: 1-2 hours

**Steps**:

1. **GM Scanner Internal Structure** (45 min)
   - Read ALNScanner/index.html
   - Document internal organization (how is 260KB structured?)
   - Identify logical sections (UI, WebSocket, HTTP, game logic, etc.)
   - Note modularization opportunities
   - Check for code duplication with Player Scanner
   - **Log findings as discovered**

2. **Player Scanner Structure** (30 min)
   - Read aln-memory-scanner/index.html
   - Read js/orchestratorIntegration.js
   - Document module separation
   - Note ESP32-compatibility patterns
   - Identify reusable components
   - **Log findings as discovered**

3. **Shared Code Analysis** (15 min)
   - Compare GM vs Player scanners
   - Identify duplicate code (token parsing, localStorage, etc.)
   - Note shared utility opportunities
   - Check ALN-TokenData submodule usage
   - **Log findings as discovered**

**Outputs**:
- Atomic findings in work/FILE-STRUCTURE-FINDINGS.md (Scanner section)
- **Part 2: Scanner Structure** written in 10-file-structure-current.md (organized analysis)

**CHECKPOINT**: After Phase 6.2 completes, immediately write Part 2 of 10-file-structure-current.md from scanner findings

---

### Phase 6.3: Player Scanner Investigation ✅ COMPLETE

**Duration**: 1 hour (completed 2025-10-01)

**Execution**:

1. **File Structure Analysis**
   - Analyzed 3 main files: index.html (1,322 lines), orchestratorIntegration.js (235 lines), sw.js (240 lines)
   - Total: ~1,800 lines (vs GM Scanner 6,428-line monolith)
   - Documented modular architecture strength

2. **Contract Alignment Analysis**
   - Decision #4 (deviceId): 1 critical violation found (lines 44, 116 send scannerId)
   - Decision #9 (fire-and-forget): PERFECT compliance validated
   - Decision #10 (error display): Console-only violation found

3. **Architectural Patterns**
   - Fire-and-forget HTTP pattern validated (ignores response bodies)
   - Offline queue architecture analyzed (deduplication, batch processing, localStorage persistence)
   - Service worker offline capability documented (dual cache strategy, background sync)

**Findings**:
- **9 findings documented** (Findings #59-#67)
- **5 strengths identified** (cleanest architecture in system)
- **1 critical violation** (sends scannerId field)
- **2 important violations** (wrong health check endpoint, console-only errors)

**Outputs**:
- ✅ work/PLAYER-SCANNER-FILE-STRUCTURE-FINDINGS.md (643 lines, 9 findings)
- ✅ **Part 3: Player Scanner Structure** written in 10-file-structure-current.md (634 lines)

**Key Discovery**: Player Scanner has MUCH cleaner architecture than GM Scanner (modular vs monolith, 5 strengths vs 0)

**Note**: Test investigation NOT needed here - already completed comprehensively in Phase 4.5 + post-mortem

---

### Phase 6.4: Cross-Cutting Concerns Analysis ⏳ NEXT

**Duration**: 1-2 hours

**Method**: Deep analysis of existing 10-file-structure-current.md (Parts 1-3, 3,450+ lines) to identify cross-cutting patterns, supplemented by targeted investigations

**Primary Analysis** (Mine Parts 1-3 for patterns):

1. **Atomic Refactor Coordination** (30 min)
   - Synthesize all ATOMIC refactors from Backend/GM/Player findings
   - Map exact coordination points (which files must change together)
   - Identify breaking change sequences
   - Document deployment coordination strategy

2. **Shared Patterns Across Components** (30 min)
   - Error handling patterns (console-only violations in all 3 components)
   - Field naming patterns (deviceId/scannerId violations across system)
   - Event wrapping patterns (backend inconsistencies, scanner defensive code)
   - Offline resilience patterns (Player Scanner strengths, GM Scanner gaps)

3. **System-Wide Architectural Patterns** (20 min)
   - Singleton services (backend) vs class instances (scanners)
   - EventEmitter usage (backend strength)
   - Defensive normalization layers (scanners compensating for backend)
   - State management approaches (different in each component)

**Supplemental Investigations** (New research):

4. **Submodule Architecture** (20 min)
   - ALN-TokenData integration in backend vs scanners
   - Data loading patterns (backend direct, scanners nested submodule)
   - Deployment coordination (submodule updates across repos)

5. **Deployment & Network Patterns** (20 min)
   - GitHub Pages deployment (scanners standalone mode)
   - UDP discovery service (backend network flexibility)
   - PM2 ecosystem (backend production deployment)

**Outputs**:
- ⏳ work/CROSS-CUTTING-FINDINGS.md (if new findings warrant separate document)
- ⏳ **Part 4: Cross-Cutting Concerns** in 10-file-structure-current.md (comprehensive synthesis)

**Key Focus**: Identify system-wide coordination requirements for Phase 6.5 target structure decisions

**Context**: Pre-production state - planning complete backend + scanner + test refactor

---

## Documentation Process During Investigation

### Continuous Documentation

**Working Document: work/FILE-STRUCTURE-FINDINGS.md**

Pattern (like Phase 2 work/FINDINGS-LOG.md):
```markdown
# File Structure Investigation Findings

**Created**: 2025-10-01
**Status**: In Progress

## Backend Findings

### Finding #1: [Title]
[Full finding details as per template above]

### Finding #2: [Title]
[Full finding details]

## Scanner Findings

### Finding #20: [Title]
[Full finding details]

## Test Findings

### Finding #35: [Title]
[Full finding details]

## Cross-Cutting Findings

### Finding #45: [Title]
[Full finding details]
```

**Update Frequency**: After each analysis step (every 30-45 min)

---

### Checkpoint Strategy

**Checkpoint 1: After Backend Investigation** (Phase 6.1 complete)
- Save work/FILE-STRUCTURE-FINDINGS.md (Backend section)
- Update 00-INDEX.md "Last Updated"
- Commit findings to git

**Checkpoint 2: After Scanner Investigation** (Phase 6.2 complete)
- Save work/FILE-STRUCTURE-FINDINGS.md (Scanner section added)
- Update 00-INDEX.md
- Commit findings

**Checkpoint 3: After Test Investigation** (Phase 6.3 complete)
- Save work/FILE-STRUCTURE-FINDINGS.md (Test section added)
- Update 00-INDEX.md
- Commit findings

**Checkpoint 4: Investigation Complete**
- Create 10-file-structure-current.md (comprehensive analysis document)
- Update 00-INDEX.md (Phase 6.1-6.4 complete)
- Commit complete findings

---

### Final Documentation Outputs

**10-file-structure-current.md**:

Structure:
```markdown
# Current File Structure Analysis

**Date**: 2025-10-01
**Purpose**: Complete file organization audit for refactor planning

## Executive Summary
- Total files analyzed
- Key findings summary
- Critical issues identified
- Refactor priorities

## Part 1: Backend Structure
### 1.1 Route Files
[Detailed analysis with file:line references]

### 1.2 Service Files
[Detailed analysis]

### 1.3 WebSocket Files
[Detailed analysis]

### 1.4 Middleware & Utilities
[Detailed analysis]

### 1.5 Dependency Map
[Visual dependency graph + analysis]

## Part 2: Scanner Structure
### 2.1 GM Scanner
[Detailed analysis of 260KB monolith]

### 2.2 Player Scanner
[Detailed analysis]

### 2.3 Shared Code Analysis
[Duplication identification]

## Part 3: Test Structure
### 3.1 Unit Tests
[Current state + extraction opportunities]

### 3.2 Integration Tests
[Current state + consolidation needs]

### 3.3 Contract Tests
[Current state + ajv migration needs]

### 3.4 Test Helpers
[Current state + missing helpers]

## Part 4: Cross-Cutting Concerns
### 4.1 Utilities
[What exists, what's missing]

### 4.2 Error Handling
[Current patterns, consolidation opportunities]

### 4.3 Common Patterns
[Documented patterns, inconsistencies]

## Part 5: Critical Issues Summary
[Prioritized list of structural problems]

## Part 6: Contract Alignment Analysis
[Map current structure → target contracts]
[Identify gaps, required new files, files to delete]
```

**11-file-structure-target.md**:

**IMPORTANT**: This document is **NOT** written all at once. It is built **iteratively through collaborative decision-making** (like 04-alignment-decisions.md was created).

**Process**:
1. Investigation complete → 10-file-structure-current.md written
2. Identify all target structure decisions needed
3. For each decision:
   - Claude presents: Context + Options + Recommendation + Rationale
   - User decides
   - Log decision in 11-file-structure-target.md
   - Move to next decision
4. Repeat until all decisions made

**Final Structure** (built progressively):
```markdown
# Target File Structure Design

**Date**: 2025-10-01
**Purpose**: Proposed file organization aligned with contracts
**Based On**: 10-file-structure-current.md + contract requirements
**Method**: Collaborative decision-by-decision (like Phase 4)

## Decision Log

### Decision #1: [Title]
**Context**: [Current state + problem]
**Options**: [A, B, C with pros/cons]
**Decision**: [What we chose]
**Rationale**: [Why we chose it]
**Impact**: [What changes]
**References**: [Related contract decisions, requirements]

### Decision #2: [Title]
[Same structure]

[... etc for all decisions]

## Part 1: Target Backend Structure
[Synthesized from decisions]

## Part 2: Target Scanner Structure
[Synthesized from decisions]

## Part 3: Target Test Structure
[Synthesized from decisions]

## Part 4: Migration Strategy
[Derived from decisions + dependencies]

## Part 5: Risk Assessment
[Based on decisions]

## Part 6: Validation Checkpoints
[Based on decisions]
```

---

## Success Criteria for Phase 6 INVESTIGATION

**Phase 6 Investigation Complete When**:

- [✅] All backend files inventoried and analyzed
- [✅] All scanner files inventoried and analyzed
- [✅] All test files inventoried and analyzed
- [✅] Atomic findings documented (numbered, traceable) as discoveries emerge
- [✅] Dependency map created
- [✅] Code duplication catalog created
- [✅] 10-file-structure-current.md created with all 4 parts (Backend, Scanner, Test, Cross-Cutting)
- [✅] work/FILE-STRUCTURE-FINDINGS.md saved (checkpoint log)
- [✅] Target structure decisions identified and ready for collaborative process
- [✅] 00-INDEX.md updated to reflect Phase 6.1-6.4 complete

**NOTE**: 11-file-structure-target.md is **NOT** created during investigation. It's built iteratively through collaborative decision-making AFTER investigation completes.

**Quality Criteria**:

- [✅] File:line precision for all findings
- [✅] Every claim backed by code reading (not assumptions)
- [✅] Multiple access patterns in final documents
- [✅] Clear traceability from findings → target structure → refactor plan
- [✅] Documents designed to survive context compaction

---

## Phase 6 COLLABORATIVE DECISION PROCESS (After Investigation)

**When**: After 10-file-structure-current.md is complete

**Process** (following Phase 4 pattern):

### Step 1: Identify All Target Structure Decisions

From 10-file-structure-current.md findings, create list of decisions needed:
- Backend route organization
- Service structure (split/consolidate)
- WebSocket handler organization
- Utility creation (response builder, event wrapper, etc.)
- Scanner modularization
- Test file organization
- Helper structure
- etc.

### Step 2: Decision-by-Decision Collaboration

For **each** decision:

**Claude Presents**:
```markdown
## Decision #N: [Title]

**Context**:
- Current state (from 10-file-structure-current.md Finding #X)
- Problem identified
- Contract requirement

**Options**:
A. [Option A]
   - Pros: ...
   - Cons: ...
   - Example: ...

B. [Option B]
   - Pros: ...
   - Cons: ...
   - Example: ...

C. [Option C]
   - Pros: ...
   - Cons: ...
   - Example: ...

**Recommendation**: Option B
**Rationale**:
- Aligns with Decision #X from 04-alignment-decisions.md
- Follows best practice Y
- Minimizes risk because Z

**Questions for User**:
1. Specific question about context
2. Preference on approach
```

**User Decides**: Chooses option (or proposes new option, or asks for more info)

**Claude Logs**:
- Immediately append decision to 11-file-structure-target.md
- Update document structure based on decision
- Move to next decision

### Step 3: Synthesize Final Structure

After all decisions made:
- Write summary sections in 11-file-structure-target.md
- Create visual structure diagrams
- Document migration strategy
- Assess risks
- Define validation checkpoints

**Duration**: 2-4 hours depending on number of decisions (~20-30 decisions expected)

---

## Integration with Existing Memory

**This Investigation Feeds**:

**Phase 7** (07-refactor-plan.md):
- Exact file locations for changes
- Dependency order for refactoring
- New file creation requirements
- File deletion/consolidation plan

**Existing Documents It References**:

**Authoritative/Current** (use for guidance):
- contracts/*.yaml (Phase 5 - target API specifications)
- 04-alignment-decisions.md (12 strategic decisions - target architecture)
- 06-test-architecture.md (Post-Phase 5 update - test strategy)
- 08-functional-requirements.md (what components should do)
- 09-essential-api-list.md (24 essential APIs)
- work/TEST-CLEANUP-PLAN.md (Post-Phase 5 - test cleanup)

**Historical/Diagnostic** (use for context, not guidance):
- 01-current-state.md (Phase 1 - diagnosed broken backend state)
- 02-scanner-analysis.md (Phase 2 - diagnosed scanner issues)
- 03-alignment-matrix.md (Phase 3 - verified mismatches)
- 05-test-analysis.md (Phase 4.5 - diagnosed test issues, superseded by 06)

**Documents It Updates**:
- 00-INDEX.md (progress tracking)

---

## Context Recovery After Phase 6

**If context is lost after Phase 6 Investigation** (before decisions):

1. **Read 00-INDEX.md** (5 min) - Understand investigation complete, decisions pending
2. **Read PHASE-6-FILE-STRUCTURE-INVESTIGATION-PLAN.md** (10 min) - Understand process
3. **Read 10-file-structure-current.md** (30 min) - Understand current organization
4. **Skim work/FILE-STRUCTURE-FINDINGS.md** (10 min) - Review specific findings if needed

**Total recovery time**: ~55 minutes for investigation context

---

**If context is lost after Phase 6 Decisions Complete**:

1. **Read 00-INDEX.md** (5 min) - Understand Phase 6 complete
2. **Read 11-file-structure-target.md** (20 min) - Understand all decisions made
3. **Skim 10-file-structure-current.md** (15 min) - Context for why decisions made
4. **Skim work/FILE-STRUCTURE-FINDINGS.md** (10 min) - Specific finding details if needed

**Total recovery time**: ~50 minutes for complete Phase 6 context

---

## Notes on Methodology Evolution

**Why This Investigation is Different from Phases 1-3**:

**Phases 1-3**: Analyzed APIs (what the system does)
**Phase 6**: Analyzes code organization (how the system is structured)

**Same Methodology Applied**:
- Exhaustive analysis
- File:line precision
- Atomic findings
- Primary source verification
- Multiple access patterns

**New Concerns**:
- Dependency mapping (wasn't relevant for API analysis)
- Code duplication (wasn't visible from API contracts)
- File organization patterns (new analysis dimension)
- Testability assessment (code structure determines testability)

**Collaborative Approach Maintained**:
- Present findings (10-file-structure-current.md)
- Propose target structure (11-file-structure-target.md)
- Get user approval on major structural decisions
- Iterate based on feedback

---

**Investigation Ready to Execute**

**Estimated Timeline**:

**Part A: Investigation** (Phases 6.1-6.4)
- Phase 6.1 (Backend): 2-3 hours
- Phase 6.2 (Scanners): 1-2 hours
- Phase 6.3 (Tests): 1-2 hours
- Phase 6.4 (Cross-Cutting): 0.5-1 hour
- Documentation (10-file-structure-current.md): 2-3 hours
- **Subtotal**: 8-12 hours

**Part B: Collaborative Decisions** (Phase 6.5)
- Identify decisions needed: 0.5 hour
- Decision-by-decision collaboration: 2-4 hours (number of decisions emerges from investigation)
- Synthesize final structure: 1-2 hours
- **Subtotal**: 3.5-6.5 hours

**Total Phase 6 (Actual)**: ~16 hours
- Investigation (6.1-6.4): ~12 hours
- Decisions (6.5): ~4 hours

**Next Steps**:
1. ✅ Update 00-INDEX.md to reflect Phase 6 plan
2. ✅ Get user approval to begin
3. ✅ Execute investigation (Phases 6.1-6.4)
4. ✅ Write 10-file-structure-current.md (4,074 lines, 67 findings)
5. ✅ Execute collaborative decision process (Phase 6.5)
6. ✅ Write 11-file-structure-target.md (560+ lines, 3 decisions)
7. ⏳ **NEXT**: Begin Phase 6.6 (Synthesize Refactor Plan)

---

*Plan Created: 2025-10-01*
*Investigation Complete: 2025-10-01 (Phase 6.1-6.4)*
*Decisions Complete: 2025-10-02 (Phase 6.5)*
*Status: ✅ PHASE 6.1-6.5 COMPLETE - Ready for Phase 6.6*
