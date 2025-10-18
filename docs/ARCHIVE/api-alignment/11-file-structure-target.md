# Target File Structure Design

**Created**: 2025-10-02
**Status**: 🔄 IN PROGRESS - Building through collaborative decisions
**Purpose**: Define target file organization aligned with contracts
**Based On**: 10-file-structure-current.md (investigation) + contract requirements
**Method**: Collaborative decision-by-decision (like Phase 4)

---

## Overview

This document defines the **target file structure** for the ALN system after API alignment refactoring. Each decision was made collaboratively with full context analysis, grounded in:

- Investigation findings (10-file-structure-current.md - 67 findings)
- Contract requirements (backend/contracts/*.yaml)
- Strategic decisions (04-alignment-decisions.md - 12 decisions)
- Functional requirements (08-functional-requirements.md)
- Engineering best practices (minimal complexity, maintainability, testability)

**Core Principle**: Structure follows contracts, supports minimal architectural complexity

---

## Decision Log

### Decision #1: Backend Route File Organization

**Status**: ✅ APPROVED
**Date**: 2025-10-02

#### Context

**Current State**: 8 route files serving 29 HTTP endpoints
**After Elimination** (Finding #13): 8 essential endpoints across 5-6 files

Current files:
- adminRoutes.js (11 endpoints) → **2 kept** (auth, logs)
- docsRoutes.js (static docs)
- scanRoutes.js (2 endpoints) → **2 kept**
- sessionRoutes.js (5 endpoints) → **1 kept**
- stateRoutes.js (2 endpoints) → **1 kept**
- tokenRoutes.js (1 endpoint) → **1 kept**
- transactionRoutes.js (4 endpoints) → **0 kept** (all eliminated)
- videoRoutes.js (1 endpoint) → **0 kept** (eliminated)
- app.js (1 inline health endpoint)

**Problem**: After 72% endpoint reduction, do we keep 5-6 small route files or consolidate further?

#### Options Considered

**Option A: 5 Route Files** (Resource-Based)
- adminRoutes.js (2: auth, logs) ~110 lines
- scanRoutes.js (2: scan, batch) ~170 lines
- sessionRoutes.js (1: session) ~40 lines
- stateRoutes.js (1: state) ~50 lines
- resourceRoutes.js (2: tokens, health) ~40 lines

**Pros**: RESTful organization, clear semantics, balanced sizes
**Cons**: 5 files for 8 endpoints might be more than strictly necessary

**Option B: 3 Files** (Feature-Based)
- adminRoutes.js, scanRoutes.js, apiRoutes.js (grab-bag)
**Cons**: apiRoutes.js lacks semantic clarity

**Option C: 4 Files** (Balanced)
- authRoutes.js, scanRoutes.js, stateRoutes.js, resourceRoutes.js
**Cons**: Breaks admin grouping, mixes concerns (logs with state/session)

**Option D: 6 Files** (No Consolidation)
- Keep current structure, just delete eliminated endpoints
**Cons**: 6 files for 8 endpoints (over-fragmented), 4 single-endpoint files

#### Decision: Option A - 5 Route Files (Resource-Based)

#### Rationale

1. **RESTful Best Practice**: Resource-based organization
   - adminRoutes.js: Admin operations (auth, logs)
   - scanRoutes.js: Player scanner operations (scan, batch)
   - sessionRoutes.js: Session resource (current session info)
   - stateRoutes.js: Game state (debug/recovery)
   - resourceRoutes.js: Static resources (tokens, health)

2. **Balanced File Sizes**:
   - Largest: scanRoutes.js (~170 lines, 2 complex endpoints)
   - Balanced: adminRoutes.js (~110 lines)
   - Small but semantically distinct: session/state (~40-50 lines each)
   - Utility: resourceRoutes.js (~40 lines, simple GETs)

3. **Clear Semantics**: Each file has cohesive purpose, no "grab-bag" files

4. **Minimal Consolidation**: Only merging tokenRoutes + health (both static resources)

5. **Future-Proof**: Natural file to extend if endpoints added

6. **Preserves Separation**: Session and state separate despite single endpoints (different purposes)

#### Impact

**Files to DELETE**:
- transactionRoutes.js (all 4 endpoints moved to WebSocket)
- videoRoutes.js (moved to WebSocket gm:command)
- tokenRoutes.js (merged into resourceRoutes.js)

**Files to PRUNE** (~870 lines removed):
- adminRoutes.js: Remove 9 of 11 endpoints, keep auth + logs
- sessionRoutes.js: Remove 4 of 5 endpoints, keep GET /api/session
- stateRoutes.js: Remove GET /api/status, keep GET /api/state

**Files to CREATE**:
- resourceRoutes.js: Merge GET /api/tokens (from tokenRoutes.js) + GET /health (from app.js)

**Files to UPDATE**:
- app.js: Remove route registrations for deleted files, add resourceRoutes

**Result**: 5 route files serving 8 essential endpoints
- adminRoutes.js (2 endpoints: POST /api/admin/auth, GET /api/admin/logs)
- scanRoutes.js (2 endpoints: POST /api/scan, POST /api/scan/batch)
- sessionRoutes.js (1 endpoint: GET /api/session)
- stateRoutes.js (1 endpoint: GET /api/state)
- resourceRoutes.js (2 endpoints: GET /api/tokens, GET /health)

**Estimated Effort**: 2 hours (deletion + consolidation + testing)
**Risk**: 🟢 Low (well-defined deletions, simple consolidation)

#### References

- Finding #13: Route File Elimination Summary (21 endpoints eliminated)
- Phase 4.9: Essential API List (8 HTTP endpoints defined)
- backend/contracts/openapi.yaml: Target HTTP API contracts

---

### Decision #2: GM Scanner Modularization Strategy

**Status**: ✅ APPROVED
**Date**: 2025-10-02

#### Context

**Current State**: 6,428-line monolith in single index.html

**Internal Structure**: 14 well-organized modules within single file:
- CONFIG (8 lines)
- AdminModule (~304 lines)
- Debug (~69 lines)
- NFCHandler (~150 lines)
- TokenManager (~252 lines)
- DataManager (~735 lines) - Core game logic
- UIManager (~528 lines) - Missing error display
- Settings (~49 lines)
- App (~917 lines) - Orchestrator
- SessionModeManager (~98 lines)
- ConnectionManager (~403 lines) - 19 WebSocket handlers
- StandaloneDataManager (~127 lines)
- NetworkedQueueManager (~164 lines)
- OrchestratorClient (~857 lines)

**Architecture is good**: Modules have clear boundaries, just need file separation

**Reference Pattern**: Player Scanner (Finding #66 - STRENGTH)
- 3 files, modular structure (~1,800 lines total)
- Clean separation: index.html + js/orchestratorIntegration.js + sw.js
- Simple script tag loading, no build step (Gap #6 confirmed)
- PWA compatible

**GM Scanner is 3.6x larger** (6,428 vs 1,800 lines)

**Problem**: Should we externalize the modular structure that already exists internally?

#### Options Considered

**Option A: Keep Monolith** (Minimal Changes)
- Single index.html, fix violations only
- Pros: Minimal effort (2-3 hours), no refactoring risk
- Cons: Still 6,428 lines, can't unit test modules, hard to navigate

**Option B: Split into Separate Files** (Like Player Scanner)
- Modular file organization using proven script tag pattern
- 15 JS files organized in directories (core, network, ui, app, utils)
- Pros: Maintainable, testable, clean architecture, merge-friendly
- Cons: Higher effort (8-12 hours), refactoring risk

**Option C: Internal Reorganization Only**
- Keep single file, improve internal organization (comments, ordering)
- Pros: Improved navigation, lower effort
- Cons: Band-aid solution, still can't test modules, 6,428 lines remains

#### Decision: Option B - Split into Separate Files

#### Rationale

1. **Architecture Already Modular**:
   - 14 distinct modules already exist with clear boundaries
   - Dependencies already mapped (Gap #2)
   - We're not creating structure, we're externalizing existing structure

2. **Player Scanner Proves Pattern Works** (Finding #66 - STRENGTH):
   - Modular file structure already successful
   - Same loading pattern (script tags, Gap #6 confirmed)
   - PWA compatible, no build step required
   - Pattern is proven, not experimental

3. **Significant Benefits for Manageable Risk**:
   - Maintainability: Find code in seconds via file names
   - Testability: Unit test modules in isolation
   - Clean architecture: Separation of concerns enforced
   - Merge-friendly: Multiple developers, fewer conflicts
   - For 6,428-line file, benefits are substantial

4. **Risk is Manageable**:
   - Functionality doesn't change (just file organization)
   - Modules already independent (removing file boundaries, not creating modules)
   - Can test incrementally (split one module at a time)
   - Circular dependency manageable (Decision #3 - event-based)

5. **Pre-Production is the Time**:
   - No users affected
   - Can break and fix
   - Harder to refactor after production
   - If not now, when?

6. **Aligns with Minimal Complexity Principle**:
   - Clean architecture > monolithic simplicity
   - 15 small files easier to understand than 1 huge file
   - Testability reduces overall system complexity

#### Impact

**Target Structure**:
```
ALNScanner/
├── index.html              ~1,500 lines (HTML/CSS + App initialization)
├── js/
│   ├── core/
│   │   ├── dataManager.js           ~735 lines (game logic)
│   │   ├── standaloneDataManager.js ~127 lines
│   │   └── tokenManager.js          ~252 lines
│   ├── network/
│   │   ├── connectionManager.js     ~403 lines (WebSocket)
│   │   ├── networkedQueueManager.js ~164 lines
│   │   └── orchestratorClient.js    ~857 lines
│   ├── ui/
│   │   ├── uiManager.js             ~528 lines (DOM manipulation)
│   │   └── settings.js              ~49 lines
│   ├── app/
│   │   ├── app.js                   ~917 lines (orchestrator)
│   │   └── sessionModeManager.js    ~98 lines
│   └── utils/
│       ├── nfcHandler.js            ~150 lines
│       ├── adminModule.js           ~304 lines
│       ├── debug.js                 ~69 lines
│       └── config.js                ~8 lines
└── sw.js                            (existing service worker)

Total: ~1,500 lines in index.html + ~5,661 lines in 15 JS files
```

**Loading Pattern** (proven by Player Scanner, Gap #6):
```html
<!-- Load in dependency order -->
<script src="js/utils/config.js"></script>
<script src="js/utils/debug.js"></script>
<script src="js/core/tokenManager.js"></script>
<script src="js/core/dataManager.js"></script>
<!-- ... etc -->
```

**Module Communication**: Event-based per Decision #3
- DataManager emits events (transaction:added, scores:updated)
- UIManager listens to DataManager events
- No circular dependencies (one-way flow)

**Implementation Approach**: Phased (extract utilities → core → UI → network → app)
- Phase 1: Extract utils/ (validate pattern)
- Phase 2-5: Extract remaining modules incrementally
- Phase 6: Fix contract violations (scannerId → deviceId, error display)
- Validate functional equivalence after each phase

**Files Affected**: 1 monolith → 15 modular files + index.html

**Estimated Effort**: 12 hours
- Phases 1-5: 10 hours (2 hours per phase, incremental splitting)
- Phase 6: 2 hours (contract violations after structure is solid)

**Risk**: 🟡 Medium (functional risk manageable, effort significant)

**Validation Strategy**: After each phase, ensure app works THE SAME WAY (bugs and all)
- NOT testing correctness (bugs still exist)
- Testing functional equivalence (same behavior after file split)
- Fix bugs AFTER structure is solid (separate concerns)

#### References

- Finding #56: Internal Module Structure (14 modules identified)
- Finding #66: Player Scanner Modular Architecture (STRENGTH - use as reference)
- Gap #2: GM Scanner Module Dependencies (mapped for splitting)
- Gap #6: File Loading Pattern (script tags, no build step confirmed)
- Decision #3: Event-Based Communication (resolves circular dependencies)

---

### Decision #3: System-Wide Circular Dependency Pattern

**Status**: ✅ APPROVED
**Date**: 2025-10-02

#### Context

**Circular dependencies exist in multiple components**:

1. **Backend Services** (Finding #44):
   - Triangle: sessionService ↔ stateService ↔ transactionService
   - Current solution: 8 lazy `require()` statements inside methods (anti-pattern)
   - Problem: Hidden dependencies, fragile, hard to test

2. **GM Scanner Modules** (Gap #2):
   - DataManager ↔ UIManager
   - Current solution: Global singletons with direct method calls
   - Problem: Tight coupling, hard to test, no explicit dependencies

**Critical Discovery** (User observation): We already have rigorous event contracts in `backend/contracts/asyncapi.yaml` for 16 WebSocket events. Same pattern should apply to internal service events.

**Problem**: What pattern should we use **system-wide** to handle circular dependencies?

#### Options Considered

**Option A: Event-Based Communication** (EventEmitter Pattern)
- Services emit events, other services listen
- Breaks circular dependencies completely (one-way flow)
- Leverages existing EventEmitter (7 of 9 backend services already extend it - Finding #17)
- Browser has built-in EventTarget for GM Scanner

**Option B: Dependency Injection with Setter Pattern**
- Constructor injection + setDependencies() for circular refs after construction
- Keeps direct method calls (easier to trace)
- Still allows circular dependencies (doesn't break cycle, defers wiring)

**Option C: Keep Current Patterns**
- Backend: Lazy requires
- GM Scanner: Global singletons
- Zero effort, zero risk, but perpetuates technical debt

**Option D: Mediator Pattern**
- Central coordinator, components communicate through mediator
- Adds complexity, mediator becomes "god object"

#### Decision: Option A - Event-Based Communication

#### Rationale

1. **Leverages Existing Infrastructure**:
   - Backend: 7 of 9 services already extend EventEmitter (Finding #17 - STRENGTH)
   - GM Scanner: Browser has built-in EventTarget
   - We already have the tools, just need to use them properly

2. **Truly Breaks Circular Dependencies**:
   - Option B (DI + Setter) still has circular deps, just defers wiring
   - Option A eliminates circular deps completely (one-way dependency flow)
   - Solves root cause, not symptoms

3. **Best Practice for This Pattern**:
   - Observer pattern is established solution for decoupling
   - Event-driven architecture is standard for complex systems
   - Not inventing new pattern, using proven approach

4. **Testability**:
   - Can spy on events in tests
   - Can inject mock listeners
   - Emitters are independent (test without listeners)

5. **Scalability**:
   - Easy to add new listeners without changing emitter
   - Clear event contracts (like API contracts)
   - Components remain independent

6. **Aligns with Event-Driven System**:
   - Backend already event-driven (services emit events)
   - WebSocket layer already event-based
   - GM Scanner already has event handlers (WebSocket)
   - Consistent pattern across entire system

7. **Contract-First Consistency**:
   - We already document external events rigorously (asyncapi.yaml)
   - Should document internal events with same rigor
   - Single approach for all event contracts

#### Impact

**Backend Services**:
- Convert lazy `require()` to event emit/listen pattern
- sessionService emits events (session:ended, session:paused, session:resumed)
- stateService and transactionService LISTEN to sessionService events
- Dependency flow becomes one-way: sessionService ← stateService, sessionService ← transactionService

**GM Scanner Modules**:
- DataManager extends EventTarget, emits events (transaction:added, scores:updated)
- UIManager listens to DataManager events, READS DataManager data
- Dependency flow becomes one-way: DataManager ← UIManager
- Data queries (getters) are fine, command calls become events

**Event Contract Documentation**:
- **asyncapi.yaml is the source of truth** for all event contracts (internal + external)
- Domain events (internal service communication) map 1:1 to WebSocket events (external)
- Services document which events they emit/listen in JSDoc comments
- broadcasts.js translates domain events → WebSocket events for GM Scanners
- **No separate internal event system needed** - asyncapi.yaml covers both uses

**Architecture**:
```
Services emit domain events → {
  1. Other services listen (internal coordination)
  2. broadcasts.js listens, translates to WebSocket (external broadcast)
}

Example: sessionService.emit('session:ended')
  → transactionService hears it (resets scores)
  → stateService hears it (resets state)
  → broadcasts.js hears it, sends session:update WebSocket event to GMs
```

**Pattern**:
```javascript
/**
 * Events Emitted:
 * - session:ended (see internal-events.yaml#SessionEnded)
 * - session:paused (see internal-events.yaml#SessionPaused)
 */
class SessionService extends EventEmitter {
  constructor({ persistenceService }) {
    super();
    this.persistenceService = persistenceService;
  }

  endSession() {
    const session = this.getCurrentSession();

    // Emit event per contract
    this.emit('session:ended', {
      sessionId: session.id,
      endTime: new Date().toISOString(),
      finalScores: session.scores
    });
  }
}

/**
 * Events Listened To:
 * - session:ended (see internal-events.yaml#SessionEnded)
 */
class StateService extends EventEmitter {
  constructor({ persistenceService, sessionService }) {
    super();
    this.persistenceService = persistenceService;

    // Listen per contract
    sessionService.on('session:ended', (data) => {
      this.handleSessionEnd(data);
    });
  }
}
```

**Files Affected**:
- Backend: 8 service files (convert lazy requires to events)
- GM Scanner: 2 module files (DataManager, UIManager)
- broadcasts.js: Already listens to domain events, no changes needed
- Tests: Update mocking patterns for event-based communication

**Estimated Effort**:
- Backend: 8-10 hours (convert lazy requires to events, wire listeners)
- GM Scanner: 4-6 hours (convert direct calls to events)
- Total: 12-16 hours (simplified from 14-19 hours - no separate internal contracts needed)

**Risk**: 🟡 Medium (functional equivalence testing required)

#### Trade-offs Acknowledged

**Con: More indirect** (harder to trace in debugger)
- Mitigation: Document event contracts thoroughly
- Mitigation: Use descriptive event names
- Benefit: Better architecture worth slight debugging complexity

**Con: String-based event names** (no compile-time type safety)
- Mitigation: Document event contracts (like API contracts)
- Mitigation: Could use TypeScript in future (type-safe events)
- Note: Same issue with current system (WebSocket events already strings)

**Con: More boilerplate** (emit + addEventListener)
- Reality: Upfront cost, long-term maintainability benefit
- Note: Not significantly more than Option B (which also needs boilerplate)

#### Key Insight: Single Event System

**Critical realization** (from ultrathinking): We don't need separate internal event contracts.

Domain events (service coordination) and WebSocket events (GM communication) are the same events:
- When session ends → services need to know AND GMs need to know
- When scores update → services need to know AND GMs need to know
- When transaction processes → services need to know AND GMs need to know

**asyncapi.yaml documents both uses**:
- Service-to-service (domain events)
- Backend-to-GM (WebSocket events)

**This is simpler, avoids duplication, maintains single source of truth.**

#### References

- Finding #44: Circular Service Dependencies (backend triangle)
- Finding #17: Backend EventEmitter Pattern (7 of 9 services - STRENGTH)
- Gap #2: GM Scanner Module Dependencies (DataManager ↔ UIManager)
- backend/contracts/asyncapi.yaml: Single source of truth for all event contracts
- Decision #2 (Phase 4): Wrapped WebSocket Envelope (event pattern precedent)

---

## Synthesized Sections (To Be Written After All Decisions)

The following sections will be synthesized after all decisions are complete:

### Part 1: Target Backend Structure
- Route file organization (from Decision #1)
- Service layer organization (from Decision #5 - pending)
- Event-based communication (from Decision #3)
- Circular dependency resolution (from Decision #3)
- Utility organization (responseBuilder, eventWrapper, tokenLoader)

### Part 2: Target Scanner Structure
- GM Scanner modularization (from Decision #2 - pending)
- GM Scanner module boundaries (from Decision #4 - pending)
- Event-based module communication (from Decision #3)
- Player Scanner (minimal changes - already excellent architecture)

### Part 3: Target Test Structure
- Already defined in 06-test-architecture.md (no additional decisions needed)
- Reference: contract/, integration/, unit/ organization

### Part 4: Migration Strategy
- File creation order (utilities first, then services, then routes)
- File refactor order (backend services → GM Scanner modules)
- ATOMIC change coordination (backend + scanners + tests together)
- Sequencing to minimize risk

### Part 5: Risk Assessment
- ATOMIC refactor risks (field naming, event wrapping)
- Event-based refactor risks (functional equivalence)
- GM Scanner splitting risks (maintain dual-mode operation)

### Part 6: Validation Checkpoints
- After each file creation (does app still work same way?)
- After each ATOMIC change (backend + scanner coordinated deployment)
- Contract validation (ajv for HTTP/WebSocket/internal events)

---

**Status**: 3 core structural decisions complete ✅
**Remaining**: Implementation tasks (not decisions)
**Last Updated**: 2025-10-02

---

*This document is built incrementally through collaborative decision-making. Each decision is logged immediately after approval before proceeding to the next.*
