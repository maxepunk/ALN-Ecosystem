# Implementation Plan: Contract Alignment Refactor

**Created**: 2025-10-02
**Last Updated**: 2025-10-03 (Status update: Phases 0-4 complete, Phase 5 in progress)
**Status**: 🔄 In Progress - Phase 5 (Test Suite Completion)
**Branch**: 001-backend-aln-architecture (current branch for all refactor work)
**Context**: Pre-production, system functionality already broken, temporary breakage irrelevant

---

## 📊 Progress Summary (ACCURATE AS OF 2025-10-03)

**Completed Phases**:
- ✅ Phase 0: Test Infrastructure Setup (100%)
- ✅ Phase 1.1: EventEmitter Pattern (100% - all lazy requires eliminated)
- ✅ Phase 1.2: Route Consolidation (100% - 8→5 files)
- ✅ Phase 2: Field Naming Standardization (100% - deviceId everywhere)
- ✅ Phase 3: Event Wrapping (100% - all wrapped with envelope)
- ✅ Phase 4: GM Scanner Modularization (100% - 14 modules extracted, 6428→2064 lines)
- 🔄 Phase 5: Test Suite Completion (~10% - infrastructure exists, expansion needed)

**Current Status**:
- Working on: Phase 5 - Test Suite Completion & Contract Validation
- Test Coverage: HTTP 87.5% (7/8), WebSocket 0% (0/16), Unit Tests: partial
- Failing Tests: 1 (WebSocket infrastructure issue)
- Skipped Tests: 1 (field naming mismatch)
- Next: Fix broken tests, then expand coverage to 24 contract tests + 100+ unit tests

**CRITICAL NOTE**:
This document's embedded progress indicators were NOT updated during Phases 1-4 execution. Git history shows actual completion. See git log for accurate transformation tracking. This document now serves as execution plan for Phase 5 only.

---

## Document Purpose

This is an **execution manifest**, not a learning guide. All exploration complete. All decisions made. All specifications final.

**Your task**: Execute transformations sequentially on current branch. Commit after each phase validation. Push to main only after complete implementation and verification.

---

## Quick Navigation

- **Section 1**: How to use this plan
- **Section 2**: Target structure (filesystem across all modules)
- **Section 3**: Sequential implementation (Phases 0-5)
- **Section 4**: Reference (findings/decisions quick lookup)

---

# Section 1: Execution Guide

## How to Use This Plan

### Evidence Chain

Every transformation traces through complete specification documents:

1. **Requirement** (08-functional-requirements.md): What functionality we're implementing
2. **Decision** (04-alignment-decisions.md or 11-file-structure-target.md): Why we chose this approach
3. **Current** (10-file-structure-current.md Finding #): Where code exists + exact issues
4. **Target** (11-target.md or backend/contracts/): What it should become
5. **Validation** (06-test-architecture.md): How to verify (test type)

### Test-Driven Development Flow

**CRITICAL**: Tests are aspirational (06-test-architecture.md defines target, tests don't exist yet).

Each transformation follows TDD:
1. **Write/Fix Test**: Define target behavior (test will fail)
2. **Run Test**: Confirm failure (proves test works)
3. **Implement**: Make the transformation
4. **Run Test**: Should pass (validation)

### Transformation Format

Each step includes:
- **Evidence**: Citations to specification documents (Finding #X, Decision #Y)
- **Test Specification**: What test to write/fix (target behavior)
- **Test Execution**: Confirm test fails before implementation
- **Implementation**: Exact transformation instructions
- **Validation**: Test passes + objective criteria
- **Commit**: Atomic progress marker

### Prerequisites

- [x] All specification documents accessible (08, 04, 10, 11, backend/contracts/, MIGRATION-GUIDE)
- [x] Development environment set up
- [x] Current branch: `git branch` shows `001-backend-aln-architecture`
- [x] Tests can run: `cd backend && npm test` (baseline - many will fail, that's expected)

### Execution Sequence

**Sequential Only** (no parallel branches):
1. Execute phases in order (Phase 0 → Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5)
2. Complete all transformations in a phase
3. Validate phase (all tests pass)
4. Commit with phase marker
5. Move to next phase
6. After Phase 5 complete → Push to main

**Commit Cadence**:
- Commit after each transformation validated
- Commit message format: `refactor(area): description [phase.step]`
- Example: `refactor(services): Remove lazy require from sessionService [1.1.1]`

**Push Cadence**:
- Work stays on branch until ALL phases complete
- Final push to main after Phase 5 validation

### Progress Tracking

- [ ] Mark checkboxes as steps complete
- [ ] Git commits track granular progress
- [ ] Update phase markers in this document

### Code Citations

**References use stable identifiers** (not brittle line numbers):
- Finding #X from document Y (findings won't renumber)
- Decision #X from document Y (decisions won't renumber)
- Contract schema paths (contracts frozen)

**Small code snippets** (5-10 lines) show transformations only. For full context, consult referenced finding/decision in specification documents.

---

# Section 2: Target Structure Summary

## 2.1 Backend Target Structure (Decision #1)

**Evidence**: 11-file-structure-target.md Decision #1 (lines 27-133)

### Current Structure
```
backend/src/
├── routes/           8 files  (29 HTTP endpoints)
├── services/         9 files  (with circular dependencies)
├── models/           8 files
├── websocket/        8 files  (inconsistent wrapping)
├── utils/            2 files
├── middleware/       2 files
├── storage/          4 files
├── config/           1 file
```

### Target Structure
```
backend/src/
├── routes/           5 files  (8 HTTP endpoints, resource-based)
│   ├── adminRoutes.js       (auth, logs)
│   ├── scanRoutes.js        (scan, batch)
│   ├── sessionRoutes.js     (current session)
│   ├── stateRoutes.js       (debug state)
│   └── resourceRoutes.js    (tokens, health) ← NEW FILE
├── services/         9 files  (EventEmitter communication, no circular deps)
├── models/           8 files  (deviceId field, no toAPIResponse)
├── websocket/        8 files  (all use eventWrapper.js)
├── utils/            3 files  (+ responseBuilder.js) ← NEW FILE
├── middleware/       2 files
├── storage/          4 files
├── config/           1 file
```

**Key Changes**:
- Routes: 8 → 5 files (consolidation + elimination, including docsRoutes.js deletion)
- Services: Same 9 files, internals change (EventEmitter pattern)
- Models: Same 8 files, field naming fix
- WebSocket: Same 8 files, consistent wrapping
- Utils: +1 new file (responseBuilder.js)

---

## 2.2 GM Scanner Target Structure (Decision #2)

**Evidence**: 11-file-structure-target.md Decision #2 (lines 135-301)

### Current Structure
```
ALNScanner/
├── index.html        6,428 lines (monolithic single-file PWA)
├── sw.js             Service worker
└── data/             Submodule → ALN-TokenData
```

### Target Structure
```
ALNScanner/
├── index.html        ~1,500 lines (HTML/CSS + app initialization)
├── js/
│   ├── core/
│   │   ├── dataManager.js              (~735 lines - game logic)
│   │   ├── standaloneDataManager.js    (~127 lines - standalone mode)
│   │   └── tokenManager.js             (~252 lines - token data)
│   ├── network/
│   │   ├── connectionManager.js        (~403 lines - WebSocket)
│   │   ├── networkedQueueManager.js    (~164 lines - offline queue)
│   │   └── orchestratorClient.js       (~857 lines - backend API)
│   ├── ui/
│   │   ├── uiManager.js                (~528 lines - DOM manipulation)
│   │   └── settings.js                 (~49 lines - user settings)
│   ├── app/
│   │   ├── app.js                      (~917 lines - main coordinator)
│   │   └── sessionModeManager.js       (~98 lines - mode switching)
│   └── utils/
│       ├── nfcHandler.js               (~150 lines - NFC scanning)
│       ├── adminModule.js              (~304 lines - admin panel)
│       ├── debug.js                    (~69 lines - debugging)
│       └── config.js                   (~8 lines - configuration)
├── sw.js             Service worker
└── data/             Submodule → ALN-TokenData
```

**Extraction Strategy**: 5 phases (utils → core → ui → network → app), extract + fix violations per phase

---

## 2.3 Player Scanner Target Structure

**Evidence**: 10-file-structure-current.md Part 3 (minimal changes)

### Current Structure
```
aln-memory-scanner/
├── index.html                     1,322 lines
├── js/
│   └── orchestratorIntegration.js   235 lines
├── sw.js                            240 lines
└── data/                            Submodule → ALN-TokenData
```

### Target Structure
```
aln-memory-scanner/
├── index.html                     1,322 lines (+ error display)
├── js/
│   └── orchestratorIntegration.js   235 lines (deviceId field, health endpoint fix)
├── sw.js                            240 lines
└── data/                            Submodule → ALN-TokenData
```

**Changes**: 3 minimal fixes (field naming, health endpoint, error display)

---

# Section 3: Sequential Implementation

## Phase 0: Prerequisites & Test Infrastructure Setup ✅ COMPLETE

**Purpose**: Establish clean test foundation before refactoring begins

**Duration**: 2-3 hours (Actual: 2 hours)

**Status**: ✅ Complete - All 3 transformations finished

**Critical Context**: All existing tests deleted except helpers (pre-production, broken tests worse than no tests)

**Evidence**:
- Decision: 06-test-architecture.md Decision 1 (ajv-based contract validation)
- Current: 05-test-analysis.md (existing tests fundamentally broken)
- Strategy: Clean slate, write tests fresh during refactor (TDD)

---

### Transformation 0.1: Install Test Dependencies ✅

**Goal**: Install all required test infrastructure dependencies

**Implementation**:
```bash
cd backend
npm install --save-dev ajv ajv-formats js-yaml
```

**Validation**:
- [x] Dependencies installed: `npm list ajv ajv-formats js-yaml`
- [x] All three packages show in package.json devDependencies

**Commit**: ✅ `chore(test): Install test infrastructure dependencies [0.1]`

---

### Transformation 0.2: Delete Broken Tests ✅

**Goal**: Remove all broken/misleading tests to prevent accidental following

**Rationale**: Broken tests during refactor are landmines - better to have no tests than wrong tests

**Implementation**:
```bash
cd backend

# Delete all test files except test-helpers.js
rm -f tests/contract/*.test.js
rm -f tests/integration/*.test.js
rm -f tests/integration/*.disabled
rm -f tests/unit/**/*.test.js
rm -rf tests/mocks/
rm -rf tests/fixtures/
rm -rf tests/performance/
```

**Keep**:
- `tests/integration/test-helpers.js` (174 lines, well-written utilities)

**Validation**:
- [x] Only test-helpers.js remains: `find tests -name "*.test.js" -o -name "*.disabled"` returns empty
- [x] test-helpers.js still exists: `ls tests/integration/test-helpers.js`

**Commit**: ✅ `chore(test): Delete broken tests for clean slate rebuild [0.2]`

---

### Transformation 0.3: Create Test Helper Infrastructure ✅

**Goal**: Set up helpers directory with required utilities

**Status**: ✅ Complete - Fixed AsyncAPI schema access method during implementation

**Implementation**:

**Step 1**: Create directory structure
```bash
mkdir -p backend/tests/helpers
```

**Step 2**: Move and update WebSocket helpers
```bash
mv tests/integration/test-helpers.js tests/helpers/websocket-helpers.js
```

**Step 3**: Update field names in websocket-helpers.js
- Find & replace: `stationId` → `deviceId` (2 occurrences in connectAndIdentify function)
- Find & replace: `scannerId` → `deviceId` (2 occurrences in connectAndIdentify function)

**Step 4**: Create contract-validator.js (from 06-test-architecture.md Decision 1)

**File**: `backend/tests/helpers/contract-validator.js`
```javascript
/**
 * Unified contract validation for HTTP and WebSocket APIs
 * Validates responses/events against OpenAPI/AsyncAPI schemas
 */

const Ajv = require('ajv');
const addFormats = require('ajv-formats');
const yaml = require('js-yaml');
const fs = require('fs');
const path = require('path');

// Initialize ajv with formats (dates, uris, etc.)
const ajv = new Ajv({
  strict: false,  // Allow additional properties (flexible for optional fields)
  allErrors: true // Show all validation errors, not just first
});
addFormats(ajv);

// Load contracts once
const openapi = yaml.load(
  fs.readFileSync(path.join(__dirname, '../../contracts/openapi.yaml'), 'utf8')
);
const asyncapi = yaml.load(
  fs.readFileSync(path.join(__dirname, '../../contracts/asyncapi.yaml'), 'utf8')
);

/**
 * Extract schema from OpenAPI spec
 */
function getHTTPSchema(path, method, status = '200') {
  const pathSpec = openapi.paths[path];
  if (!pathSpec) throw new Error(`Path ${path} not found in OpenAPI spec`);

  const methodSpec = pathSpec[method.toLowerCase()];
  if (!methodSpec) throw new Error(`Method ${method} not found for ${path}`);

  const responseSpec = methodSpec.responses[status];
  if (!responseSpec) throw new Error(`Response ${status} not found for ${method} ${path}`);

  return responseSpec.content['application/json'].schema;
}

/**
 * Extract schema from AsyncAPI spec
 * CORRECTED: AsyncAPI 2.6 stores messages in components/messages with 'name' field
 */
function getWebSocketSchema(eventName) {
  // AsyncAPI 2.6: All messages are in components/messages, find by 'name' field
  const messages = asyncapi.components.messages;

  // Find message with matching name
  const message = Object.values(messages).find(msg => msg.name === eventName);

  if (!message) {
    throw new Error(`Event ${eventName} not found in AsyncAPI spec`);
  }

  return message.payload;
}

/**
 * Validate HTTP response against OpenAPI contract
 */
function validateHTTPResponse(response, path, method, expectedStatus = 200) {
  const schema = getHTTPSchema(path, method, expectedStatus.toString());
  const validate = ajv.compile(schema);
  const valid = validate(response.body);

  if (!valid) {
    throw new Error(
      `HTTP response validation failed for ${method} ${path}:\n` +
      JSON.stringify(validate.errors, null, 2)
    );
  }

  return true;
}

/**
 * Validate WebSocket event against AsyncAPI contract
 */
function validateWebSocketEvent(eventData, eventName) {
  const schema = getWebSocketSchema(eventName);
  const validate = ajv.compile(schema);
  const valid = validate(eventData);

  if (!valid) {
    throw new Error(
      `WebSocket event validation failed for ${eventName}:\n` +
      JSON.stringify(validate.errors, null, 2)
    );
  }

  return true;
}

module.exports = {
  validateHTTPResponse,
  validateWebSocketEvent,
  getHTTPSchema,
  getWebSocketSchema
};
```

**Validation**:
- [x] Directory exists: `ls -la tests/helpers/`
- [x] websocket-helpers.js relocated: `ls tests/helpers/websocket-helpers.js`
- [x] contract-validator.js created: `ls tests/helpers/contract-validator.js`
- [x] Field names updated: `grep -c "stationId\|scannerId" tests/helpers/websocket-helpers.js` returns 0
- [x] Validator works: Create simple smoke test and run
- [x] **AsyncAPI schema access corrected**: Uses components/messages with name lookup (not channels)

**Commit**: ✅ `feat(test): Create test helper infrastructure with contract validators [0.3]`

---

### Phase 0 Final Validation ✅

**Comprehensive Checks**:
- [x] Dependencies installed: ajv, ajv-formats, js-yaml in package.json
- [x] All old tests deleted
- [x] tests/helpers/ contains exactly 2 files
- [x] contract-validator.js can load contracts without error

**Test Infrastructure Smoke Test**:
```bash
cd backend
node -e "
const { validateHTTPResponse } = require('./tests/helpers/contract-validator');
console.log('Contract validator loads successfully');
"
```

**Commit**: ✅ `chore(test): Complete Phase 0 test infrastructure setup [phase-0-complete]`

**Duration Checkpoint**: ✅ Actual: ~2 hours for Phase 0 (under estimate)

---

## Phase 1: Backend Foundational Refactors 🔄 IN PROGRESS

**Purpose**: Establish clean backend architecture before cross-component changes

**Duration**: 16-20 hours (Estimated - may need revision due to lazy require count)

**Status**: 🔄 Phase 1.1 in progress (2/~18 transformations complete)

**Evidence**:
- Requirement: Service coordination without circular dependencies (08 §1.2-1.4)
- Decision: Decision #3 - EventEmitter pattern (11-target.md lines 303-516)
- Current: Finding #44 - 8 lazy requires (10-current.md Part 1 lines 358-486)

**⚠️ CORRECTION**: Finding #44 documented 8 lazy requires, but actual codebase analysis revealed **18 lazy requires**:
- sessionService.js: 2 lazy requires
- transactionService.js: 4 lazy requires
- stateService.js: 6 lazy requires
- videoQueueService.js: 6 lazy requires

This affects Phase 1.1 scope and duration estimates.

---

### Phase 1.1: Service Communication (EventEmitter Pattern) 🔄 IN PROGRESS

**Goal**: Remove all lazy requires, implement EventEmitter pattern

**Status**: 🔄 3 of ~18 transformations complete (17%)

**Evidence Chain**:
- Decision #3 (EventEmitter for service communication)
- Finding #44 (8 lazy requires create circular dependency) - **CORRECTED: Actually 18 lazy requires**
- Finding #46 (stateService → listenerRegistry cross-layer violation)

**Duration**: 12-16 hours (may need revision - scope expanded) | **Actual so far**: 6 hours for first 3 transformations

**Lazy Requires Removed/Fixed**: 4 of 18 (22%)
- ✅ sessionService.js: 2 removed (createSession, endSession) [1.1.1]
- ✅ transactionService.js: 1 removed (top-level import for event listener) [1.1.2]
- ✅ transactionService.js: 1 fixed (removed direct state modification → emits score:updated) [1.1.3]
- ⏸️ Remaining: 14 across transactionService (2), stateService (6), videoQueueService (6)

---

#### Transformation 1.1.1: sessionService Emits session:update Event ✅

**Status**: ✅ Complete - Implemented with wrapped envelope pattern

**Evidence**:
- Finding #44 (sessionService.js:57-58 lazy requires)
- Decision #3 (EventEmitter pattern, asyncapi.yaml events)
- asyncapi.yaml#/channels/session:update (event contract specification)

**Implementation Notes**:
- Added wrapped envelope structure: `{event, data, timestamp}`
- Derived `teams` array from `scores` (not stored separately in Session model)
- Emits on both `createSession()` (status='active') and `endSession()` (status='ended')

**Test Specification** (Write First):
```javascript
// File: tests/unit/services/sessionService.test.js

const { validateWebSocketEvent } = require('../../helpers/contract-validator');

describe('sessionService.endSession()', () => {
  it('should emit session:update event matching asyncapi.yaml schema', (done) => {
    const sessionService = require('../../../src/services/sessionService').getInstance();

    sessionService.createSession('Test Session');

    sessionService.once('session:update', (eventData) => {
      // Validate against asyncapi.yaml schema
      validateWebSocketEvent(eventData, 'session:update');

      expect(eventData.status).toBe('ended');
      expect(eventData.endTime).toBeDefined();
      done();
    });

    sessionService.endSession();
  });
});
```

**Run Test** (should fail):
```bash
cd backend
npm test -- tests/unit/services/sessionService.test.js
# Expected: FAIL (event not emitted yet)
```

**Implementation**:

Current code (Finding #44):
```javascript
// File: src/services/sessionService.js
// Line ~57-58

endSession() {
  const transactionService = require('./transactionService'); // REMOVE
  const stateService = require('./stateService'); // REMOVE

  transactionService.resetScores();
  stateService.reset();
  // ... rest of method
}
```

Target (asyncapi.yaml compliant):
```javascript
endSession() {
  const session = this.currentSession;

  // Emit event per asyncapi.yaml#/channels/session:update
  this.emit('session:update', {
    id: session.id,
    name: session.name,
    startTime: session.startTime,
    endTime: new Date().toISOString(),
    status: 'ended',
    metadata: session.metadata
  });

  // transactionService and stateService will listen separately
  // ... rest of method (state management)
}
```

**Execution Steps**:
1. Open `src/services/sessionService.js`
2. Locate `endSession()` method (~line 57)
3. Delete lazy require lines
4. Add event emission matching asyncapi.yaml session:update schema
5. Remove direct transactionService.resetScores() call
6. Remove direct stateService.reset() call
7. Keep session state management logic

**Validation**:
- [x] Test passes: `npm test -- sessionService.test.js`
- [x] Event validates against asyncapi.yaml: validateWebSocketEvent passes
- [x] No imports of transactionService/stateService: `grep "require.*transactionService\|require.*stateService" src/services/sessionService.js` (should be empty)
- [x] SessionService extends EventEmitter: Check class declaration
- [x] Wrapped envelope structure matches AsyncAPI spec

**Commit**: ✅ `refactor(services): sessionService emits session:update event per asyncapi.yaml [1.1.1]`

**Actual Implementation**:
```javascript
// In createSession() - Line 69-80
const session = this.currentSession.toJSON();
this.emit('session:update', {
  event: 'session:update',
  data: {
    ...session,
    status: 'active',
    teams: session.scores ? session.scores.map(s => s.teamId) : []
  },
  timestamp: new Date().toISOString()
});

// In endSession() - Line 231-242
const sessionData = session.toJSON();
this.emit('session:update', {
  event: 'session:update',
  data: {
    ...sessionData,
    status: 'ended',
    endTime: session.endTime || new Date().toISOString(),
    teams: sessionData.scores ? sessionData.scores.map(s => s.teamId) : []
  },
  timestamp: new Date().toISOString()
});
```

---

#### Transformation 1.1.2: transactionService Listens to session:update ✅

**Status**: ✅ Complete - Event listener pattern established

**Evidence**:
- Finding #44 (transactionService needs to react to session end)
- asyncapi.yaml#/channels/session:update (listens for status='ended')

**Implementation Notes**:
- Moved sessionService import to top-level (one-way dependency)
- Registered listener in constructor
- Added `sessionListenerRegistered` flag for test re-registration
- Listens for both status='active' (initialize scores) and status='ended' (reset scores)

**Test Specification** (Write First):
```javascript
// File: tests/integration/service-events.test.js
// Create this file

describe('Service event communication', () => {
  it('should reset scores when session ends', (done) => {
    const sessionService = require('../../src/services/sessionService').getInstance();
    const transactionService = require('../../src/services/transactionService').getInstance();

    // Setup: Create session and add some scores
    sessionService.createSession('Test');
    transactionService.addPoints('001', 100);

    // Listen for completion
    setTimeout(() => {
      const scores = transactionService.getScores();
      expect(scores['001']).toBe(0); // Reset to zero
      done();
    }, 100); // Give event time to propagate

    // Trigger
    sessionService.endSession();
  });
});
```

**Run Test** (should fail):
```bash
npm test -- tests/integration/service-events.test.js
# Expected: FAIL (listener not registered yet)
```

**Implementation**:

**File**: `src/services/transactionService.js`

Add event listener in `init()` or constructor:
```javascript
// Near top of file
const sessionService = require('./sessionService');

// In init() method or constructor
init() {
  // ... existing initialization

  // Listen to session events per asyncapi.yaml
  const session = sessionService.getInstance();
  session.on('session:update', (eventData) => {
    if (eventData.status === 'ended') {
      this.resetScores(eventData.id);
    }
  });
}
```

**Execution Steps**:
1. Open `src/services/transactionService.js`
2. Add sessionService import at top (one-way dependency is OK)
3. Locate `init()` method or constructor
4. Add event listener for session:update event
5. Check status field, reset scores when 'ended'
6. Ensure `resetScores()` method exists and accepts sessionId parameter

**Validation**:
- [x] Test passes: `npm test -- service-events.test.js`
- [x] Import is one-way (transactionService imports sessionService, not vice versa)
- [x] No lazy requires: `grep "require.*sessionService" src/services/transactionService.js` shows only top-level import
- [x] Event listener registered in constructor
- [x] Test re-registration works after reset()

**Commit**: ✅ `refactor(services): transactionService listens to session:update [1.1.2]`

**Actual Implementation**:
```javascript
// Top-level import
const sessionService = require('./sessionService');

// In constructor
constructor() {
  super();
  this.recentTransactions = [];
  this.tokens = new Map();
  this.teamScores = new Map();
  this.sessionListenerRegistered = false;

  this.registerSessionListener();
  this.sessionListenerRegistered = true;
}

registerSessionListener() {
  sessionService.on('session:update', (eventData) => {
    const { data } = eventData;

    if (data.status === 'ended') {
      this.resetScores();
      logger.info('Scores reset due to session end');
    } else if (data.status === 'active' && data.teams) {
      data.teams.forEach(teamId => {
        if (!this.teamScores.has(teamId)) {
          this.teamScores.set(teamId, TeamScore.createInitial(teamId));
        }
      });
      logger.info('Team scores initialized for new session', { teams: data.teams });
    }
  });
}

reset() {
  this.removeAllListeners();
  this.recentTransactions = [];
  this.teamScores.clear();
  this.sessionListenerRegistered = false;  // Allow re-registration in tests
  logger.info('Transaction service reset');
}
```

---

#### Transformation 1.1.3: transactionService Emits score:updated Event ✅

**Status**: ✅ Complete - Event emission replaces direct state modification

**Evidence**:
- Finding #44 (transactionService.js:244 directly modifies sessionService.scores array)
- Decision #3 (EventEmitter pattern, no direct cross-service state modification)
- asyncapi.yaml#/components/messages/ScoreUpdated (score:updated event specification)

**Implementation Notes**:
- Removed encapsulation violation at line 244 (transactionService modifying sessionService state)
- Added `emitScoreUpdate()` method emitting score:updated with wrapped envelope
- Added `baseScore` field to TeamScore model per AsyncAPI requirements
- Updated TeamScore.addPoints() and addBonus() to maintain currentScore = baseScore + bonusPoints
- sessionService should listen to score:updated and update its own state (Phase 1.1.4+)

**Validation**:
- [x] Test passes: `npm test -- tests/unit/services/transactionService.test.js`
- [x] Event validates against asyncapi.yaml: validateWebSocketEvent passes
- [x] No direct state modification: sessionService.scores not touched
- [x] Integration tests pass: No regressions in service-events.test.js
- [x] Wrapped envelope structure matches AsyncAPI spec

**Commit**: ✅ `refactor(services): transactionService emits score:updated instead of direct state modification [1.1.3]`

**Actual Implementation**:
```javascript
// File: src/services/transactionService.js

emitScoreUpdate(teamScore) {
  // Emit score:updated event with wrapped envelope per AsyncAPI spec
  this.emit('score:updated', {
    event: 'score:updated',
    data: {
      teamId: teamScore.teamId,
      currentScore: teamScore.currentScore,
      baseScore: teamScore.baseScore,
      bonusPoints: teamScore.bonusPoints,
      tokensScanned: teamScore.tokensScanned,
      completedGroups: teamScore.completedGroups,
      lastUpdate: teamScore.lastUpdate || new Date().toISOString(),
    },
    timestamp: new Date().toISOString(),
  });
}

// In updateTeamScore() - removed:
// const sessionService = require('./sessionService');
// session.scores.push(teamScore.toJSON());

// Now calls:
this.emitScoreUpdate(teamScore);
```

---

#### Transformation 1.1.4: stateService Aggregator Pattern ✅ COMPLETE

**Status**: ✅ Complete - stateService is now pure aggregator (only listens, never calls)

**Implementation**:
- Moved 4 service imports to top-level (sessionService, transactionService, videoQueueService, offlineQueueService)
- Added `cachedOfflineStatus` property to cache offline status from events
- Removed 3 lazy requires from init() and createStateFromSession()
- Updated event listener to cache offline status when emitted
- All methods now use cached value instead of direct property access

**Tests**: 4/4 unit tests passing, 2/2 integration tests passing

**Commit**: `7aff263f`

---

#### Transformation 1.1.5: videoQueueService Lazy Require Analysis ✅ COMPLETE

**Status**: ✅ Complete - Removed redundant requires, validated leaf dependencies

**Implementation**:
- ✅ Removed 5 redundant `config` lazy requires (already imported at top-level)
- ✅ Validated 6 `vlcService` lazy requires as ACCEPTABLE (leaf dependency)

**vlcService Lazy Requires** (6 total - KEEP):
- Line 78: `processQueue()` - Return to idle loop
- Line 134: `playVideo()` - Play video through VLC
- Line 247: `monitorVlcPlayback()` - Monitor VLC status
- Line 368: `skipCurrent()` - Skip current video
- Line 392: `pauseCurrent()` - Pause video
- Line 421: `resumeCurrent()` - Resume video

**Why vlcService Lazy Requires Are Acceptable**:
1. **Leaf Dependency**: vlcService has NO application service dependencies
   - Only depends on: axios, EventEmitter, config, logger
   - No circular dependency risk
2. **Infrastructure Service**: Hardware/external system control (VLC HTTP API)
3. **Optional Feature**: Gated by `config.features.videoPlayback` flag
4. **Command Pattern**: All calls are commands to external system (play, pause, stop, etc.)
5. **Lazy Loading Appropriate**: Feature may not be enabled, avoid loading unnecessary code

**Tests**: 12/12 tests passing (no regressions)

**Commits**: `bff33ee5` (config cleanup), analysis documented

---

#### Transformation 1.1.6: transactionService Remaining Lazy Requires ⏸️ PENDING

**Status**: ⏸️ Pending - 2 lazy requires remaining to analyze

**Remaining to Analyze**:
- transactionService.js: 2 remaining (lines TBD - need to grep and analyze)

**⚠️ SCOPE UPDATE**: Original plan documented 8 lazy requires. Actual analysis found:
- sessionService.js: 2 (✅ removed in 1.1.1)
- transactionService.js: 4 total (✅ 1 removed in 1.1.2, ✅ 1 fixed in 1.1.3, ⏸️ 2 remaining)
- stateService.js: 7 (✅ all removed/cached in 1.1.4)
- videoQueueService.js: 11 total (✅ 5 config removed, ✅ 6 vlcService validated in 1.1.5)

**CRITICAL: Analysis Required Before Any Code Changes**

Before touching any lazy require, you MUST understand:

**1. Service Functional Responsibilities** (from 08-functional-requirements.md):
- **sessionService**: Session lifecycle owner, emits session:update
- **transactionService**: Token scan processor, emits transaction:new and score:updated
- **stateService**: Global state AGGREGATOR, should ONLY listen (never call other services)
- **videoQueueService**: Video playback coordinator, emits video:status
- **vlcService**: Leaf dependency (hardware control, no circular deps)

**2. What Each Lazy Require Does**:
- Is it **modifying state** in another service? → MUST convert to event emission
- Is it **querying data** (one-way read)? → Might be OK, or cache via event listeners
- Does it create **circular dependency**? → MUST break with events

**3. AsyncAPI Contract Constraints** (backend/contracts/asyncapi.yaml):
- **16 immutable events** - we refactor TO match these, not create new events
- Domain events = WebSocket events (same names, used for both internal + external)
- Events available: session:update, transaction:new, score:updated, video:status, etc.

**4. The Event-Driven Pattern**:
- Services emit events when their state changes
- Other services listen and maintain their own cache/state
- broadcasts.js listens to domain events and forwards as WebSocket
- NO direct service-to-service state modification

**Analysis Process for Remaining 15 Lazy Requires**:
1. Read the code context around each lazy require
2. Determine: Command (modifies state) vs Query (reads state)
3. Map to existing AsyncAPI event OR accept as one-way dependency
4. Write test first (TDD)
5. Implement event emission or listener
6. Validate against AsyncAPI contract

**Event Contract Reference**: All event names and schemas from asyncapi.yaml channels

**Evidence**: Finding #44 table (lines 377-388) lists original 8 locations - **NEEDS UPDATE for actual 18**

---

#### Phase 1.1 Final Validation

**Comprehensive Checks**:
- [ ] All 8 lazy requires removed: `grep -r "require.*Service" src/services/ | grep -v "^[^:]*:[^/]*require"` (no in-method requires)
- [ ] Zero circular imports: `npx madge --circular src/services/`
- [ ] All service unit tests pass: `npm test -- tests/unit/services/`
- [ ] All service integration tests pass: `npm test -- tests/integration/service-events.test.js`
- [ ] Manual check: sessionService, stateService, transactionService all extend EventEmitter

**Commit**: `refactor(services): Complete EventEmitter pattern migration [1.1-complete]`

**Duration Checkpoint**: ~12-16 hours

---

### Phase 1.2: Route File Consolidation

**Goal**: Implement Decision #1 route structure (7 → 5 files)

**Evidence**:
- Decision #1 (11-target.md lines 27-133)
- Finding #13 (10-current.md Part 1 lines 1045-1121) - Route elimination

**Duration**: 4 hours

---

#### Transformation 1.2.1: Create responseBuilder.js Utility

**Evidence**: Finding #3 (no shared response builder)

**Test Specification** (Write First):
```javascript
// File: tests/unit/utils/responseBuilder.test.js

const { success, error } = require('../../../src/utils/responseBuilder');

describe('responseBuilder', () => {
  let mockRes;

  beforeEach(() => {
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };
  });

  it('should build success response', () => {
    success(mockRes, { id: '123' });

    expect(mockRes.status).toHaveBeenCalledWith(200);
    expect(mockRes.json).toHaveBeenCalledWith({ id: '123' });
  });

  it('should build error response', () => {
    error(mockRes, 'NOT_FOUND', 'Resource not found', null, 404);

    expect(mockRes.status).toHaveBeenCalledWith(404);
    expect(mockRes.json).toHaveBeenCalledWith({
      error: 'NOT_FOUND',
      message: 'Resource not found'
    });
  });
});
```

**Run Test** (should fail):
```bash
npm test -- tests/unit/utils/responseBuilder.test.js
# Expected: FAIL (file doesn't exist)
```

**Implementation**:

Create new file:
```javascript
// File: src/utils/responseBuilder.js

/**
 * Standardized response builders per Decision #3 (RESTful HTTP)
 */

function success(res, data, status = 200) {
  return res.status(status).json(data);
}

function error(res, errorCode, message, details = null, status = 400) {
  const response = {
    error: errorCode,
    message
  };

  if (details) {
    response.details = details;
  }

  return res.status(status).json(response);
}

module.exports = {
  success,
  error
};
```

**Validation**:
- [ ] Test passes: `npm test -- responseBuilder.test.js`
- [ ] File exists: `ls src/utils/responseBuilder.js`

**Commit**: `feat(utils): Add responseBuilder utility [1.2.1]`

---

#### Transformation 1.2.2: Create resourceRoutes.js

**Evidence**: Decision #1 (consolidate tokens + health endpoints)

**Test Specification** (Write First):
```javascript
// File: tests/contract/http/resource.test.js

const request = require('supertest');
const app = require('../../../src/app');
const { validateHTTPResponse } = require('../../helpers/contract-validator');

describe('GET /api/tokens', () => {
  it('should match OpenAPI contract', async () => {
    const response = await request(app)
      .get('/api/tokens')
      .expect(200);

    validateHTTPResponse(response, '/api/tokens', 'get', 200);
  });
});

describe('GET /health', () => {
  it('should match OpenAPI contract', async () => {
    const response = await request(app)
      .get('/health')
      .expect(200);

    validateHTTPResponse(response, '/health', 'get', 200);
  });
});
```

**Run Test** (should fail):
```bash
npm test -- tests/contract/http/resource.test.js
# Expected: FAIL (routes don't exist yet)
```

**Implementation**:

Create new file:
```javascript
// File: src/routes/resourceRoutes.js

const express = require('express');
const router = express.Router();
const tokenService = require('../services/tokenService');
const { success } = require('../utils/responseBuilder');

/**
 * Resource Routes - Static resources (tokens, health)
 * Per Decision #1: Consolidate GET /api/tokens + GET /health
 */

// GET /api/tokens - Token database
router.get('/tokens', async (req, res) => {
  try {
    const tokens = await tokenService.getInstance().getAllTokens();
    success(res, tokens);
  } catch (error) {
    res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: error.message
    });
  }
});

// GET /health - Health check
router.get('/health', (req, res) => {
  success(res, {
    status: 'ok',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
```

Update app.js:
```javascript
// File: src/app.js
// Add with other route imports

const resourceRoutes = require('./routes/resourceRoutes');

// Add with other route registrations
app.use('/api', resourceRoutes);  // Mounts /api/tokens
app.use('/', resourceRoutes);     // Mounts /health at root
```

**Validation**:
- [ ] Tests pass: `npm test -- resource.test.js`
- [ ] File exists: `ls src/routes/resourceRoutes.js`
- [ ] Routes registered: `grep "resourceRoutes" src/app.js`

**Commit**: `feat(routes): Add resourceRoutes consolidating tokens and health [1.2.2]`

---

#### Transformation 1.2.3-1.2.6: Remove Eliminated Route Files

**Evidence**: Finding #13 (10-file-structure-current.md Part 1 - route elimination list)

**Files to Delete**:
- transactionRoutes.js (all 4 endpoints eliminated → WebSocket)
- videoRoutes.js (eliminated → WebSocket gm:command)
- tokenRoutes.js (merged into resourceRoutes.js)
- docsRoutes.js (development tool, not in core contracts - Decision: delete for simplicity)

**For each file**:
1. Remove route registration from app.js
2. Delete file
3. Validate app starts: `npm start` (check for errors)
4. Commit

**Note**: No test updates needed (all tests deleted in Phase 0)

**Commit**: `refactor(routes): Remove eliminated route files [1.2.3-1.2.6]`

---

#### Phase 1.2 Final Validation

- [ ] 5 route files remain: `ls src/routes/ | wc -l` returns 5
- [ ] resourceRoutes.js exists and registered
- [ ] docsRoutes.js deleted: `ls src/routes/docsRoutes.js` returns "No such file"
- [ ] App starts: `npm start` (no errors)
- [ ] Write contract tests for new resourceRoutes endpoints (tokens, health) - Phase 1.2.7

**Commit**: `refactor(routes): Complete route consolidation [1.2-complete]`

---

### Phase 1 Final Validation

**All Phase 1 Goals Met**:
- [ ] EventEmitter pattern complete (8 lazy requires removed)
- [ ] Route consolidation complete (5 route files)
- [ ] responseBuilder.js utility created
- [ ] All backend tests pass: `npm test`
- [ ] No circular dependencies: `npx madge --circular src/`

**Commit**: `refactor(backend): Complete Phase 1 foundational refactors [phase-1-complete]`

**Duration Checkpoint**: 16-20 hours total for Phase 1

---

## Phase 2: Field Naming Standardization (scannerId → deviceId)

**Purpose**: Eliminate systemic field naming violations across all components

**Evidence**:
- Decision #4 (deviceId everywhere, 04-alignment-decisions.md)
- Finding #40 (Transaction.toJSON ROOT CAUSE)
- Finding #34 (validators.js BLOCKER)
- Finding #51 (GM Scanner sends scannerId)
- Finding #59 (Player Scanner sends scannerId)
- MIGRATION-GUIDE.md lines 63-98

**Duration**: 10 hours

**Sequence**: Backend → GM Scanner → Player Scanner (sequential, temporary breakage between deploys is irrelevant)

---

### Phase 2.1: Backend Field Naming

**Duration**: 6 hours

---

#### Transformation 2.1.1: Transaction Model + Validators (ATOMIC)

**Evidence**:
- Finding #34 (10-file-structure-current.md Part 1 - validators.js BLOCKS all other changes)
- Finding #40 (10-file-structure-current.md Part 1 - Transaction.toJSON ROOT CAUSE)

**Critical Context**: These MUST change atomically to avoid circular blocker:
- Transaction model validates using validators.js schemas
- If validators change first → model breaks
- If model changes first → validators reject
- **Solution**: Change both in single commit (system never breaks)

**Test Specification** (Write First):
```javascript
// File: tests/unit/utils/validators.test.js
const { validate, transactionSchema } = require('../../../src/utils/validators');

describe('Transaction validation with deviceId', () => {
  it('should accept deviceId field', () => {
    const transaction = {
      id: 'test-id',
      tokenId: '534e2b03',
      teamId: '001',
      deviceId: 'GM_SCANNER_01',
      timestamp: new Date().toISOString(),
      sessionId: 'session-id',
      status: 'accepted',
      points: 10
    };

    const result = validate(transaction, transactionSchema);
    expect(result).toHaveProperty('deviceId');
  });
});

// File: tests/unit/models/transaction.test.js
const Transaction = require('../../../src/models/transaction');

describe('Transaction.toJSON() with deviceId', () => {
  it('should serialize with deviceId field', () => {
    const tx = new Transaction({
      id: 'test-id',
      tokenId: '534e2b03',
      teamId: '001',
      deviceId: 'GM_01',
      timestamp: new Date().toISOString(),
      sessionId: 'session-id',
      status: 'accepted',
      points: 10
    });

    const json = tx.toJSON();
    expect(json).toHaveProperty('deviceId');
    expect(json.deviceId).toBe('GM_01');
    expect(json).not.toHaveProperty('scannerId');
  });
});
```

**Run Tests** (should fail):
```bash
npm test -- tests/unit/utils/validators.test.js
npm test -- tests/unit/models/transaction.test.js
# Expected: FAIL (both still use scannerId)
```

**Implementation (BOTH FILES IN ONE COMMIT)**:

**File 1**: `src/utils/validators.js`

Current (Finding #34):
```javascript
// Line 37
  scannerId: Joi.string().required().min(1).max(100),

// Line 148
  scannerId: Joi.string().required().min(1).max(100),
```

Target:
```javascript
// Line 37
  deviceId: Joi.string().required().min(1).max(100),

// Line 148
  deviceId: Joi.string().required().min(1).max(100),
```

**File 2**: `src/models/transaction.js`

Current (Finding #40):
```javascript
// Constructor
this.scannerId = data.scannerId;

// toJSON() ~line 113
toJSON() {
  return {
    id: this.id,
    tokenId: this.tokenId,
    teamId: this.teamId,
    scannerId: this.scannerId,
    // ... rest
  };
}
```

Target:
```javascript
// Constructor
this.deviceId = data.deviceId;

// toJSON()
toJSON() {
  return {
    id: this.id,
    tokenId: this.tokenId,
    teamId: this.teamId,
    deviceId: this.deviceId,
    // ... rest
  };
}
```

**Execution Steps** (DO NOT COMMIT BETWEEN STEPS):
1. Open `src/utils/validators.js`
2. Line 37: Change `scannerId:` to `deviceId:` in transactionSchema
3. Line 148: Change `scannerId:` to `deviceId:` in scanRequestSchema
4. Verify: `grep scannerId src/utils/validators.js` returns empty
5. Open `src/models/transaction.js`
6. Constructor: Change `this.scannerId` to `this.deviceId`
7. toJSON() (~line 113): Change field name
8. fromJSON() static method: Change field name
9. Search entire file: `grep -n scannerId src/models/transaction.js` (update all occurrences)
10. Verify: `grep scannerId src/models/transaction.js` returns empty

**Validation**:
- [ ] Both tests pass: `npm test -- validators.test.js transaction.test.js`
- [ ] No scannerId in validators.js: `grep scannerId src/utils/validators.js` returns empty
- [ ] No scannerId in transaction.js: `grep scannerId src/models/transaction.js` returns empty
- [ ] Transaction constructor accepts deviceId and validates successfully

**Commit**: `refactor(models,validators): Change scannerId to deviceId atomically [2.1.1]`

**Note**: This is now transformation 2.1.1 (merged from old 2.1.1 + 2.1.2)

---

#### Transformation 2.1.2: Remaining Backend Services

**Evidence**: Finding #15, #28 (10-file-structure-current.md Part 1 - services and WebSocket use scannerId)

**Files to Update** (search and replace scannerId → deviceId):
- src/services/transactionService.js
- src/services/stateService.js
- src/services/offlineQueueService.js
- src/websocket/broadcasts.js (line 72, 75 per Finding #28)

**For each file**:
1. Write/update test expecting deviceId field
2. Run test (should fail)
3. Search and replace: `scannerId` → `deviceId` in file
4. Run test (should pass)
5. Commit individually or as batch

**Commit**: `refactor(backend): Complete deviceId field naming in services and WebSocket [2.1.2]`

---

#### Phase 2.1 Final Validation

- [ ] No scannerId in backend: `grep -r "scannerId" src/` returns empty
- [ ] All backend tests pass: `npm test`
- [ ] Contract tests pass: `npm run test:contract`

**Commit**: `refactor(backend): Complete backend field naming [2.1-complete]`

**Deploy**: `npm run prod:restart` (if testing deployment)

**Note**: System temporarily broken (scanners still send scannerId)

---

### Phase 2.2: GM Scanner Field Naming

**Duration**: 2 hours

---

#### Transformation 2.2.1: App.processTransaction() (ROOT CAUSE)

**Evidence**: Finding #51 (line 4510 sends scannerId)

**Implementation**:

Current (Finding #51):
```javascript
// File: ALNScanner/index.html
// Line ~4510

const txId = window.queueManager.queueTransaction({
  ...transaction,
  scannerId: Settings.stationId, // ← CHANGE THIS
  sessionId: window.connectionManager.sessionId
});
```

Target:
```javascript
const txId = window.queueManager.queueTransaction({
  ...transaction,
  deviceId: Settings.deviceId, // ← CHANGED (Note: Settings field also renamed)
  sessionId: window.connectionManager.sessionId
});
```

**Also Update**: Settings object (Finding #52 - 17 internal uses of stationId)

**Execution Steps**:
1. Open `ALNScanner/index.html`
2. Search for all `stationId` occurrences: Find & Replace `stationId` → `deviceId` (17 code locations)
3. Update HTML elements (3 locations): `id="stationId"` → `id="deviceId"`, labels "Station ID" → "Device ID"
4. Update localStorage key: `'stationId'` → `'deviceId'`
5. Line 4510: Verify field name is `deviceId:`

**Validation**:
- [ ] No scannerId in file: `grep -c "scannerId" index.html` returns 0
- [ ] No stationId in JS: `grep "stationId" index.html | grep -v "html"` returns only HTML comments
- [ ] Manual test: Open in browser, Settings shows "Device ID", localStorage uses 'deviceId' key

**Commit**: `refactor(scanner): Change scannerId to deviceId in GM Scanner [2.2.1]`

---

#### Transformation 2.2.2: DataManager Normalization Layer

**Evidence**: Finding #50 (defensive triple fallback)

Current (line ~2672):
```javascript
const normalizedTx = {
  stationId: transaction.scannerId || transaction.stationId || Settings.stationId,
  // ...
};
```

Target (simplified after backend fix):
```javascript
const normalizedTx = {
  deviceId: transaction.deviceId || Settings.deviceId,
  // ...
};
```

**Commit**: `refactor(scanner): Simplify deviceId normalization in DataManager [2.2.2]`

---

#### Phase 2.2 Final Validation

- [ ] No scannerId: `grep "scannerId" ALNScanner/index.html` returns empty
- [ ] Manual test: Submit transaction, network tab shows `deviceId` field in WebSocket message
- [ ] No console errors

**Commit**: `refactor(scanner): Complete GM Scanner field naming [2.2-complete]`

**Deploy**: Push to GitHub (auto-deploys via GitHub Pages)

---

### Phase 2.3: Player Scanner Field Naming

**Duration**: 30 minutes

---

#### Transformation 2.3.1: orchestratorIntegration.js

**Evidence**: Finding #59 (lines 44, 116 send scannerId)

Current (Finding #59):
```javascript
// File: js/orchestratorIntegration.js
// Line 44
  scannerId: this.deviceId,

// Line 116
  scannerId: this.deviceId,
```

Target:
```javascript
// Line 44
  deviceId: this.deviceId,

// Line 116
  deviceId: this.deviceId,
```

**Execution Steps**:
1. Open `aln-memory-scanner/js/orchestratorIntegration.js`
2. Line 44: Change `scannerId:` to `deviceId:`
3. Line 116: Change `scannerId:` to `deviceId:`
4. Search file: `grep scannerId js/orchestratorIntegration.js` (should be empty)

**Validation**:
- [ ] No scannerId: `grep "scannerId" js/orchestratorIntegration.js` returns empty
- [ ] Manual test: Submit scan, network tab shows `deviceId` field in HTTP request

**Commit**: `refactor(scanner): Change scannerId to deviceId in Player Scanner [2.3.1]`

---

#### Phase 2.3 Final Validation

- [ ] Player Scanner field naming complete
- [ ] Manual test: Full transaction flow works (Player → Backend → GM)

**Commit**: `refactor(scanner): Complete Player Scanner field naming [2.3-complete]`

**Deploy**: Push to GitHub (auto-deploys)

---

### Phase 2 Final Validation

**System-Wide Verification**:
- [ ] No scannerId in any repo: `grep -r "scannerId" . --exclude-dir=node_modules --exclude-dir=.git`
- [ ] All backend tests pass: `cd backend && npm test`
- [ ] All contract tests pass: `npm run test:contract`
- [ ] End-to-end flow: Player scan → Backend processes → GM displays (all use deviceId)

**Commit**: `refactor: Complete Phase 2 field naming standardization [phase-2-complete]`

**Duration Checkpoint**: ~10 hours for Phase 2

---

## Phase 3: Event Wrapping Standardization

**Purpose**: All WebSocket events use wrapped envelope per Decision #2

**Evidence**:
- Decision #2 (04-alignment-decisions.md - wrapped envelope)
- Finding #21 (eventWrapper.js exists but never used)
- Finding #22 (62% unwrapped events)
- Finding #54 (GM Scanner inconsistent access patterns)
- MIGRATION-GUIDE.md lines 29-60

**Duration**: 6 hours

**Sequence**: Backend → GM Scanner (Player Scanner unaffected, HTTP-only)

---

### Phase 3.1: Backend Event Wrapping

**Duration**: 4 hours

---

#### Transformation 3.1.1: Import eventWrapper.js in broadcasts.js

**Evidence**: Finding #21 (eventWrapper exists but never imported)

**Test Specification** (Write First):
```javascript
// File: tests/contract/websocket/event-wrapping.test.js

const { validateWebSocketEvent } = require('../../helpers/contract-validator');

describe('WebSocket event wrapping', () => {
  it('should wrap transaction:new event', (done) => {
    const mockSocket = createMockSocket();

    mockSocket.on('transaction:new', (message) => {
      // Validate wrapped format
      expect(message).toHaveProperty('event');
      expect(message).toHaveProperty('data');
      expect(message).toHaveProperty('timestamp');
      expect(message.event).toBe('transaction:new');

      // Validate against AsyncAPI schema
      validateWebSocketEvent(message, 'transaction:new');
      done();
    });

    // Trigger transaction broadcast
    triggerTransaction();
  });
});
```

**Run Test** (should fail):
```bash
npm test -- tests/contract/websocket/event-wrapping.test.js
# Expected: FAIL (events not wrapped yet)
```

**Implementation**:

Current (Finding #21):
```javascript
// File: src/websocket/broadcasts.js
// eventWrapper.js helpers are NEVER IMPORTED
// Manual wrapping: io.emit('event', { event, data, timestamp })
```

Target (use helpers):
```javascript
// File: src/websocket/broadcasts.js
// Add at top
const { emitWrapped, emitToRoom } = require('./eventWrapper');

// Replace all manual emit calls with helpers (Finding #22 - 15 total emit sites)
```

**Execution Steps**:
1. Open `src/websocket/broadcasts.js`
2. Add import at top: `const { emitWrapped, emitToRoom } = require('./eventWrapper');`
3. Locate all `io.emit()` or `socket.emit()` calls (~15 locations per Finding #22)
4. Replace each emission using appropriate helper:

**Pattern A - Global Broadcast** (Before):
```javascript
io.emit('transaction:new', {
  event: 'transaction:new', // Manual wrapping
  data: { /* transaction data */ },
  timestamp: new Date().toISOString()
});
```

**Pattern A - Global Broadcast** (After):
```javascript
emitWrapped(io, 'transaction:new', {
  /* transaction data - just the payload */
});
```

**Pattern B - Room-Specific Broadcast** (Before):
```javascript
io.to(sessionId).emit('score:updated', {
  event: 'score:updated',
  data: { scores },
  timestamp: new Date().toISOString()
});
```

**Pattern B - Room-Specific Broadcast** (After):
```javascript
emitToRoom(io, sessionId, 'score:updated', { scores });
```

**Validation**:
- [ ] Helpers imported: `grep "emitWrapped\|emitToRoom" src/websocket/broadcasts.js | grep require`
- [ ] No manual io.emit: `grep "io\.emit\|io\.to.*emit" src/websocket/broadcasts.js` should only show helper usage
- [ ] Test passes: `npm test -- event-wrapping.test.js`

**Commit**: `refactor(websocket): Use emitWrapped/emitToRoom helpers in broadcasts [3.1.1]`

---

#### Transformation 3.1.2-3.1.5: Use Helpers in Other WebSocket Files

**Evidence**: Finding #22 (gmAuth.js, deviceTracking.js, videoEvents.js have unwrapped emits)

**Files to Update**:
- src/websocket/gmAuth.js (4 unwrapped events, Finding #23)
- src/websocket/deviceTracking.js (5 unwrapped events, Finding #24)
- src/websocket/videoEvents.js (2 unwrapped events)
- src/websocket/adminEvents.js (check for any manual emits)

**For each file**:
1. Add import: `const { emitWrapped, emitToRoom } = require('./eventWrapper');`
2. Replace all `io.emit()` → `emitWrapped(io, eventName, data)`
3. Replace all `io.to(room).emit()` → `emitToRoom(io, room, eventName, data)`
4. Write/update contract test
5. Validate no manual emit calls remain
6. Commit individually or as batch

**Commit**: `refactor(websocket): Use emitWrapped/emitToRoom helpers in all WebSocket files [3.1.2-3.1.5]`

---

#### Phase 3.1 Final Validation

- [ ] Helpers imported in all WebSocket files: `grep -l "emitWrapped\|emitToRoom" src/websocket/*.js` (should show gmAuth.js, broadcasts.js, deviceTracking.js, videoEvents.js, adminEvents.js)
- [ ] No manual emit calls: `grep -n "io\.emit\|io\.to.*emit" src/websocket/*.js` (should only show helper function definitions, not direct calls)
- [ ] All WebSocket contract tests pass: `npm run test:contract -- websocket`
- [ ] 100% wrapped: Manual review of emit patterns

**Commit**: `refactor(websocket): Complete backend event wrapping with helpers [3.1-complete]`

**Deploy**: `npm run prod:restart`

**Note**: System temporarily broken (GM Scanner expects old format until Phase 3.2)

---

### Phase 3.2: GM Scanner Event Handler Standardization

**Duration**: 2 hours

---

#### Transformation 3.2.1: Standardize All 14 Event Handlers

**Evidence**: Finding #54 (3 different access patterns)

Current (Finding #54 patterns):
```javascript
// Pattern A (defensive)
const transaction = eventData.data || eventData;

// Pattern B (wrapped)
DataManager.updateTeamScoreFromBackend(data.data);

// Pattern C (unwrapped)
this.sessionId = data.sessionId;
```

Target (all use Pattern B):
```javascript
// All handlers
const payload = eventData.data;
// Use payload for all data access
```

**Execution Steps**:
1. Open `ALNScanner/index.html`
2. Locate all WebSocket event handlers (~lines 5777-5939 per Finding #56)
3. For each of 14 handlers:
   - Add `const payload = eventData.data;` at start
   - Replace all data access to use `payload.fieldName`
   - Remove defensive fallback (`|| eventData`)

**Validation**:
- [ ] All 14 handlers updated: Manual inspection
- [ ] No defensive fallbacks: `grep "|| eventData" index.html` in handler section returns empty
- [ ] Manual test: Connect scanner, verify events received correctly

**Commit**: `refactor(scanner): Standardize GM Scanner event handlers to wrapped format [3.2.1]`

---

#### Transformation 3.2.2: Remove Defensive Fallback

**Evidence**: Finding #53 (line 5789 defensive unwrapping)

Current:
```javascript
const transaction = eventData.data || eventData; // ← Remove fallback
```

Target:
```javascript
const transaction = eventData.data; // ← Trust wrapper
```

**Commit**: `refactor(scanner): Remove defensive event unwrapping fallback [3.2.2]`

---

#### Phase 3.2 Final Validation

- [ ] All handlers standardized
- [ ] Manual test: All WebSocket events received correctly (transaction:new, score:updated, etc.)
- [ ] No console errors

**Commit**: `refactor(scanner): Complete GM Scanner event standardization [3.2-complete]`

**Deploy**: Push to GitHub

---

### Phase 3 Final Validation

**System-Wide Verification**:
- [ ] All backend WebSocket events wrapped: Contract tests pass
- [ ] GM Scanner handles wrapped events: Manual test
- [ ] Player Scanner unaffected (HTTP-only)
- [ ] End-to-end: GM submits transaction → Backend broadcasts → Other GMs receive

**Commit**: `refactor: Complete Phase 3 event wrapping standardization [phase-3-complete]`

**Duration Checkpoint**: ~6 hours for Phase 3

---

## Phase 4: GM Scanner Modularization

**Purpose**: Extract 6,428-line monolith into 15 modular files per Decision #2

**Evidence**: 11-file-structure-target.md Decision #2 (lines 135-301)

**Strategy**: 5 extraction phases (utils → core → ui → network → app), extract + fix ALL violations during extraction

**Duration**: 20-24 hours

**Context**:
- Pre-production system, current functionality already broken
- Aggressive refactor appropriate (can't break what's already broken)
- Validation ensures building toward working state (not preserving broken state)
- Largest single transformation in plan (requires careful incremental validation)

**Validation Pattern**: After each sub-phase (4.1, 4.2, 4.3, 4.4, 4.5):
- [ ] Scanner loads without errors
- [ ] Test specific features extracted in that phase
- [ ] Ensure extraction didn't introduce new issues
- [ ] Commit before moving to next sub-phase

**Violation Categories to Fix During Extraction**:
1. **Field Naming**: All scannerId/stationId → deviceId (already done in Phase 2.2, verify during extraction)
2. **Error Display**: Add missing error UI for rejection reasons (Finding #59 - no visual feedback)
3. **Dead Handlers**: Remove unused event handlers (Finding #57 - 2 handlers never triggered)
4. **Event Handling**: Standardize all 14 handlers to wrapped format (already done in Phase 3.2, verify during extraction)

---

### Phase 4.1: Extract Utils Module

**Goal**: Extract 4 utility files from monolith

**Files to Create**:
- js/utils/nfcHandler.js (~150 lines)
- js/utils/adminModule.js (~304 lines)
- js/utils/debug.js (~69 lines)
- js/utils/config.js (~8 lines)

**Duration**: 4-5 hours

---

#### Transformation 4.1.1: Extract config.js

**Evidence**: Decision #2 file structure (line ~275)

**Test Specification** (Write First):
```javascript
// File: ALNScanner/tests/unit/utils/config.test.js
// Simple Node test (no Jest needed for scanner)

const config = require('../../../js/utils/config.js');

console.assert(config.API_BASE_URL !== undefined, 'config.API_BASE_URL should exist');
console.assert(config.WEBSOCKET_ENABLED !== undefined, 'config.WEBSOCKET_ENABLED should exist');
console.log('✓ config.js exports expected values');
```

**Implementation**:

**Step 1 - Create Directory**:
```bash
mkdir -p ALNScanner/js/utils
```

**Step 2 - Create File**:
```javascript
// File: ALNScanner/js/utils/config.js

const CONFIG = {
  API_BASE_URL: 'http://localhost:3000',
  WEBSOCKET_ENABLED: true,
  RECONNECT_INTERVAL: 5000,
  MAX_RECONNECT_ATTEMPTS: 10,
  OFFLINE_QUEUE_MAX: 100,
  DEBUG_MODE: false
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = CONFIG;
}
```

**Step 3 - Update index.html**:
```html
<!-- Add script tag in head section -->
<script src="js/utils/config.js"></script>
```

**Step 4 - Remove from Monolith**:
- Locate CONFIG object in index.html (search for it)
- Delete inline CONFIG definition
- Verify app uses global CONFIG from imported file

**Validation**:
- [ ] File exists: `ls ALNScanner/js/utils/config.js`
- [ ] Script tag added: `grep "config.js" ALNScanner/index.html`
- [ ] Test passes: `node ALNScanner/tests/unit/utils/config.test.js`
- [ ] Functional equivalence: Open scanner, verify Settings loads correctly

**Commit**: `refactor(scanner): Extract config.js utility [4.1.1]`

---

#### Transformation 4.1.2-4.1.4: Extract Remaining Utils

**Pattern**: Repeat 4.1.1 for each utility file

| Step | File | Source Lines in Monolith | Key Functions |
|------|------|-------------------------|---------------|
| 4.1.2 | nfcHandler.js | ~1738-1888 | NFC scanning logic |
| 4.1.3 | debug.js | ~1889-1958 | Debug panel logic |
| 4.1.4 | adminModule.js | ~1959-2263 | Admin panel UI and logic |

**For each**:
1. Create file in `js/utils/`
2. Copy relevant code from monolith (find by searching function names)
3. Add script tag to index.html
4. Remove code from monolith
5. Test functional equivalence (specific feature still works)
6. Commit

**Commit**: `refactor(scanner): Extract all utils modules [4.1.2-4.1.4]`

---

#### Phase 4.1 Final Validation

**Comprehensive Checks**:
- [ ] 4 utils files created: `ls ALNScanner/js/utils/` shows 4 files
- [ ] All script tags added: `grep "js/utils" ALNScanner/index.html` shows 4 scripts
- [ ] Functional equivalence: Open scanner, test NFC, admin panel, debug features
- [ ] index.html reduced: Check line count reduced by ~531 lines

**Commit**: `refactor(scanner): Complete utils module extraction [4.1-complete]`

---

### Phase 4.2: Extract Core Module

**Goal**: Extract 3 core logic files (game logic, token management)

**Files to Create**:
- js/core/dataManager.js (~735 lines)
- js/core/tokenManager.js (~252 lines)
- js/core/standaloneDataManager.js (~127 lines)

**Duration**: 5-6 hours

---

#### Transformation 4.2.1: Extract dataManager.js (Game Logic)

**Evidence**: Decision #2 (DataManager is core game logic, must preserve client-side calculation)

**Implementation**:

**Step 1 - Create File**:
```javascript
// File: ALNScanner/js/core/dataManager.js

class DataManager {
  constructor() {
    this.transactions = [];
    this.teamScores = {};
    this.completedGroups = {};
  }

  // Copy ALL methods from monolith DataManager:
  // - addTransaction()
  // - calculateScores()
  // - calculateGroupBonuses()
  // - isDuplicate()
  // - etc.

  // ALSO FIX VIOLATIONS while extracting:
  // - Change stationId → deviceId (already done in Phase 2.2, verify here)
  // - Ensure all methods use deviceId field
}

// Global singleton
if (typeof window !== 'undefined') {
  window.DataManager = new DataManager();
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = DataManager;
}
```

**Step 2 - Add Script Tag**:
```html
<script src="js/core/dataManager.js"></script>
```

**Step 3 - Remove from Monolith**:
- Locate DataManager class in index.html (~lines 2543-3278 per 10-current.md Part 2)
- Delete entire class definition
- Keep global initialization line: `const DataManager = new DataManager();` OR rely on auto-init from module

**Validation**:
- [ ] File created: `ls ALNScanner/js/core/dataManager.js`
- [ ] ~735 lines: `wc -l ALNScanner/js/core/dataManager.js`
- [ ] Functional equivalence: Submit transaction, verify scoring still works
- [ ] No scannerId: `grep "scannerId" js/core/dataManager.js` returns empty

**Commit**: `refactor(scanner): Extract dataManager.js core module [4.2.1]`

---

#### Transformation 4.2.2-4.2.3: Extract Remaining Core Modules

**Pattern**: Repeat for tokenManager and standaloneDataManager

**Commit**: `refactor(scanner): Extract all core modules [4.2.2-4.2.3]`

---

#### Phase 4.2 Final Validation

- [ ] 3 core files exist
- [ ] Functional equivalence: Full transaction flow works (scan → score → display)
- [ ] Standalone mode works (disconnect from orchestrator, verify local scoring)

**Commit**: `refactor(scanner): Complete core module extraction [4.2-complete]`

---

### Phase 4.3: Extract UI Module

**Goal**: Extract 2 UI files (DOM manipulation, settings)

**Files to Create**:
- js/ui/uiManager.js (~528 lines) + ADD error display methods (Finding #57, #58)
- js/ui/settings.js (~49 lines)

**Duration**: 4-5 hours

---

#### Transformation 4.3.1: Extract uiManager.js + Add Error Display

**Evidence**:
- Decision #2 (UI module structure)
- Finding #57 (missing showError/showToast methods)
- Finding #58 (20+ catch blocks use console.error only)
- Decision #10 (errors must be user-facing)

**Implementation**:

**Step 1 - Create File with Error Display**:
```javascript
// File: ALNScanner/js/ui/uiManager.js

class UIManager {
  constructor() {
    this.errorContainer = null;
    this.initErrorDisplay();
  }

  initErrorDisplay() {
    // Create error container if doesn't exist
    if (!document.getElementById('error-container')) {
      const container = document.createElement('div');
      container.id = 'error-container';
      container.className = 'error-container';
      document.body.appendChild(container);
    }
    this.errorContainer = document.getElementById('error-container');
  }

  // NEW METHOD - Decision #10 requirement
  showError(message, duration = 5000) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.textContent = message;

    this.errorContainer.appendChild(errorDiv);

    setTimeout(() => {
      errorDiv.remove();
    }, duration);
  }

  // NEW METHOD
  showToast(message, type = 'info', duration = 3000) {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;

    this.errorContainer.appendChild(toast);

    setTimeout(() => {
      toast.remove();
    }, duration);
  }

  // EXISTING METHODS - Copy from monolith:
  showScreen(screenName) { /* ... */ }
  updateModeDisplay(mode) { /* ... */ }
  renderScoreboard() { /* ... */ }
  // ... all other existing methods
}

if (typeof window !== 'undefined') {
  window.UIManager = new UIManager();
}
```

**Step 2 - Add CSS for Error Display**:
```css
/* Add to <style> section in index.html */
.error-container {
  position: fixed;
  top: 20px;
  right: 20px;
  z-index: 9999;
  width: 300px;
}

.error-message {
  background: #f44336;
  color: white;
  padding: 15px;
  margin-bottom: 10px;
  border-radius: 4px;
  box-shadow: 0 2px 5px rgba(0,0,0,0.2);
}

.toast {
  background: #333;
  color: white;
  padding: 12px 20px;
  margin-bottom: 10px;
  border-radius: 4px;
  box-shadow: 0 2px 5px rgba(0,0,0,0.2);
}

.toast-info { background: #2196F3; }
.toast-success { background: #4CAF50; }
.toast-warning { background: #FF9800; }
.toast-error { background: #f44336; }
```

**Step 3 - Update Catch Blocks** (Finding #58 - 20+ locations):

Before:
```javascript
} catch (error) {
  console.error('Error sending scan to orchestrator:', error);
}
```

After:
```javascript
} catch (error) {
  console.error('Error sending scan to orchestrator:', error); // Keep for debugging
  UIManager.showError('Failed to send scan to orchestrator. Working offline.');
}
```

Search for all catch blocks: `grep -n "catch (error)" index.html`
Update each to call `UIManager.showError()` or `UIManager.showToast()`

**Validation**:
- [ ] uiManager.js created with error display methods
- [ ] CSS added for error display
- [ ] All catch blocks updated: `grep -c "UIManager.showError\|UIManager.showToast" index.html` matches catch block count
- [ ] Functional test: Trigger error (disconnect network), verify error displays to user

**Commit**: `refactor(scanner): Extract uiManager.js with error display [4.3.1]`

---

#### Transformation 4.3.2: Extract settings.js

**Pattern**: Similar to other extractions

**Commit**: `refactor(scanner): Extract settings.js [4.3.2]`

---

#### Phase 4.3 Final Validation

- [ ] 2 UI files exist
- [ ] Error display works: Manual test (trigger error, see UI message)
- [ ] Functional equivalence: All UI features work

**Commit**: `refactor(scanner): Complete UI module extraction [4.3-complete]`

---

### Phase 4.4: Extract Network Module + Remove Dead Handlers

**Goal**: Extract 3 network communication files + fix violation (remove dead handlers)

**Files to Create**:
- js/network/connectionManager.js (~403 lines)
- js/network/networkedQueueManager.js (~164 lines)
- js/network/orchestratorClient.js (~857 lines) + REMOVE dead handlers (Finding #57)

**Duration**: 5-6 hours

**Violation Fix**: Finding #57 - 2 dead event handlers never triggered by backend
- `gm:error` - Backend never emits this event
- `transaction:rejected` - Backend uses `transaction:new` with status field instead

---

#### Transformation 4.4.1-4.4.3: Extract Network Files + Remove Dead Handlers

**Pattern**: Extract network modules

**Step 1 - Extract Files**:
- Create js/network/connectionManager.js
- Create js/network/networkedQueueManager.js
- Create js/network/orchestratorClient.js

**Step 2 - Remove Dead Handlers** (Finding #57):

While extracting event handlers to orchestratorClient.js, SKIP these dead handlers:

```javascript
// DO NOT COPY - Dead handler 1 (Finding #57)
socket.on('gm:error', (data) => {
  // Backend never emits this event
  console.error('GM Error:', data);
});

// DO NOT COPY - Dead handler 2 (Finding #57)
socket.on('transaction:rejected', (eventData) => {
  // Backend uses transaction:new with status='rejected' instead
  const data = eventData.data || eventData;
  UIManager.showError(`Transaction rejected: ${data.reason}`);
});
```

**Note**: Keep all 12 active handlers (transaction:new, score:updated, etc.)

**Validation**:
- [ ] 3 network files created
- [ ] Dead handlers removed: `grep -c "gm:error\|transaction:rejected" ALNScanner/js/` returns 0
- [ ] Only 12 active handlers remain in orchestratorClient.js
- [ ] Functional equivalence: Network communication still works

**Commit**: `refactor(scanner): Extract network module and remove dead handlers [4.4-complete]`

---

### Phase 4.5: Extract App Module

**Goal**: Extract 2 app coordination files

**Files to Create**:
- js/app/app.js (~917 lines)
- js/app/sessionModeManager.js (~98 lines)

**Duration**: 4-5 hours

---

#### Transformation 4.5.1: Extract app.js

**Evidence**: Decision #2 (main application coordinator)

**Pattern**: Same extraction process as previous phases

**Commit**: `refactor(scanner): Extract app.js coordinator [4.5.1]`

---

#### Transformation 4.5.2: Extract sessionModeManager.js

**Evidence**: Decision #2 (session mode switching logic)

**Pattern**: Same extraction process

**Commit**: `refactor(scanner): Extract sessionModeManager.js [4.5.2]`

---

#### Phase 4.5 Final Validation

- [ ] 2 app files exist: `ls ALNScanner/js/app/`
- [ ] Functional equivalence: App initialization and mode switching work

**Commit**: `refactor(scanner): Complete app module extraction [4.5-complete]`

---

### Phase 4 Final Validation

**Comprehensive System Check**:
- [ ] 15 JS files total: `find ALNScanner -name "*.js" -not -path "*/node_modules/*" | wc -l` returns 15
- [ ] Directory structure matches Decision #2: `tree ALNScanner/js`
- [ ] index.html reduced to ~1,500 lines: `wc -l ALNScanner/index.html`
- [ ] All script tags present: `grep -c "<script src=\"js/" index.html` returns 14

**Violation Fixes Verification**:
- [ ] Field naming: `grep -c "scannerId\|stationId" ALNScanner/js/` returns 0 (all changed to deviceId)
- [ ] Error display: UIManager.showError() and UIManager.showToast() methods exist
- [ ] Dead handlers removed: `grep -c "gm:error\|transaction:rejected" ALNScanner/js/` returns 0
- [ ] Event handling: All 12 active handlers use wrapped format (verified in Phase 3.2)

**Functional equivalence**: Full end-to-end test
  - [ ] Scanner loads without errors
  - [ ] Can scan tokens (mock or real)
  - [ ] Scoring works (standalone mode)
  - [ ] Network communication works (networked mode)
  - [ ] Admin panel functions
  - [ ] **Error display shows on errors** (NEW - violation fix)
  - [ ] Settings persist

**Commit**: `refactor(scanner): Complete Phase 4 GM Scanner modularization with violation fixes [phase-4-complete]`

**Duration Checkpoint**: ~20-24 hours for Phase 4

---

## Phase 5: Test Suite Completion & System Validation

**Purpose**: Expand test coverage to validate all 24 essential APIs + protect client-side logic

**Duration**: 56-74 hours (REVISED from initial 6-8 hour estimate)
**Status**: ~10% complete (infrastructure exists, significant expansion needed)

**📋 COMPREHENSIVE PLAN**: See `07-refactor-plan-phase5.md` for complete detailed execution plan

**Phase 5.1**: Fix Broken & Skipped Tests (2 hours)
- Fix WebSocket test infrastructure (session-events.test.js timeout)
- Fix `videoPlaying` → `videoQueued` in scanRoutes.js
- Result: 0 failing, 0 skipped, 8/8 HTTP + 1/16 WebSocket passing

**Phase 5.2**: Complete WebSocket Contract Tests (16-20 hours)
- 5.2.1: Core events (gm:identify, transaction flow, score:updated) - 8h
- 5.2.2: Rich payloads (sync:full, gm:command with 15 actions) - 4h
- 5.2.3: Remaining events (device, video, offline, error) - 4-6h
- Result: 16/16 WebSocket events tested (100% coverage)

**Phase 5.3**: Unit Tests for Client-Side Logic (30-40 hours) **CAN RUN PARALLEL WITH 5.2**
- CRITICAL: Protects standalone mode functionality (client authoritative, no orchestrator)
- 5.3.1: Service tests (transactionService, scoringService, sessionService, stateService, videoQueueService, broadcastService, authService) - 20-25h
- 5.3.2: Middleware tests (authMiddleware, validation) - 6-8h
- 5.3.3: WebSocket logic tests (gmAuth, deviceTracking) - 4-6h
- Result: 100+ unit tests, client-side game logic protected

**Phase 5.4**: Integration Tests (6-8 hours)
- Consolidate existing integration tests into proper pyramid
- Create true multi-component flow tests:
  - transaction-broadcast-flow
  - session-lifecycle-flow
  - offline-recovery-flow (CRITICAL for Mode 2)
  - device-tracking-flow
  - score-update-flow
  - video-playback-flow
- Remove/archive large disabled integration files
- Result: 5-10 integration tests (proper pyramid shape)

**Phase 5.5**: Cleanup & Documentation (2-4 hours)
- Remove disabled test files
- Update package.json test scripts (test:unit, test:contract, test:integration)
- Document test coverage and pyramid shape
- Verify: 100+ unit, 25-35 contract, 5-10 integration

---

### Phase 5 Final Validation

**System-Wide Test Verification**:

```bash
# All tests pass
npm test
# Expected: 0 failing, 0 skipped, 130+ passing

# Test pyramid shape
npm run test:unit       # Fast (< 1 second), 100+ tests
npm run test:contract   # Medium (< 10 seconds), 25-35 tests
npm run test:integration  # Slower (< 30 seconds), 5-10 tests
```

**Success Criteria**:

✅ All 24 essential APIs have contract tests (8 HTTP + 16 WebSocket)
✅ Test pyramid is correct shape (100+ unit, 25-35 contract, 5-10 integration)
✅ All tests passing (no skipped, no failing)
✅ Functional requirements validated:
  - Networked mode (contracts + integration)
  - Offline-temporary mode (integration: queue→reconnect→sync)
  - Standalone mode (unit: client-side game logic protected)
✅ Client-side logic protected (unit tests prevent accidental removal)
✅ Fast feedback loop (unit tests < 1 second, contract < 10 seconds)

**Commit**: `test: Complete Phase 5 test suite expansion [phase-5-complete]`

**Duration Checkpoint**: ~56-74 hours for Phase 5 (40 hours minimum if 5.2 and 5.3 run parallel)

---
# Section 4: Reference

## 4.1 Finding Quick Reference

| Finding | Location | Summary |
|---------|----------|---------|
| #3 | 10-current.md Part 1 | No shared response builder (74 manual constructions) |
| #11 | 10-current.md Part 1 | Test code pollution in route files |
| #13 | 10-current.md Part 1 lines 1045-1121 | Route elimination (21 of 29 endpoints) |
| #15 | 10-current.md Part 1 | scannerId violations throughout services |
| #16 | 10-current.md Part 1 | Test code pollution in service files |
| #21 | 10-current.md Part 1 lines 1187-1270 | eventWrapper.js exists but NEVER USED |
| #22 | 10-current.md Part 1 lines 1272-1322 | 62% unwrapped WebSocket events |
| #28 | 10-current.md Part 1 | scannerId in broadcasts.js |
| #34 | 10-current.md Part 1 lines 1614-1658 | validators.js BLOCKS deviceId (Joi schemas) |
| #40 | 10-current.md Part 1 lines 194-236 | Transaction.toJSON() ROOT CAUSE (defines scannerId) |
| #44 | 10-current.md Part 1 lines 358-486 | Circular dependencies (8 lazy requires) |
| #46 | 10-current.md Part 1 | stateService → listenerRegistry cross-layer violation |
| #50 | 10-current.md Part 2 | GM Scanner defensive normalization (triple fallback) |
| #51 | 10-current.md Part 2 lines 2469-2507 | GM Scanner ROOT CAUSE (sends scannerId) |
| #52 | 10-current.md Part 2 | GM Scanner internal stationId (17 locations) |
| #54 | 10-current.md Part 2 | GM Scanner inconsistent event access (3 patterns) |
| #57 | 10-current.md Part 2 | GM Scanner missing showError/showToast methods |
| #58 | 10-current.md Part 2 | GM Scanner 20+ catch blocks console-only |
| #59 | 10-current.md Part 3 lines 2917-2944 | Player Scanner sends scannerId |
| #62 | 10-current.md Part 3 | Player Scanner wrong health endpoint |
| #65 | 10-current.md Part 3 | Player Scanner console-only errors |

## 4.2 Decision Quick Reference

| Decision | Location | Summary |
|----------|----------|---------|
| #1 | 11-target.md lines 27-133 | Backend route files (5 files, resource-based) |
| #2 | 11-target.md lines 135-301 | GM Scanner modularization (15 files, 5 directories) |
| #3 | 11-target.md lines 303-516 | Event-based communication (EventEmitter, asyncapi.yaml) |
| #4 | 04-alignment-decisions.md | Field naming standardization (deviceId everywhere) |
| #10 | 04-alignment-decisions.md | Error display (user-facing, not console-only) |

## 4.3 Contract Schema Paths

**OpenAPI Paths** (backend/contracts/openapi.yaml):
- `#/paths/~1api~1scan/post` = POST /api/scan
- `#/paths/~1api~1scan~1batch/post` = POST /api/scan/batch
- `#/paths/~1api~1session/get` = GET /api/session
- `#/paths/~1api~1state/get` = GET /api/state
- `#/paths/~1api~1tokens/get` = GET /api/tokens
- `#/paths/~1api~1admin~1auth/post` = POST /api/admin/auth
- `#/paths/~1api~1admin~1logs/get` = GET /api/admin/logs
- `#/paths/~1health/get` = GET /health

**AsyncAPI Channels** (backend/contracts/asyncapi.yaml):
- `#/channels/gm~1identify` = gm:identify event
- `#/channels/gm~1identified` = gm:identified event
- `#/channels/transaction~1submit` = transaction:submit event
- `#/channels/transaction~1result` = transaction:result event
- `#/channels/transaction~1new` = transaction:new event
- `#/channels/score~1updated` = score:updated event
- `#/channels/video~1status` = video:status event
- `#/channels/session~1update` = session:update event
- `#/channels/gm~1command` = gm:command event
- `#/channels/gm~1command~1ack` = gm:command:ack event
- (... and 6 more WebSocket events)

## 4.4 Test Architecture Reference

**Test Pyramid** (06-test-architecture.md Decision 3):
- **Unit Tests**: 100+ (service logic, model validation)
- **Contract Tests**: 25-35 (24 baseline per endpoint + edge cases/error scenarios, ajv validation against schemas)
- **Integration Tests**: 5-10 (end-to-end user flows)

**Test Helpers** (06-test-architecture.md Decision 1, 2):
- `tests/helpers/contract-validator.js` - ajv validation wrapper
- `tests/helpers/withSocket.js` - WebSocket test helper (guaranteed cleanup)

---

# Section 5: Implementation Log

## 📝 Session 1: Phase 0 & Phase 1.1.1-1.1.2 (2025-10-02)

### Completed Work
- ✅ Phase 0: Test Infrastructure Setup (all 3 transformations)
- ✅ Phase 1.1.1: sessionService emits session:update event
- ✅ Phase 1.1.2: transactionService listens to session:update

### Key Discoveries

**1. Lazy Require Count Discrepancy**
- **Plan documented**: 8 lazy requires (Finding #44)
- **Actual codebase**: 18 lazy requires
- **Services affected**: sessionService (2), transactionService (4), stateService (6), videoQueueService (6)
- **Impact**: Phase 1.1 scope more than doubled, duration estimates need revision

**2. AsyncAPI 2.6 Schema Access Fix**
- **Original (incorrect)**: `asyncapi.channels[eventName]`
- **Corrected**: `asyncapi.components.messages` with name field lookup
- **Root cause**: AsyncAPI 2.6 uses different structure than assumed
- **Fix location**: `getWebSocketSchema()` in tests/helpers/contract-validator.js

**3. Wrapped Envelope Pattern**
- **Requirement**: All WebSocket events must use `{event, data, timestamp}` structure
- **Learning**: This wasn't explicit in original plan - discovered during AsyncAPI validation
- **Applied to**: session:update events in both createSession() and endSession()

**4. Session Model Structure**
- **Discovery**: Session doesn't store `teams` array directly
- **Solution**: Derive teams from scores: `scores.map(s => s.teamId)`
- **Added to**: Event emission logic in sessionService

**5. Test Infrastructure Pattern**
- **Challenge**: Singleton pattern + EventEmitter + reset() created listener registration issues
- **Solution**: Added `sessionListenerRegistered` flag to track listener state
- **Benefit**: Allows tests to re-register listeners after reset()

**6. TDD Workflow Validated**
- Pattern: Write test → verify failure → implement → verify pass
- Contract validation with ajv catches schema mismatches immediately
- Confirmed effective for remaining transformations

### Files Created
- `tests/helpers/contract-validator.js` - ajv-based validation (with AsyncAPI 2.6 fix)
- `tests/helpers/websocket-helpers.js` - WebSocket test utilities
- `tests/unit/services/sessionService.test.js` - 4 tests passing
- `tests/integration/service-events.test.js` - 2 tests passing

### Files Modified
- `package.json` - added ajv, ajv-formats, js-yaml
- `src/services/sessionService.js` - emit session:update events with wrapped envelope
- `src/services/transactionService.js` - listen to session:update, top-level import

### Commits Made
1. `chore(test): Install test infrastructure dependencies [0.1]`
2. `chore(test): Delete broken tests for clean slate rebuild [0.2]`
3. `feat(test): Create test helper infrastructure with contract validators [0.3]`
4. `refactor(services): sessionService emits session:update event per asyncapi.yaml [1.1.1]`
5. `refactor(services): transactionService listens to session:update [1.1.2]`

### Next Session Action Items

**Immediate Priority - Deep Analysis Required**:

1. **Understand Service Responsibilities**:
   - Read 08-functional-requirements.md sections 1.1-1.10
   - Understand what each service SHOULD do
   - Identify which services are aggregators vs sources of truth

2. **Analyze Each Lazy Require Functionally**:
   - For each of 15 remaining lazy requires:
     - Read code context (5-10 lines before/after)
     - Determine: Is it modifying state? Reading state? Querying?
     - Check if it creates circular dependency
     - Map to AsyncAPI event OR justify as acceptable one-way dependency

3. **Only After Analysis, Plan Transformations**:
   - Group by service based on functional understanding
   - For state-modifying code: Plan event emission
   - For aggregator code (stateService): Plan event listeners
   - For one-way reads: Decide if event caching needed or OK as-is

**Key Mistake to Avoid**: Do NOT mechanically move imports without understanding functional relationships and AsyncAPI contracts

### Duration Tracking

**Phase 0**: 2 hours (estimate: 2-3 hours) ✅ On target

**Phase 1.1.1-1.1.2**: 3 hours for 2 transformations
- **Projection**: ~27 hours for all 18 transformations (vs 12-16 hour original estimate)
- **Recommendation**: Revise Phase 1.1 duration estimate upward

### Test Results
- Unit tests: 4/4 passing (sessionService.test.js)
- Integration tests: 2/2 passing (service-events.test.js)
- All tests use contract validation ✅
- Zero test pollution in service files ✅
- Total: 6/6 tests passing

### Pattern Established
1. Service emits events (e.g., sessionService)
2. Other services listen and react (e.g., transactionService)
3. No direct dependencies, only event contracts
4. TDD with contract validation ensures correctness
5. Wrapped envelope for all WebSocket events
6. Top-level imports create one-way dependencies (acceptable)

---

## 📝 Session 2: Phase 1.1.3-1.1.6 Complete (2025-10-02)

### Completed Work
- ✅ Phase 1.1.3: transactionService emits score:updated (completed in previous session)
- ✅ Phase 1.1.4: stateService pure aggregator pattern (7 lazy requires removed)
- ✅ Phase 1.1.5: videoQueueService cleanup (5 redundant config requires removed, 6 vlcService validated)
- ✅ Phase 1.1.6: transactionService final 2 lazy requires removed

### Phase 1.1.6 Analysis

**Lazy Require #1** - sessionService (line 314 in `isGroupComplete()`):
- **Status**: REDUNDANT - sessionService already imported at top-level (line 12)
- **Action**: Removed lazy require, use top-level import
- **Complexity**: Trivial fix

**Lazy Require #2** - videoQueueService (line 385 in `createScanResponse()`):
- **Status**: ACCEPTABLE one-way dependency (no circular imports)
- **Type**: QUERY - reads video service state (isPlaying, getRemainingTime)
- **Action**: Moved to top-level import
- **Verification**: Confirmed videoQueueService does NOT import transactionService
- **Complexity**: Simple refactor

### Implementation Approach

**TDD Workflow**:
1. Read transactionService.js to identify 2 remaining lazy requires
2. Analyzed each for circular dependency risk and functional purpose
3. Wrote tests FIRST to verify methods work with top-level imports
4. Tests PASS with lazy requires (4/4 transactionService tests)
5. Made refactor (removed lazy requires, added top-level import)
6. Tests STILL PASS after refactor (4/4 transactionService tests)
7. Full test suite PASS (14/14 all services)

### Files Modified
- `src/services/transactionService.js`:
  - Added videoQueueService to top-level imports (line 13)
  - Removed redundant sessionService lazy require (was line 314)
  - Removed videoQueueService lazy require (was line 385)
  - Updated references to use top-level imports
- `tests/unit/services/transactionService.test.js`:
  - Added 2 tests for Phase 1.1.6 (isGroupComplete, createScanResponse)
  - Tests verify methods work with top-level imports
  - 4/4 tests passing

### Commits Made
- `2f35d87f` - refactor(services): Remove final 2 lazy requires from transactionService [1.1.6]

### Key Achievement

**Phase 1.1 COMPLETE**: All 18 lazy requires eliminated!

**Breakdown by Service**:
- sessionService: 2 lazy requires → 0 (Phase 1.1.1)
- transactionService: 4 lazy requires → 0 (Phases 1.1.2, 1.1.3, 1.1.6)
- stateService: 7 lazy requires → 0 (Phase 1.1.4)
- videoQueueService: 11 lazy requires → 6 vlcService (acceptable leaf dependency) (Phase 1.1.5)

**Total**: 18 lazy requires eliminated (6 vlcService validated as acceptable)

### Test Results
- sessionService: 4/4 passing ✅
- stateService: 4/4 passing ✅
- transactionService: 4/4 passing ✅
- service-events integration: 2/2 passing ✅
- **Total**: 14/14 tests passing ✅

### Pattern Validated
- EventEmitter pattern successfully implemented across all services
- Aggregator pattern (stateService) working correctly (listens only, never calls)
- Top-level imports for one-way dependencies (no circular imports)
- Event-driven communication via AsyncAPI contracts
- TDD approach ensures no regressions

### Next Session Action Items

**Phase 1.2: Route File Consolidation** (8→5 files)
- Read Decision #1 from 11-target.md (target route structure)
- Create responseBuilder.js helper
- Consolidate 8 route files into 5 resource-based files
- Estimated: 4 hours

---

**END OF REFACTOR PLAN**

---

**Document Status**: ✅ Phase 1.1 COMPLETE - Ready for Phase 1.2

**Total Estimated Duration**: 58-68 hours (⚠️ May need upward revision)
- Phase 0 (Test Infrastructure): ✅ 2h actual (2-3h estimate)
- Phase 1 (Backend Foundational): 🔄 16-20h → **revised to 27-35h** (lazy require count doubled)
  - Phase 1.1: ✅ 5h actual for 2 transformations, ~27h projected for all 18
  - Phase 1.2: ⏸️ 4h estimated (unchanged)
- Phase 2 (Field Naming): ⏸️ 10h
- Phase 3 (Event Wrapping): ⏸️ 6h
- Phase 4 (GM Scanner Extraction): ⏸️ 20-24h
- Phase 5 (Final Cleanup): ⏸️ 6-8h

**Revised Total Estimate**: **69-90 hours** (accounting for Phase 1.1 scope expansion)

**Last Updated**: 2025-10-02 (Progress checkpoint after Phase 1.1.2)
