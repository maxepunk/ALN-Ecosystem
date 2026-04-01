# Test Architecture Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Establish a robust, ecosystem-wide test baseline with per-file coverage ratchet, shared mock factories, contract validation across all scanner modules, and mandatory E2E verification checkpoints.

**Architecture:** 5-phase incremental implementation. Phase 1 builds foundation tooling (coverage ratchet, CI fix, mock factories, functional test merge). Phase 2 adds scanner testing infrastructure (PlatformIO for ESP32, PWA scanner logic extraction). Phase 3 hardens contracts and coverage. Phase 4 improves test quality/organization. Phase 5 adds CI pipelines and documentation.

**Tech Stack:** Jest (backend + ALNScanner + PWA scanner), PlatformIO Unity (ESP32), Playwright (E2E), node:test (config-tool), js-yaml + ajv (contract validation)

**Design Document:** `docs/plans/2026-03-31-test-architecture-design.md`

---

## Inter-Phase Protocol

**This plan details Phase 1 fully.** Phases 2-5 contain task scope, files, and objectives but NOT full step-by-step implementation detail.

**Before starting each subsequent phase:**
1. Use the `superpowers:writing-plans` skill to flesh out that phase into full step-by-step detail (with complete code, exact commands, expected outputs)
2. The detailed phase plan must account for any changes made during previous phases

**After completing each phase:**
1. Use `superpowers:requesting-code-review` to review all work from that phase
2. ALL review findings must be investigated — no finding may be dismissed without actual investigation and careful consideration
3. Fix any issues found before proceeding to the next phase
4. Run full verification: `cd backend && npm test && npm run test:integration` + `cd ALNScanner && npm test`

---

## Phase 1: Foundation (fully detailed)

### Task 1: Create coverage ratchet script for backend

**Files:**
- Create: `backend/scripts/coverage-ratchet.js`
- Modify: `backend/package.json` (add scripts)
- Modify: `backend/jest.config.base.js` (load thresholds from file)

**Context:** Coverage ratchet tracks unit + contract test coverage only (not integration). This is intentional — integration tests run sequentially with different config and their coverage data is separate. The ratchet prevents regression in the fast-feedback test layer.

**Step 1: Write the ratchet script**

Create `backend/scripts/coverage-ratchet.js`:

```javascript
#!/usr/bin/env node
/**
 * Coverage Ratchet — generates per-file coverage thresholds from current data.
 * Tracks unit + contract coverage only (default jest config).
 * 
 * Usage:
 *   node scripts/coverage-ratchet.js generate   # Write .coverage-thresholds.json
 *   node scripts/coverage-ratchet.js check       # Verify no file regressed
 */
const fs = require('fs');
const path = require('path');

const COVERAGE_FILE = path.resolve(__dirname, '../coverage/coverage-final.json');
const THRESHOLDS_FILE = path.resolve(__dirname, '../.coverage-thresholds.json');
const ROUND_DOWN_TO = 5; // Round down to nearest 5%

function roundDown(value) {
  return Math.floor(value / ROUND_DOWN_TO) * ROUND_DOWN_TO;
}

function generate() {
  if (!fs.existsSync(COVERAGE_FILE)) {
    console.error('No coverage data found. Run: npm test -- --coverage');
    process.exit(1);
  }

  const coverage = JSON.parse(fs.readFileSync(COVERAGE_FILE, 'utf8'));
  const thresholds = {};

  for (const [filePath, data] of Object.entries(coverage)) {
    // Convert absolute path to relative with ./ prefix (Jest requirement — 
    // keys without ./ prefix silently fail to match)
    const relative = './' + path.relative(path.resolve(__dirname, '..'), filePath);
    
    // Skip non-src files
    if (!relative.startsWith('./src/')) continue;

    const { s: statements, b: branches, f: functions } = data;

    // Calculate percentages
    const stmtTotal = Object.keys(statements).length;
    const stmtCovered = Object.values(statements).filter(v => v > 0).length;
    const branchTotal = Object.values(branches).flat().length;
    const branchCovered = Object.values(branches).flat().filter(v => v > 0).length;
    const fnTotal = Object.keys(functions).length;
    const fnCovered = Object.values(functions).filter(v => v > 0).length;

    const lines = stmtTotal > 0 ? roundDown((stmtCovered / stmtTotal) * 100) : 0;
    const branchPct = branchTotal > 0 ? roundDown((branchCovered / branchTotal) * 100) : 0;
    const fnPct = fnTotal > 0 ? roundDown((fnCovered / fnTotal) * 100) : 0;

    thresholds[relative] = {
      branches: branchPct,
      functions: fnPct,
      lines: lines,
    };
  }

  // Sort keys for stable diffs
  const sorted = Object.fromEntries(
    Object.entries(thresholds).sort(([a], [b]) => a.localeCompare(b))
  );

  fs.writeFileSync(THRESHOLDS_FILE, JSON.stringify(sorted, null, 2) + '\n');
  console.log(`Wrote ${Object.keys(sorted).length} file thresholds to .coverage-thresholds.json`);
}

function check() {
  if (!fs.existsSync(THRESHOLDS_FILE)) {
    console.error('No .coverage-thresholds.json found. Run: npm run coverage:ratchet');
    process.exit(1);
  }
  if (!fs.existsSync(COVERAGE_FILE)) {
    console.error('No coverage data found. Run: npm test -- --coverage');
    process.exit(1);
  }

  const thresholds = JSON.parse(fs.readFileSync(THRESHOLDS_FILE, 'utf8'));
  const coverage = JSON.parse(fs.readFileSync(COVERAGE_FILE, 'utf8'));
  const failures = [];

  for (const [relative, threshold] of Object.entries(thresholds)) {
    const absolute = path.resolve(__dirname, '..', relative);
    const data = coverage[absolute];
    if (!data) continue; // File removed — skip

    const { s: statements, b: branches, f: functions } = data;
    const stmtTotal = Object.keys(statements).length;
    const stmtCovered = Object.values(statements).filter(v => v > 0).length;
    const branchTotal = Object.values(branches).flat().length;
    const branchCovered = Object.values(branches).flat().filter(v => v > 0).length;
    const fnTotal = Object.keys(functions).length;
    const fnCovered = Object.values(functions).filter(v => v > 0).length;

    const actual = {
      lines: stmtTotal > 0 ? (stmtCovered / stmtTotal) * 100 : 0,
      branches: branchTotal > 0 ? (branchCovered / branchTotal) * 100 : 0,
      functions: fnTotal > 0 ? (fnCovered / fnTotal) * 100 : 0,
    };

    for (const metric of ['branches', 'functions', 'lines']) {
      if (actual[metric] < threshold[metric]) {
        failures.push(`${relative}: ${metric} dropped to ${actual[metric].toFixed(1)}% (threshold: ${threshold[metric]}%)`);
      }
    }
  }

  if (failures.length > 0) {
    console.error('Coverage ratchet failures:');
    failures.forEach(f => console.error(`  ✗ ${f}`));
    process.exit(1);
  }

  console.log(`✓ All ${Object.keys(thresholds).length} files meet coverage thresholds`);
}

const command = process.argv[2];
if (command === 'generate') generate();
else if (command === 'check') check();
else {
  console.error('Usage: coverage-ratchet.js <generate|check>');
  process.exit(1);
}
```

**Step 2: Add npm scripts to package.json**

In `backend/package.json`, add to `"scripts"`:
```json
"coverage:ratchet": "jest --coverage --maxWorkers=4 && node scripts/coverage-ratchet.js generate",
"coverage:check": "node scripts/coverage-ratchet.js check"
```

**Step 3: Update jest.config.base.js to load per-file thresholds**

In `backend/jest.config.base.js`, replace the global `coverageThreshold` block (lines 54-61) with:
```javascript
const fs = require('fs');
const path = require('path');

const thresholdsPath = path.resolve(__dirname, '.coverage-thresholds.json');
const coverageThreshold = fs.existsSync(thresholdsPath)
  ? JSON.parse(fs.readFileSync(thresholdsPath, 'utf8'))
  : { global: { branches: 80, functions: 80, lines: 80, statements: 80 } };
```

Then use `coverageThreshold` in the module.exports.

**Step 4: Generate initial baseline**

```bash
cd backend
npm run coverage:ratchet
```

Expected: Creates `.coverage-thresholds.json` with per-file thresholds for all `src/**/*.js` files.

**Step 5: Verify ratchet check passes**

```bash
cd backend
npm test -- --coverage && npm run coverage:check
```

Expected: `✓ All N files meet coverage thresholds`

**Step 6: Commit**

```bash
git add backend/scripts/coverage-ratchet.js backend/package.json backend/jest.config.base.js backend/.coverage-thresholds.json
git commit -m "feat: add per-file coverage ratchet for backend"
```

---

### Task 2: Create coverage ratchet for ALNScanner and fix CI

**Files:**
- Create: `ALNScanner/scripts/coverage-ratchet.js` (copy from backend, adjust paths)
- Modify: `ALNScanner/package.json` (add scripts)
- Modify: `ALNScanner/jest.config.js` (load per-file thresholds, remove global thresholds)

**Step 1: Copy and adapt the ratchet script**

Copy `backend/scripts/coverage-ratchet.js` to `ALNScanner/scripts/coverage-ratchet.js`. Change the `relative` filter (line that checks `./src/`) to accept both `./src/` and `./js/` prefixes:

```javascript
// Skip files outside coverage collection scope
if (!relative.startsWith('./src/') && !relative.startsWith('./js/')) continue;
```

**Step 2: Update jest.config.js**

In `ALNScanner/jest.config.js`, replace the `coverageThreshold` block (lines 16-22) with dynamic loading:

```javascript
const fs = require('fs');
const path = require('path');

const thresholdsPath = path.resolve(__dirname, '.coverage-thresholds.json');
const coverageThreshold = fs.existsSync(thresholdsPath)
  ? JSON.parse(fs.readFileSync(thresholdsPath, 'utf8'))
  : { global: { branches: 70, functions: 80, lines: 80 } };
```

**Step 3: Add npm scripts**

In `ALNScanner/package.json`, add to `"scripts"`:
```json
"coverage:ratchet": "jest --coverage && node scripts/coverage-ratchet.js generate",
"coverage:check": "node scripts/coverage-ratchet.js check"
```

**Step 4: Generate initial baseline**

```bash
cd ALNScanner
npm run coverage:ratchet
```

**Step 5: Verify CI would now pass**

```bash
cd ALNScanner
npm test -- --coverage
```

Expected: PASS (per-file thresholds match current actuals, no global threshold to fail)

**Step 6: Commit in ALNScanner submodule, then update parent ref**

```bash
cd ALNScanner
git add scripts/coverage-ratchet.js package.json jest.config.js .coverage-thresholds.json
git commit -m "feat: replace global coverage thresholds with per-file ratchet"
git push

cd ..
git add ALNScanner
git commit -m "chore: update ALNScanner ref (per-file coverage ratchet)"
```

---

### Task 3: Merge functional tests into integration

**Files:**
- Move: `backend/tests/functional/fr-transaction-processing.test.js` → `backend/tests/integration/`
- Evaluate: `backend/tests/functional/fr-admin-panel.test.js` (imports `SessionModeManager` from ALNScanner)
- Evaluate: `backend/tests/functional/fr-deployment-modes.test.js` (imports `SessionModeManager` + `Settings` from ALNScanner)
- Delete: `backend/tests/functional/` directory (after moves)

**Step 1: Examine cross-module dependencies**

Read all three functional test files to confirm imports:
- `fr-transaction-processing.test.js` — backend-only imports (clean merge)
- `fr-admin-panel.test.js` — imports `SessionModeManager` from `../../../ALNScanner/src/app/sessionModeManager`
- `fr-deployment-modes.test.js` — imports `SessionModeManager` and `Settings` from ALNScanner

**Step 2: Move the clean merge file**

```bash
cd backend
mv tests/functional/fr-transaction-processing.test.js tests/integration/
```

**Step 3: Handle cross-module test files**

For `fr-deployment-modes.test.js`: Tests GM Scanner behavior (standalone vs networked mode selection). This belongs in ALNScanner's test suite. Move to `ALNScanner/tests/unit/app/` or delete if already covered by ALNScanner's `sessionModeManager.test.js`.

For `fr-admin-panel.test.js`: Investigate whether the `SessionModeManager` import is essential. If it's only used for mode setup and can be replaced with a mock, refactor and move to `backend/tests/integration/`. If the cross-module dependency is essential, move to ALNScanner.

**Step 4: Remove functional directory**

```bash
rm -r backend/tests/functional/
```

**Step 5: Verify tests still pass**

```bash
cd backend
npm test                          # unit + contract (should not be affected)
npm run test:integration          # integration (includes moved file)
```

**IMPORTANT:** The moved file runs via `npm run test:integration` (jest.integration.config.js), NOT `npm test` (which excludes `tests/integration/`).

**Step 6: Commit**

```bash
git add backend/tests/
git commit -m "refactor: merge functional tests into integration, remove functional layer"
```

---

### Task 4: Create shared mock factories for backend

**Files:**
- Create: `backend/tests/helpers/mocks/sessionService.js`
- Create: `backend/tests/helpers/mocks/transactionService.js`
- Create: `backend/tests/helpers/mocks/videoQueueService.js`
- Create: `backend/tests/helpers/mocks/bluetoothService.js`
- Create: `backend/tests/helpers/mocks/audioRoutingService.js`
- Create: `backend/tests/helpers/mocks/lightingService.js`
- Create: `backend/tests/helpers/mocks/offlineQueueService.js`
- Create: `backend/tests/helpers/mocks/index.js`

**Step 1: Study the real service APIs**

Read each service file to extract the complete public method list. The factory must match the real API exactly. **CRITICAL:** Use the actual method names from the source — do NOT guess. For example, `sessionService` uses `addTeamToSession()` (not `addTeam()`), `startGame()` (not `startSession()`).

Reference files:
- `backend/src/services/sessionService.js`
- `backend/src/services/transactionService.js`
- `backend/src/services/videoQueueService.js`
- `backend/src/services/bluetoothService.js`
- `backend/src/services/audioRoutingService.js`
- `backend/src/services/lightingService.js`
- `backend/src/services/offlineQueueService.js`

**Step 2: Create mock factory for sessionService**

Create `backend/tests/helpers/mocks/sessionService.js`:

```javascript
const { EventEmitter } = require('events');

/**
 * Create a mock sessionService matching the real service's public API.
 * Returns an EventEmitter with jest.fn() stubs for all public methods.
 * 
 * IMPORTANT: Method names must match backend/src/services/sessionService.js exactly.
 * If the real service API changes, update this factory.
 */
function createMockSessionService(overrides = {}) {
  const mock = new EventEmitter();
  
  // Session lifecycle
  mock.getCurrentSession = jest.fn().mockReturnValue(null);
  mock.createSession = jest.fn().mockResolvedValue({ id: 'test-session', name: 'Test', status: 'setup', teams: [] });
  mock.startGame = jest.fn().mockResolvedValue(undefined);
  mock.pauseSession = jest.fn().mockResolvedValue(undefined);
  mock.resumeSession = jest.fn().mockResolvedValue(undefined);
  mock.endSession = jest.fn().mockResolvedValue(undefined);
  mock.addTeamToSession = jest.fn().mockResolvedValue(undefined);
  
  // Data operations
  mock.addTransaction = jest.fn();
  mock.deleteTransaction = jest.fn().mockResolvedValue(undefined);
  mock.addPlayerScan = jest.fn();
  mock.updateDevice = jest.fn();
  mock.removeDevice = jest.fn();
  mock.saveCurrentSession = jest.fn().mockResolvedValue(undefined);
  mock.initializeTeamScores = jest.fn();
  
  // Lifecycle
  mock.init = jest.fn().mockResolvedValue(undefined);
  mock.reset = jest.fn().mockResolvedValue(undefined);
  
  // Listener registration
  mock.setupScoreListeners = jest.fn();
  mock.setupPersistenceListeners = jest.fn();
  mock.setupGameClockListeners = jest.fn();
  mock.registerTransactionListeners = jest.fn();
  mock.registerBroadcastListeners = jest.fn();

  // Apply overrides
  Object.assign(mock, overrides);
  
  return mock;
}

module.exports = { createMockSessionService };
```

**Step 3: Create remaining factories**

Follow the same pattern for each service. Each factory:
1. Extends EventEmitter
2. Stubs all public methods with `jest.fn()` — read the REAL service file first
3. Returns sensible defaults
4. Accepts `overrides` parameter for test-specific customization

**Step 4: Create index.js barrel export**

Create `backend/tests/helpers/mocks/index.js`:

```javascript
module.exports = {
  ...require('./sessionService'),
  ...require('./transactionService'),
  ...require('./videoQueueService'),
  ...require('./bluetoothService'),
  ...require('./audioRoutingService'),
  ...require('./lightingService'),
  ...require('./offlineQueueService'),
};
```

**Step 5: Migrate one test file to use the factory (pilot)**

Pick `backend/tests/unit/websocket/broadcasts.test.js` as the pilot. Replace inline mock construction with factory imports:

```javascript
const { createMockSessionService, createMockTransactionService, createMockVideoQueueService, createMockOfflineQueueService } = require('../../helpers/mocks');

// In beforeEach:
mockSessionService = createMockSessionService();
mockTransactionService = createMockTransactionService();
// ... etc
```

**Step 6: Run tests to verify**

```bash
cd backend
npm run test:unit -- tests/unit/websocket/broadcasts.test.js
```

Expected: PASS

**Step 7: Commit**

```bash
git add backend/tests/helpers/mocks/
git commit -m "feat: add shared mock factories for backend services"
```

**Note:** Migrating all existing test files to use factories is NOT part of this task. Factories are available for new tests and gradual migration.

---

### Task 4b: Phase 1 documentation updates

**Scope:** Update CLAUDE.md files to reflect Phase 1 changes so later phases have accurate context.

**Files:**
- Modify: `backend/CLAUDE.md` — update Testing section: document `coverage:ratchet` and `coverage:check` commands, note functional layer merged into integration, document shared mock factories in `tests/helpers/mocks/`
- Modify: `CLAUDE.md` (root) — update test baselines if counts changed from functional merge

**Step 1: Update backend CLAUDE.md**

In the Key Commands / Testing section, add:
```markdown
npm run coverage:ratchet    # Regenerate per-file coverage thresholds
npm run coverage:check      # Verify no file regressed below threshold
```

Document the mock factory pattern in the Architecture or Testing section:
```markdown
### Shared Mock Factories
Shared mock factories in `tests/helpers/mocks/` provide canonical mock shapes for each service.
Use `createMockSessionService()`, `createMockTransactionService()`, etc. for new tests.
Each factory extends EventEmitter and stubs all public methods with jest.fn().
```

Note the functional layer removal (update any references to 5 test layers → 4).

**Step 2: Update root CLAUDE.md test baselines if needed**

**Step 3: Commit**

```bash
git add CLAUDE.md backend/CLAUDE.md
git commit -m "docs: update CLAUDE.md for Phase 1 changes (coverage ratchet, mock factories, functional merge)"
```

### Phase 1 Completion Checklist

After all tasks (1-4b):
1. Run full verification:
   ```bash
   cd backend && npm test && npm run test:integration
   cd ../ALNScanner && npm test
   ```
2. Run code review via `superpowers:requesting-code-review`
3. Investigate ALL findings — fix before proceeding
4. Commit any fixes
5. Push ALNScanner submodule, verify CI passes

---

## Phase 2: Scanner Testing Infrastructure (detail in next planning session)

> **Before starting:** Use `superpowers:writing-plans` to expand this phase into full step-by-step detail.

### Task 5: Install PlatformIO and set up ESP32 project

**Scope:** Install PlatformIO on Pi. Create `platformio.ini` for native test environment. Create Arduino mock headers (`Arduino.h`, `WString.h` with full String class implementation, `Arduino.cpp`). Create mock `config.h` with `limits` and `paths` namespaces matching `ALNScanner_v5/config.h`. Smoke test that compiles and runs.

**Files:**
- Create: `arduino-cyd-player-scanner/platformio.ini`
- Create: `arduino-cyd-player-scanner/mock/Arduino.h`
- Create: `arduino-cyd-player-scanner/mock/Arduino.cpp`
- Create: `arduino-cyd-player-scanner/mock/WString.h` (full implementation: `length()`, `startsWith()`, `replace()`, `trim()`, `toLowerCase()`, `charAt()`, `c_str()`, operators)
- Create: `arduino-cyd-player-scanner/mock/config.h` (mirror `limits` and `paths` namespaces from `ALNScanner_v5/config.h`)
- Create: `arduino-cyd-player-scanner/test/test_smoke/test_smoke.cpp`

**Key gotcha:** All ESP32 source is header-only `.h` files that `#include "../config.h"` and `<Arduino.h>`. The mock directory must provide stubs for ALL transitive includes that the pure logic headers pull in.

### Task 6: ESP32 pure logic unit tests

**Scope:** Write unit tests for `models/Config.h` `validate()`, `models/Token.h` `cleanTokenId()`, queue JSONL serialization, and HTTP payload construction. Requires ArduinoJson mock for queue/payload tests.

**CRITICAL namespace:** The actual code uses `namespace models` — classes are `models::DeviceConfig` and `models::TokenMetadata` (not `Token`). The `cleanTokenId()` static method is on `models::TokenMetadata::cleanTokenId()`.

**Files:**
- Create: `arduino-cyd-player-scanner/test/test_config/test_config.cpp`
- Create: `arduino-cyd-player-scanner/test/test_token/test_token.cpp`
- Create: `arduino-cyd-player-scanner/test/test_queue/test_queue.cpp` (needs ArduinoJson mock)
- Create: `arduino-cyd-player-scanner/test/test_payload/test_payload.cpp` (needs ArduinoJson mock)
- Create: `arduino-cyd-player-scanner/mock/ArduinoJson.h` (minimal mock for JSON construction)

### Task 7: PWA scanner logic extraction

**Scope:** Extract `normalizeTokenId()` from `MemoryScanner` class (`index.html:477-493`) into `js/scannerCore.js`. **This is an intentional behavior enhancement:** the original throws TypeError on null input; the extracted version returns clean error objects. Also extract `isStandaloneMode()`. Update `index.html` to delegate to extracted module.

**Refactoring note:** The original `normalizeTokenId()` calls `this.showError()` and `navigator.vibrate()` (DOM side effects). The extracted version must return `{ error: string }` instead, with the caller in `index.html` handling the DOM side effects.

**Files:**
- Create: `aln-memory-scanner/js/scannerCore.js`
- Modify: `aln-memory-scanner/index.html` (delegate to extracted module)

### Task 8: PWA scanner unit tests

**Scope:** Initialize Jest test infrastructure for aln-memory-scanner. Write unit tests for `scannerCore.js` and `orchestratorIntegration.js`.

**Files:**
- Create: `aln-memory-scanner/package.json`
- Create: `aln-memory-scanner/jest.config.js`
- Create: `aln-memory-scanner/tests/scannerCore.test.js`
- Create: `aln-memory-scanner/tests/orchestratorIntegration.test.js`

---

### Task 8b: Phase 2 documentation updates

**Scope:** Update CLAUDE.md files to reflect Phase 2 changes.

**Files:**
- Modify: `arduino-cyd-player-scanner/CLAUDE.md` — document PlatformIO native testing, `pio test -e native` command, mock directory purpose, what is/isn't tested
- Modify: `aln-memory-scanner/CLAUDE.md` — document `npm test` command, scannerCore.js extraction, jest config
- Modify: `CLAUDE.md` (root) — update test baselines for new scanner test counts, add ESP32 and PWA scanner to Key Commands section

---

## Phase 3: Contract and Coverage Hardening (detail in next planning session)

> **Before starting:** Use `superpowers:writing-plans` to expand this phase into full step-by-step detail.

### Task 9: Contract tests — scanners validate against openapi.yaml

**Scope:** Backend, ESP32, and PWA scanner all validate request/response formats against `backend/contracts/openapi.yaml`. Use existing `backend/tests/helpers/contract-validator.js` helper (handles `$ref` resolution) instead of standalone ajv. Scanner contract tests use monorepo-relative paths; only run in parent repo CI.

**Files:**
- Create: `backend/tests/contract/scanner/request-schema-validation.test.js`
- Create: `aln-memory-scanner/tests/contract-compliance.test.js`
- ESP32 contract test via extraction script (see design doc)

### Task 10: Backend scanner API gap tests

**Scope:** Add tests for: scan when session paused/ended/setup, malformed JSON, empty required fields, invalid deviceType, batch partial failures, rapid session state transitions. Use shared mock factories from Task 4.

### Task 11: Coverage ratchet enforcement in local test scripts

**Scope:** Update `test:all` and `test:ci` npm scripts to include `coverage:check`. Add `coverage:ratchet` to ALNScanner CI workflow.

### Task 12: Instrument RFIDReader.h for NDEF investigation

**Scope:** Add byte-level logging behind `NDEF_DEBUG` compile flag. Log raw MFRC522 bytes before NDEF parsing and parser decision path (NDEF text found vs UID hex fallback). This is investigative — captures data for Task 13.

### Task 13: NDEF byte-level regression tests

**Scope:** After capturing real byte sequences from Task 12 during game sessions, write them as test fixtures. Requires extracting NDEF parsing from `RFIDReader.h` into testable function. **Depends on real game session data from Task 12.**

---

### Task 13b: Phase 3 documentation updates

**Scope:** Update CLAUDE.md files to reflect Phase 3 changes.

**Files:**
- Modify: `backend/CLAUDE.md` — document contract test patterns, scanner API gap test coverage, coverage ratchet enforcement in `test:all`/`test:ci`
- Modify: `arduino-cyd-player-scanner/CLAUDE.md` — document NDEF_DEBUG flag, byte-level logging, NDEF test fixtures
- Modify: `CLAUDE.md` (root) — update Contract-First Architecture section with scanner contract validation pattern

---

## Phase 4: Test Quality and Organization (detail in next planning session)

> **Before starting:** Use `superpowers:writing-plans` to expand this phase into full step-by-step detail.

### Task 14: Backend unit tests for adminEvents.js

**Scope:** Test `gm:command` action routing in isolation. Priority actions to test first: `session:create`, `session:start`, `session:pause`, `system:reset` (highest-risk paths). Use shared mock factories.

### Task 15: Backend unit tests for broadcasts.js

**Scope:** Test listener registration, event forwarding, service:state debounce (50ms — requires `jest.useFakeTimers()` + `jest.advanceTimersByTime(51)`), and sync:full payload assembly.

### Task 16: Backend coverage gap tests

**Scope:** Add unit tests for `heartbeatMonitorService.js`, `models/teamScore.js`, `models/deviceConnection.js`, `models/videoQueueItem.js`.

### Task 17: ALNScanner test file reorganization

**Scope:** Consolidate 5 MonitoringDisplay test files (environment, phase1, phase2, phase3, showcontrol — there is no base file) into 1 organized by behavior. Split `adminModule.test.js` into `SessionManager.test.js` + `VideoController.test.js`. Consolidate 3 domEventBindings files (`-admin`, `-spotify`, `-safeAction`) into 1.

### Task 18: ALNScanner coverage gaps

**Scope:** Add tests for `DisplayController.js`, `CommandSender.js`, `AdminOperations.js`.

---

### Task 18b: Phase 4 documentation updates

**Scope:** Update CLAUDE.md files to reflect Phase 4 changes.

**Files:**
- Modify: `backend/CLAUDE.md` — document new unit tests for adminEvents.js, broadcasts.js, heartbeatMonitorService, models
- Modify: `ALNScanner/CLAUDE.md` — document test file reorganization (new file→test mapping), new coverage for DisplayController, CommandSender
- Modify: `CLAUDE.md` (root) — update test baselines

---

## Phase 5: CI and Documentation (detail in next planning session)

> **Before starting:** Use `superpowers:writing-plans` to expand this phase into full step-by-step detail.

### Task 19: Per-submodule CI workflows

**Scope:** Update ALNScanner CI (add coverage ratchet). Create new workflows for aln-memory-scanner, arduino-cyd-player-scanner (needs `platformio/run-platformio` GitHub Action), and ALN-TokenData. Unit tests only — no contract validation (monorepo paths unavailable in submodule CI).

### Task 20: Parent repo CI workflow

**Scope:** Create `.github/workflows/test.yml` at ALN-Ecosystem root. Jobs: backend unit+contract, backend integration, coverage ratchet check, contract drift check. Needs GitHub Actions YAML scaffold since no CI exists at root level.

### Task 21: CLAUDE.md verification checkpoint documentation

**Scope:** Add Verification Checkpoints section to root CLAUDE.md. Include ALNScanner dist rebuild requirement (`cd ALNScanner && npm run build` before backend E2E). Add references from `backend/CLAUDE.md` and `ALNScanner/CLAUDE.md`. This builds on the incremental CLAUDE.md updates from Phases 1-4 — those phases documented tools and patterns; this task adds the overarching verification workflow.

### Task 22: ESP32 hardware investigation

**Scope:** Diagnose unreliable scan detection and NDEF fallback bugs using instrumentation from Task 12. Investigative — outcomes feed back into test fixtures for Task 13.

---

## Final Verification

After all phases complete:

```bash
# Backend
cd backend
npm test                    # Unit + contract: all pass
npm run coverage:check      # Ratchet: no regressions
npm run test:integration    # Integration: all pass
cd ALNScanner && npm run build  # Rebuild dist for E2E
cd ../backend
npm run test:e2e            # E2E: all pass (workers=1)

# ALNScanner
cd ../ALNScanner
npm test                    # Unit: all pass, coverage thresholds met
npm run test:e2e            # E2E: all pass

# ESP32
cd ../arduino-cyd-player-scanner
pio test -e native          # PlatformIO: all pass

# PWA Scanner
cd ../aln-memory-scanner
npm test                    # Unit: all pass

# Config Tool
cd ../config-tool
npm test                    # Unit: all pass
```
