# API Alignment Project - Index

**Project Start**: 2025-09-29
**Goal**: Resolve architectural confusion through Contract-First refactoring

---

## Quick Orientation

**Current Phase**: Phase 6.6 - Synthesize Refactor Plan
**Status**: ✅ Phase 6.1-6.5 Complete (67 findings + 3 structural decisions), Phase 6.6 **NEXT**

**What's Complete**:
- ✅ **Diagnosis** (Phases 1-3): Understood broken reality - architectural identity crisis
- ✅ **Resolution** (Phases 4, 4.5): Defined target state - 15 strategic decisions
- ✅ **Functional Requirements** (Phase 4.75): Defined intended functionality
- ✅ **Endpoint Analysis** (Phase 4.9): 24 essential APIs (59% reduction from 59 → 24)
- ✅ **Contracts** (Phase 5): OpenAPI + AsyncAPI specifications for all 24 APIs
- ✅ **Investigation** (Phase 6.1-6.4): Current file structure analysis complete
- ✅ **Target Structure** (Phase 6.5): 3 structural decisions define target organization

**What's Next**:
- ⏳ **Planning** (Phase 6.6): **CURRENT** - Synthesize refactor plan with sequencing
- ⏳ **Transform** (Phase 7): Test-driven implementation

**Key Achievement**: Complete target structure (11-file-structure-target.md) bridges current state (10) with contracts (05) = ready to plan execution

**Last Updated**: 2025-10-02 (Phase 6.5 complete, Phase 6.6 next)

---

## Core Methodology Framework

**The Three-Way Alignment Principle**:

```
WHERE WE ARE (Current State)        WHERE WE'RE GOING (Target State)
     Raw Data                              Decisions
  ↓ 01, 02, 03                          ↓ 04, 06, 08
  ↓ 10 (Phase 6)                        ↓ 09 (Essential APIs)
       ↘                                  ↙
         ↘                              ↙
           CONTRACTS (The Bridge)
        backend/contracts/*.yaml
```

**Why All Three Matter**:
- **Decisions alone** → Don't know how to get there (no migration path)
- **Current state alone** → Don't know where to go (no vision)
- **Contracts alone** → Don't bridge the gap (missing BOTH context sides)

**We're fixing BOTH backend AND scanners. Contracts must align BOTH sides.**

**Example in Practice**:
```
Functional Requirement: "Admin sends commands to orchestrator"
         ↓
Strategic Decision: "Admin uses WebSocket (not HTTP)"
         ↓
Current Reality: "Currently 7 HTTP POST /api/admin/* endpoints"
         ↓
Contract Specifies: "WebSocket gm:command event with action field"
         ↓
Migration Path: "Move 7 HTTP commands → 1 WebSocket event (BREAKING)"
```

---

## Context Recovery for Current Phase

**Phase 6.6: Synthesize Refactor Plan**

*Goal: Create implementation roadmap with exact sequencing*
*Method: Synthesis from multiple sources (Pattern 3) + breaking change coordination (Pattern 5)*
*Output: 07-refactor-plan.md*

### Essential Reading (~60 minutes)

Read these in order to begin Phase 6.6:

**1. [11-file-structure-target.md](./11-file-structure-target.md)** (20 min) - **TARGET STRUCTURE** - PRIMARY
   - Decision #1: Backend route files (5 files resource-based)
   - Decision #2: GM Scanner modularization (split into 15 files across 5 directories)
   - Decision #3: Event-based communication (asyncapi.yaml as single source of truth)
   - **CRITICAL INSIGHT**: Domain events = WebSocket events (no separate internal contracts)
   - **WHERE WE'RE GOING** - 3 decisions define target organization

**2. [10-file-structure-current.md](./10-file-structure-current.md)** (20 min skim) - **CURRENT STATE**
   - Part 1: Backend (46 files → 5 route files + utils)
   - Part 2: GM Scanner (6,428-line monolith → 15 modular files)
   - Part 3: Player Scanner (already excellent - minimal changes)
   - Part 4: 2 ATOMIC refactors + 8 patterns + strengths
   - **WHERE WE ARE** - Synthesis of 67 findings

**3. [backend/contracts/README.md](../backend/contracts/README.md)** (10 min) - **API CONTRACTS**
   - 8 HTTP endpoints (openapi.yaml)
   - 16 WebSocket events (asyncapi.yaml)
   - Breaking changes (MIGRATION-GUIDE.md)
   - **WHAT APIs SHOULD BE** - Exact specifications

**4. [04-alignment-decisions.md](./04-alignment-decisions.md)** (5 min skim) - **STRATEGIC RATIONALE**
   - Decisions 2-4: Wrapping, HTTP format, field naming (drive refactor)
   - Decisions 9-11: Preserve patterns, error display, minor fixes
   - **WHY these choices** - Strategic context

**5. [06-test-architecture.md](./06-test-architecture.md)** (5 min skim) - **TEST STRATEGY**
   - Proper pyramid: 100+ unit, 25-35 contract, 5-10 integration
   - ajv validation for all contracts
   - Test organization already defined
   - **HOW to validate** - Test approach

### Critical Context for Sequencing

**Read if you need dependency/coordination details**:
- **work/DEPENDENCY-MAP-PHASE-6-1-7.md** - Circular dependencies, initialization order
- **PHASE-6-FILE-STRUCTURE-INVESTIGATION-PLAN.md** - Investigation methodology, gap-filling
- **10-file-structure-current.md Part 4, Section 1** - ATOMIC refactor details

### What Phase 6.6 Must Produce

**07-refactor-plan.md must specify**:
1. **File Creation Order**: Which new files to create first (utils before services)
2. **File Refactor Order**: Which existing files to change when
3. **File Deletion Order**: When to remove eliminated files
4. **ATOMIC Change Sequencing**: How to coordinate backend + scanners + tests
5. **Validation Checkpoints**: How to verify each step preserves functionality
6. **Risk Assessment**: Where coordination is most critical
7. **Rollback Strategy**: How to recover if steps fail

---

## Repeatable Process Patterns

*These patterns have made each phase successful. Apply them to future work.*

---

### Pattern 1: Collaborative Decision-Making

**Used In**: Phase 4 (alignment decisions), Phase 6.5 (target structure decisions)
**Will Use**: Any architectural decision point

**Process**:
1. **Prepare Context**: Load all relevant background (current + target + constraints)
2. **Frame Decision**: State decision clearly ("Should we X or Y?")
3. **Present Options**: 2-4 concrete alternatives with examples
4. **Analyze Tradeoffs**: For each option:
   - Benefits (what it enables)
   - Costs (effort, risk, complexity)
   - Constraints (what it requires)
   - Precedents (what we've done before)
5. **User Decides**: Collaborative discussion → clear choice
6. **Document Decision**: In dedicated doc (04, 11) with:
   - Decision statement
   - Rationale (why this choice)
   - Implications (what changes)
   - Related decisions (dependencies)
7. **Move to Next**: Build on previous decisions

**Why It Works**:
- User has full context to decide
- All options explored (not assumed)
- Rationale captured for future reference
- Decisions build incrementally (not all at once)

**Example** (Phase 4, Decision #2):
```markdown
## Decision #2: WebSocket Event Envelope

**Current State**: Backend sends events 3 different ways (no standard)
**Options**:
  A. Wrapped: { event: "name", data: {...}, timestamp: "..." }
  B. Unwrapped: Just send data directly
  C. Mixed: Wrap some, not others

**Analysis**:
  A. Wrapped:
    ✓ Consistent (scanners know what to expect)
    ✓ Extensible (can add metadata later)
    ✗ More verbose (extra nesting)
  B. Unwrapped:
    ✓ Simpler (less code)
    ✗ No metadata capability
    ✗ Scanner can't distinguish event types easily

**Decision**: A (Wrapped envelope)
**Rationale**: Consistency + extensibility > verbosity
```

---

### Pattern 2: Exhaustive Investigation

**Used In**: Phase 1 (backend), Phase 2 (scanners), Phase 6.1-6.4 (file structure)
**Will Use**: Any deep dive into existing code

**Process**:
1. **Scope Definition**: Define boundaries (what files/components to analyze)
2. **Atomic Findings Log**: Create work/*.md append-only log
3. **Systematic Analysis**: Go file-by-file, method-by-method
   - Read completely (don't skim)
   - Note patterns, violations, dependencies
   - Log findings immediately (don't batch)
4. **File:Line Precision**: Every claim has exact location
5. **Code Snippets**: Include actual code (not summaries)
6. **Structured Synthesis**: After investigation, synthesize into organized doc
7. **Pattern Identification**: Cross-file patterns, root causes, systemic issues

**Why It Works**:
- Exhaustive = no surprises later
- Atomic findings = traceable, can reference
- File:line precision = verifiable, specific
- Synthesis after = prevents analysis paralysis during investigation

**Time Investment**: 1-2 hours per major component (backend: 5.5 hours, GM Scanner: 1 hour, Player Scanner: 1 hour)

**Example** (Phase 6.1, Finding #40):
```markdown
### Finding #40: Transaction Model ROOT CAUSE
**Location**: models/transaction.js:113
**Code**:
toJSON() {
  return {
    scannerId: this.scannerId,  // ← ROOT CAUSE
    ...
  };
}
**Issue**: Model DEFINES scannerId field. Cascades to entire system.
**Impact**: ~30 files must change atomically.
```

---

### Pattern 3: Synthesis from Raw Data

**Used In**: Phase 4 (01+02+03→04), Phase 4.5 (05→06), Phase 6 (work/*→10)
**Will Use**: Phase 6.6 (10+11→07), any multi-source consolidation

**Process**:
1. **Complete Investigation First**: Don't synthesize mid-stream
2. **Identify Themes**: What patterns emerged? What's systemic vs isolated?
3. **Organize by Impact**: Critical → Important → Note → Info
4. **Connect Related Findings**: Cross-reference (Finding #X relates to #Y)
5. **Extract Principles**: What rules/patterns govern the chaos?
6. **Map Coordination**: What must change together? (ATOMIC refactors)
7. **Preserve Strengths**: What's working well? (don't break it)
8. **Write for Reuse**: Someone else should understand from synthesis alone

**Why It Works**:
- Raw findings = too granular to act on
- Synthesis = actionable insights
- Organization = quick navigation
- Preservation = don't lose good patterns

**Supersedes Pattern**: Synthesis documents supersede raw sources for primary reading

**Example** (Phase 6.4):
```markdown
## 2 ATOMIC Refactors (from 67 findings)

### ATOMIC #1: Field Naming
**Findings**: #40 (backend ROOT CAUSE), #51 (GM sends), #59 (Player sends)
**Pattern**: All 3 components use scannerId (violates Decision #4)
**Coordination**: Backend + GM + Player + Tests must change together
**Effort**: 8-12 hours (30+ files across 3 repos)
```

---

### Pattern 4: Contract-First Development

**Used In**: Phase 5 (creating contracts)
**Will Use**: Phase 7 (implementing to contracts), all future features

**Process**:
1. **Write Contract First**: Define exact API structure in openapi.yaml / asyncapi.yaml
   - Request/response schemas
   - Validation rules
   - Example payloads
2. **Validate Contract**: Use ajv to ensure schema is valid
3. **Create Migration Examples**: MIGRATION-GUIDE.md shows before → after
4. **Write Failing Tests**: Test against contract (will fail with current code)
5. **Implement to Contract**: Change code to match specification
6. **Verify Contract Compliance**: ajv validation passes
7. **Iterate**: If contract wrong, update contract + tests + implementation together

**Why It Works**:
- Contract = single source of truth
- Tests validate contract (not implementation guesses)
- ajv validation = automated verification
- Migration examples = clear transformation path

**Validation**:
```bash
# Validate contract
npm run validate:contracts

# Run contract tests
npm run test:contract
```

---

### Pattern 5: Breaking Change Coordination

**Used In**: Phase 6.4 (identifying ATOMIC refactors)
**Will Use**: Phase 7 (executing ATOMIC refactors), any cross-repo changes

**Process**:
1. **Identify All Touch Points**: Where does this change ripple?
   - Backend files (models, routes, services, websocket)
   - Scanner files (both GM and Player if affected)
   - Test files (update expectations)
2. **Separate Branches**: Create feature branches in each repo
   - backend: feature/field-naming
   - ALNScanner: feature/field-naming
   - aln-memory-scanner: feature/field-naming
3. **Coordinate Changes**: Update all files in each branch
   - Backend changes first (validators, models)
   - Scanner changes (adapt to new API)
   - Test changes (validate new structure)
4. **Test Independently**: Each repo's tests pass in isolation
5. **Merge Window**: Merge all PRs within tight window (5-10 minutes)
6. **Deploy Simultaneously**:
   - Backend: `npm run prod:restart`
   - Scanners: Push to main (GitHub Pages auto-deploy)
7. **Verify End-to-End**: Test actual user flows after deployment

**Why It Works**:
- Separate branches = independent development
- Independent testing = catch issues early
- Tight merge = minimize breakage window
- Simultaneous deploy = no partial state

**Risk Mitigation**:
- Prepare rollback commits in advance
- Test in staging environment first
- Have monitoring ready to catch issues
- Document exact coordination sequence

**Example** (ATOMIC Refactor #1):
```
Branches created:
  backend (feat/deviceId)
  ALNScanner (feat/deviceId)
  aln-memory-scanner (feat/deviceId)

Changes:
  Backend: 6 files
  GM Scanner: 3 locations
  Player Scanner: 2 locations
  Tests: 20+ files

Merge order:
  1. All 3 repos merge to main simultaneously
  2. Backend deploys via PM2
  3. Scanners auto-deploy via GitHub Pages
  4. Test transaction flow end-to-end

Rollback plan (if needed):
  git revert <merge-commit>
  npm run prod:restart
  (GitHub Pages auto-reverts)
```

---

### Pattern 6: Test-Driven Refactoring

**Will Use**: Phase 7 (implementation), any code changes

**Process**:
1. **Start with Contracts**: Read target API in backend/contracts/*.yaml
2. **Read Migration Guide**: Understand before → after transformation
3. **Write/Update Test**:
   - Contract test (validates against schema with ajv)
   - Integration test (validates behavior)
   - Test will FAIL (current code doesn't match contract)
4. **Run Test**: Confirm it fails for the right reason
5. **Implement Change**: Modify code to match contract
6. **Run Test Again**: Should pass now
7. **Verify Contract**: ajv validation against schema passes
8. **Move to Next**: Repeat for next API/component

**Why It Works**:
- Test first = clear target
- Contract = specification
- Fail → Pass = verification
- ajv = automated compliance check

**Test Pyramid** (from 06-test-architecture.md):
```
        /\
       /  \      5-10 Integration Tests
      /____\     (End-to-end flows)
     /      \
    /        \   25-35 Contract Tests
   /          \  (ajv validation)
  /____________\
 /              \ 100+ Unit Tests
/________________\ (Service logic)
```

---

### Pattern 7: Progressive Documentation

**Used In**: Throughout project (especially after Phase 4)
**Will Use**: Ongoing maintenance

**Process**:
1. **Living Documents**: Update as project progresses
   - 00-INDEX.md (this file)
   - PHASE-*-PLAN.md files (progress tracking)
2. **Locked Documents**: Freeze after phase complete
   - Phase outputs (01-11)
   - Contracts (backend/contracts/*.yaml)
   - Work logs (work/*.md - append only)
3. **Update Triggers**:
   - After major phase completion
   - When entering new phase (update context recovery)
   - When discovering process improvements
4. **Update Content**:
   - "What's Complete" section
   - "What's Next" section
   - Context Recovery (add new phase reading list)
   - Critical discoveries (add to phase section)
5. **Don't Update**:
   - Historical phase descriptions (locked)
   - Completed work logs (append-only)
   - Document map (only if new docs added)

**Why It Works**:
- Living = current
- Locked = historical record
- Git history = preserves all versions
- Clear triggers = prevents drift

---

### Pattern 8: Ultrathinking to Prevent Over-Engineering

**Used In**: Phase 6.5 (decision-making), critical design choices
**Will Use**: Any time considering adding architectural complexity

**Process**:
1. **Pause Before Adding Complexity**: When about to add new system/abstraction, STOP
2. **Think Deeply About Context**: What problem are we actually solving?
3. **Question Assumptions**: Are we solving a real problem or an imagined one?
4. **Check Existing Systems**: Do we already have something that solves this?
5. **Consider Target Architecture**: Does this align with Contract-First principle?
6. **Seek Simplification**: Can we use existing patterns instead of creating new ones?
7. **Validate with User**: Present insight for confirmation before proceeding

**Why It Works**:
- Prevents duplication (find existing solutions)
- Maintains minimal complexity (core principle)
- Aligns with Contract-First (contracts define target, not current state)
- Catches over-engineering before it happens

**Critical Example** (Phase 6.5, Decision #3):

**Almost Created**: `backend/contracts/internal-events.yaml` (separate internal event contracts)

**Ultrathinking Process**:
```
Q: Do we need internal events that don't exist externally?
   → Think deeply about coordination needs...
   → Session ends: services need to know AND GMs need to know
   → Scores update: services need to know AND GMs need to know
   → These are the SAME events!

Q: What if we already have contracts for these?
   → Check asyncapi.yaml...
   → Found 16 WebSocket events that cover coordination needs

Q: Can domain events (internal) map to WebSocket events (external)?
   → Yes! One event serves both uses
   → broadcasts.js already translates domain → WebSocket

INSIGHT: We don't need internal-events.yaml
        asyncapi.yaml documents BOTH internal + external events
        Single source of truth > duplicate contracts
```

**Result**: Avoided creating duplicate system, maintained single source of truth

**Key Principle**: **Contracts define TARGET architecture** (not current state documentation)
- If creating "internal-events.yaml" to document current lazy requires → WRONG
- Contracts show what SHOULD exist in clean architecture → RIGHT
- Think about target state, not documenting current mess

---

## Document Map (Synthesis Hierarchy)

**[SYNTHESIS] = Primary reading** - Supersede raw sources, read these first
**[RAW] = Reference only** - Access when synthesis lacks specific detail
**[FORMAL] = Contracts** - Executable specifications
**[REFERENCE] = Supporting** - Tools, guides, visualizations

### Phase 4: Strategic Decisions
- **[SYNTHESIS] 04-alignment-decisions.md** - 15 strategic decisions
  - Supersedes: 01-current-state.md, 02-scanner-analysis.md, 03-alignment-matrix.md

### Phase 4.5: Test Strategy
- **[SYNTHESIS] 06-test-architecture.md** - 3 test decisions + strategy + constraints
  - Supersedes: 05-test-analysis.md, work/TEST-INVENTORY.md
  - **Read 06, NOT 05** (unless need specific test file details)

### Phase 4.75: Functionality
- **[SYNTHESIS] 08-functional-requirements.md** - Component responsibilities

### Phase 4.9: API Minimization
- **[SYNTHESIS] 09-essential-api-list.md** - 24 essential APIs with categories
  - Supersedes: 01-current-state.md's full 59-API catalog

### Phase 5: Formal Contracts
- **[SYNTHESIS] backend/contracts/README.md** - Quick reference (all 24 APIs)
- **[FORMAL] backend/contracts/openapi.yaml** - 8 HTTP endpoints (specifications)
- **[FORMAL] backend/contracts/asyncapi.yaml** - 16 WebSocket events (specifications)
- **[REFERENCE] backend/contracts/MIGRATION-GUIDE.md** - Breaking changes (examples)

### Phase 6: Current File Structure
- **[SYNTHESIS] 10-file-structure-current.md** - 4-part comprehensive analysis (4,074 lines)
  - Part 1: Backend (46 files analyzed)
  - Part 2: GM Scanner (6,428-line monolith)
  - Part 3: Player Scanner (1,800 lines, modular)
  - Part 4: Cross-Cutting (2 ATOMIC refactors, 8 patterns)
  - Supersedes: work/BACKEND-FILE-STRUCTURE-FINDINGS.md (49 findings)
  - Supersedes: work/GM-SCANNER-FILE-STRUCTURE-FINDINGS.md (9 findings)
  - Supersedes: work/PLAYER-SCANNER-FILE-STRUCTURE-FINDINGS.md (9 findings)
- **[REFERENCE] work/DEPENDENCY-MAP-PHASE-6-1-7.md** - Visual dependency graphs
- **[RAW] work/*-FILE-STRUCTURE-FINDINGS.md** - Atomic findings with file:line precision

### Phase 6.5: Target Structure ✅
- **[SYNTHESIS] 11-file-structure-target.md** - Target organization with 3 structural decisions
  - Decision #1: Backend route files (5 files, resource-based)
  - Decision #2: GM Scanner modularization (15 files across 5 directories)
  - Decision #3: Event-based communication (asyncapi.yaml as single source of truth)
  - **Key Insight**: Domain events = WebSocket events (no separate internal contracts)
  - Bridges: 10-file-structure-current.md (current) → 11 (target) → 07-refactor-plan.md (how)

### Phase 6.6: Refactor Plan (Next)
- **[SYNTHESIS] 07-refactor-plan.md** - Implementation roadmap with sequencing
  - Will specify: File creation/refactor/deletion order, ATOMIC coordination, validation checkpoints

---

## The Complete Journey

*Full project history - understand how we got here and what made each phase successful*

### ACT 1 - DIAGNOSIS (Phases 1-3): *"What is broken?"*

**Phase 1: Understand the Backend** ✅
- **Method**: Exhaustive endpoint catalog (Pattern 2: Investigation)
- **Discovery**: 4 different response patterns (expected: 1 consistent)
- **Scope**: 27 HTTP endpoints, 30 WebSocket events
- **Output**: [RAW] 01-current-state.md (~2,500 lines)
- **Lesson Learned**: Exhaustiveness was CORRECT (not over-engineering) - found systemic issues

**Phase 2: Understand the Scanners** ✅
- **Method**: Field-level analysis with constraints (Pattern 2: Investigation)
- **Discovery**: ESP32 constraints, defensive normalization layers, standalone mode requirement
- **Findings**: 33 documented (25 GM + 8 Player)
- **Output**: [RAW] 02-scanner-analysis.md (~3,500 lines)
- **Lesson Learned**: Client-side complexity reveals backend architectural failures

**Phase 3: Cross-Reference & Verify** ✅
- **Method**: Endpoint-by-endpoint backend ↔ scanner alignment check
- **Discovery**: 4 CRITICAL CONTRACT VIOLATIONS (fundamental disagreements)
- **Alignment**: 18 match, 4 critical mismatch, 4 partial, 3 safe to change
- **Output**: [RAW] 03-alignment-matrix.md (~2,000 lines)
- **Lesson Learned**: Both sides need fixing - contracts must align BOTH

---

### ACT 2 - RESOLUTION (Phases 4, 4.5): *"What should we be?"*

**Phase 4: Design Decisions** ✅
- **Method**: Collaborative decision-making (Pattern 1)
- **Resolution**: 12 strategic decisions
  1. Contract-First (OpenAPI 3.1 + AsyncAPI 2.6)
  2. Wrapped WebSocket envelope
  3. RESTful HTTP (no wrapper)
  4. Standardized field names (deviceId, tokenId, id)
  5-8. Fix 4 critical mismatches
  9. Keep Player Scanner fire-and-forget (intentional design)
  10. Add error display to all scanners
  11-12. Fix minor issues, define contract location
- **Output**: [SYNTHESIS] 04-alignment-decisions.md (~1,500 lines)
- **Lesson Learned**: Decision-by-decision collaboration > big bang design

**Phase 4.5: Test Suite Investigation** ✅
- **Method**: Test file analysis + synthesis (Pattern 2 + Pattern 3)
- **Discovery**: Inverted test pyramid (most tests at wrong level)
- **Resolution**: 3 test decisions
  1. Pure ajv validation (unified HTTP + WebSocket)
  2. withSocket() helper (guaranteed cleanup)
  3. Proper pyramid (100+ unit, 25-35 contract, 5-10 integration)
- **Outputs**:
  - [SYNTHESIS] 06-test-architecture.md (~1,360 lines) - **Read this, not 05**
  - [RAW] 05-test-analysis.md (~3,250 lines) - Reference for specific test details
  - [RAW] work/TEST-INVENTORY.md, work/TEST-CLEANUP-PLAN.md
- **Lesson Learned**: Synthesis document supersedes raw analysis (06 > 05)

**Phase 4.75: Functional Requirements** ✅
- **Method**: Component-based analysis (not endpoint-based)
- **Paradigm Shift**: From "is X using this?" to "what's the best design?"
- **Critical Discovery**: Standalone mode requirement (scanners work without orchestrator)
- **Resolution**: Component responsibilities defined
  - Orchestrator: 10 functional areas
  - Player Scanner: Fire-and-forget HTTP (ESP32 compatible)
  - GM Scanner: WebSocket game logic (networked OR standalone)
  - Admin Panel: Monitoring + intervention via WebSocket commands
- **Output**: [SYNTHESIS] 08-functional-requirements.md (~1,800 lines)
- **Lesson Learned**: Functional requirements first, then decide transport/structure

**Phase 4.9: Endpoint Redundancy Analysis** ✅
- **Method**: Evaluate each API against functional requirements + targeted investigation
- **Results**: 24 essential APIs (59% reduction)
  - Essential HTTP: 8 endpoints (down from 29) - 72% reduction
  - Essential WebSocket: 16 events (down from 30) - 47% reduction
- **Eliminated**: 21 HTTP endpoints, 14 WebSocket events
  - Multi-session support (ONE session at a time)
  - Wrong-transport admin (moved to WebSocket)
  - Redundant state endpoints (consolidated)
- **Output**: [SYNTHESIS] 09-essential-api-list.md (~1,200 lines)
- **Lesson Learned**: Requirements-driven elimination > usage-based retention

---

### ACT 3 - FORMALIZE (Phase 5): *"Make it executable"*

**Phase 5: Create Formal Contracts** ✅
- **Method**: Contract-First development (Pattern 4)
- **Purpose**: Executable specifications for 24 essential APIs
- **Scope**: OpenAPI 3.1.0 + AsyncAPI 2.6.0
- **Structure**: Formalize decisions 2-4 (wrapped WebSocket, RESTful HTTP, field names)
- **Validation**: Decision 1 (Contract-First, test-driven, ajv validation)
- **Outputs**:
  - [FORMAL] backend/contracts/openapi.yaml (~1,200 lines, 8 HTTP endpoints)
  - [FORMAL] backend/contracts/asyncapi.yaml (~800 lines, 16 WebSocket events)
  - [SYNTHESIS] backend/contracts/README.md (quick reference + ajv setup)
  - [REFERENCE] backend/contracts/MIGRATION-GUIDE.md (breaking changes with examples)
- **Success Criteria**: ✅ All 24 APIs have formal contracts ready for ajv validation
- **Lesson Learned**: Contracts capture ALL decisions (structure + validation + examples)

---

### ACT 4 - PLAN (Phase 6): *"How do we execute?"*

**Phase 6: Create Refactor Plan** ⏳ IN PROGRESS

**Phase 6.1-6.4: File Structure Investigation** ✅ COMPLETE
- **Method**: Exhaustive file-by-file analysis (Pattern 2: Investigation) + synthesis (Pattern 3)
- **Purpose**: Understand current code organization to plan target structure
- **Sub-Phases**:
  - 6.1: Backend (49 findings - 46 files, 10,646 lines analyzed)
  - 6.2: GM Scanner (9 findings - 1 file, 6,428-line monolith)
  - 6.3: Player Scanner (9 findings - 3 files, 1,800 lines, modular architecture)
  - 6.4: Cross-Cutting (2 ATOMIC refactors, 8 system-wide patterns, strengths to preserve)
- **Outputs**:
  - [SYNTHESIS] 10-file-structure-current.md (4,074 lines, ALL 4 PARTS)
  - [RAW] work/BACKEND-FILE-STRUCTURE-FINDINGS.md (3,343 lines, 49 findings)
  - [RAW] work/GM-SCANNER-FILE-STRUCTURE-FINDINGS.md (435 lines, 9 findings)
  - [RAW] work/PLAYER-SCANNER-FILE-STRUCTURE-FINDINGS.md (643 lines, 9 findings)
  - [REFERENCE] work/DEPENDENCY-MAP-PHASE-6-1-7.md (694 lines, visual graphs)
- **Lesson Learned**: Same investigation pattern scales (backend 5.5hrs, GM 1hr, Player 1hr)

**Phase 6.5: Collaborative Target Structure Decisions** ✅ COMPLETE
- **Method**: Collaborative decision-making (Pattern 1) + Ultrathinking (Pattern 8)
- **Duration**: ~4 hours (gap-filling + 3 decisions)
- **Purpose**: Define target file organization aligned with contracts
- **Process** (for each decision):
  1. Present CURRENT state (from 10-file-structure-current.md)
  2. Present TARGET requirements (from contracts + decisions)
  3. Present OPTIONS (possible structures with examples)
  4. Present TRADEOFFS (risks, effort, benefits)
  5. User DECIDES
  6. Document IMMEDIATELY in 11-file-structure-target.md
  7. Move to next decision
- **Decisions Made**:
  1. **Backend Route Files**: 5 files resource-based (admin, scan, session, state, resource)
  2. **GM Scanner Modularization**: Split 6,428-line monolith → 15 files across 5 directories (core/, network/, ui/, app/, utils/)
  3. **Circular Dependency Pattern**: Event-based communication (asyncapi.yaml = single source of truth for ALL events)
- **Critical Insight** (Pattern 8: Ultrathinking):
  - Almost created internal-events.yaml (separate internal contracts)
  - Realized: Domain events (service coordination) = WebSocket events (GM communication)
  - Result: Single event system, asyncapi.yaml documents both uses
  - Lesson: Contracts define TARGET, not current state; check existing before adding
- **Methodology Refinement**:
  - Document decisions IMMEDIATELY (risk losing context/nuance)
  - Ultrathink to prevent over-engineering (catches duplication before it happens)
  - Contract-First principle applied recursively (asyncapi.yaml covers internal + external)
- **Output**: 11-file-structure-target.md (3 decisions + decision log + methodology insights)

**Phase 6.6: Synthesize Refactor Plan** ⏳ Future
- **Method**: Synthesis from multiple sources (Pattern 3) + breaking change coordination (Pattern 5)
- **Inputs**:
  - 10-file-structure-current.md (where we are)
  - 11-file-structure-target.md (where we're going)
  - backend/contracts/*.yaml (exact target API structure)
  - backend/contracts/MIGRATION-GUIDE.md (breaking change examples)
  - 04-alignment-decisions.md (strategic rationale)
  - 06-test-architecture.md (test strategy)
- **Critical Analyses**:
  1. **Dependency Analysis**: Which files must change together?
  2. **Risk Assessment**: Where is coordination most critical?
  3. **Test Strategy**: What to test at each step?
  4. **Coordination Strategy**: How to apply ATOMIC changes?
  5. **Sequencing**: What order minimizes risk?
- **Must Specify**:
  - File creation order (new utilities, helpers - create first)
  - File refactor order (existing files - when to change)
  - File deletion order (eliminated files - when to remove)
  - Breaking change coordination (backend + scanners + tests together)
  - Validation checkpoints (how to verify each step works)
- **Output**: 07-refactor-plan.md (implementation roadmap with file:line precision)

---

### ACT 5 - TRANSFORM (Phase 7): *"Making it real"*

**Phase 7: Execute Refactor** ⏳ Future
- **Method**: Test-driven refactoring (Pattern 6) + breaking change coordination (Pattern 5)
- **Process** (for each step in 07-refactor-plan.md):
  1. **Read Contract**: Target API in backend/contracts/*.yaml
  2. **Read Migration**: Before → after in MIGRATION-GUIDE.md
  3. **Write/Update Tests**:
     - Contract test (ajv validation)
     - Integration test (behavior validation)
     - Tests FAIL (current code doesn't match contract)
  4. **Implement Change**: Modify code to match contract
  5. **Verify Tests Pass**: Green test suite
  6. **Verify Contract**: ajv validation passes
  7. **Move to Next**: Repeat for next step
- **For ATOMIC Refactors**:
  1. Create feature branches in all affected repos
  2. Implement changes in each branch independently
  3. Test each branch in isolation (all tests pass)
  4. Merge all branches simultaneously (tight window)
  5. Deploy all components simultaneously
  6. Verify end-to-end flows
- **Pattern**: Backend + scanners transform together (coordinated via Pattern 5)
- **Validation**: Continuous contract compliance checking (ajv)
- **Output**: Refactored system matching all contracts

---

### ACT 6 - VERIFY: *"How do we know we're there?"*

**Project Success Criteria**:
- ✅ All 24 contracts validated via ajv (automated)
- ✅ Test pyramid correct (100+ unit, 25-35 contract, 5-10 integration)
- ✅ Zero architectural violations (Decisions 2-4 enforced everywhere)
- ✅ Breaking changes coordinated (backend + scanners deployed together)
- ✅ Standalone mode works (scanners function without orchestrator)
- ✅ Production deployment successful (PM2 stable, GitHub Pages deployed)
- ✅ Documentation current (all patterns captured, repeatable)

---

## Phase 6 Critical Context

**Investigation Complete - Key Discoveries for Decision-Making**:

### 2 ATOMIC Refactors (Must Coordinate via Pattern 5)

**ATOMIC Refactor #1: Field Naming** (scannerId → deviceId)
- **Scope**: Backend (6 files) + GM Scanner (3 locations) + Player Scanner (2 locations) + Tests (20+ files)
- **Root Cause**: Backend Transaction.toJSON() DEFINES `scannerId` field (models/transaction.js:113)
- **Coordination**: Single PR across 3 repos, merge simultaneously, deploy together
- **Risk**: 🔴 Critical breaking change - system breaks if not synchronized
- **Effort**: 8-12 hours (30+ files across 3 repos)
- **See**: 10-file-structure-current.md Part 4, Section 1.1

**ATOMIC Refactor #2: Event Wrapping** (standardize to wrapped format)
- **Scope**: Backend (8 files) + GM Scanner (14 handlers) + Tests (15+ files)
- **Root Cause**: Backend eventWrapper.js exists but NEVER IMPORTED (Finding #21)
- **Coordination**: Single PR across 2 repos (Player Scanner HTTP-only, not affected)
- **Risk**: 🟡 Medium - events must maintain same data, just wrapped
- **Effort**: 4-6 hours (8 backend + 1 scanner file)
- **See**: 10-file-structure-current.md Part 4, Section 1.2

### Architecture Strengths (Preserve During Refactor)

- ✅ **Backend EventEmitter Pattern** - 7 of 9 services extend EventEmitter
  - Clean event-driven architecture
  - Services emit domain events, WebSocket layer translates
  - Decoupled, testable
  - **Preserve**: Keep extends EventEmitter, use to fix stateService violation

- ✅ **Player Scanner Fire-and-Forget** - Decision #9 perfect compliance
  - Client makes ALL decisions from tokens.json
  - Ignores response bodies (ESP32 compatible)
  - Breaking change risk = ZERO
  - **Preserve**: DON'T add response body parsing

- ✅ **Player Scanner Offline Queue** - Production-ready reference implementation
  - Deduplication (5-second window)
  - Batch processing (10 at a time)
  - Re-queue on failure, localStorage persistence
  - Service worker background sync
  - **Use As Reference**: GM Scanner + backend should adopt this pattern

- ✅ **Player Scanner Modular Architecture** - 3 files (1,800 lines) vs GM Scanner 1 file (6,428 lines)
  - Clean separation (orchestratorIntegration.js separate)
  - Easier to maintain and test
  - **Use As Reference**: GM Scanner refactor target

### System-Wide Patterns Identified

1. **Console-only error handling** (Decision #10 violation)
   - ALL 3 components hide errors (console.error only)
   - Users don't see failures
   - **Fix**: Add error display to each component (INDEPENDENT refactors)

2. **Defensive normalization layers** (scanners compensate for backend)
   - GM Scanner: Triple fallback `scannerId || stationId || Settings.stationId`
   - Pattern masks root causes
   - **Fix**: Remove defensive code AFTER backend standardizes

3. **Circular dependencies** (backend services)
   - Triangle: sessionService ↔ stateService ↔ transactionService
   - Broken by 8 lazy `require()` statements inside methods
   - **Fix**: Needs DI framework OR continue lazy pattern (decision needed in 6.5)

4. **Singleton vs instances** (backend vs scanners)
   - Backend: Singleton pattern via getInstance() (stateful server)
   - Scanners: Class instances (client-side, multiple possible)
   - **Pattern**: Intentional, appropriate for each context

5. **Submodule architecture** (ALN-TokenData single source of truth)
   - Backend loads direct: ALN-TokenData/tokens.json
   - Scanners load nested: data/ submodule → ALN-TokenData
   - **Coordination**: Token updates require submodule reference updates in 3 places

6. **Deployment coordination** (PM2 + GitHub Pages)
   - Backend: PM2 ecosystem (single instance, fork mode, stateful WebSocket)
   - Scanners: GitHub Pages (standalone OR networked modes)
   - **ATOMIC refactors**: Require simultaneous deployment

7. **Network discovery** (UDP broadcast)
   - Backend: discoveryService listens on port 8888
   - Responds to "ALN_DISCOVER" with connection info
   - **Opportunity**: Scanner-side UDP discovery client (auto-configuration)

8. **Offline resilience** (uneven implementation)
   - Player Scanner: Production-ready (deduplication, batch, persistence)
   - GM Scanner: Basic (simple queue, no deduplication)
   - Backend: Basic (minimal features)
   - **Opportunity**: Standardize using Player Scanner as reference

---

## Progressive Documentation Strategy

**Living Documents** (update as project progresses):
- **00-INDEX.md** (this file)
  - Update after major phase completion
  - Add context recovery for new phase
  - Update "What's Complete" / "What's Next"
- **PHASE-*-PLAN.md** files
  - Track progress during phase
  - Mark sub-phases complete
  - Update statistics

**Locked Documents** (frozen after phase complete):
- **Phase outputs** (01-11)
  - Historical record of decisions/analysis
  - Git preserves versions
  - Don't edit after phase done
- **Contracts** (backend/contracts/*.yaml)
  - Formal specifications (rarely change)
  - If changed: update MIGRATION-GUIDE, version contracts
- **Work logs** (work/*.md)
  - Append-only findings logs
  - Never edit existing findings
  - Add new findings at end only

**Update Triggers**:
- After major phase completion (6.1, 6.5, 6.6, 7)
- When entering new phase (update context recovery section)
- When discovering process improvements (add to patterns)

**What to Update**:
- "Current Phase" status
- "What's Complete" checklist
- "What's Next" roadmap
- Context Recovery for new phase
- Critical discoveries (add to phase section)

**What NOT to Update**:
- Completed phase descriptions (historical)
- Document map (only if new docs added)
- Process patterns (only if new patterns discovered)
- Success criteria (defined upfront)

---

*Last Updated: 2025-10-02*
*Status: Phase 6.5 COMPLETE (3 decisions) - Ready for Phase 6.6 (Refactor Plan Synthesis)*
*Next: Create 07-refactor-plan.md by synthesizing 10 (current) + 11 (target) + contracts*
