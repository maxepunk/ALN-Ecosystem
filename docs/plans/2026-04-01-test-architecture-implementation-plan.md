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

## Phase 2: Scanner Testing Infrastructure (fully detailed)

> **Expanded:** 2026-04-01 using `superpowers:writing-plans` skill.

**Context:** ESP32 scanner is the PRIMARY player interface. PWA scanner is the web fallback. Both are mission-critical but have ZERO test coverage. Phase 2 adds PlatformIO Unity tests for ESP32 pure logic and Jest tests for PWA scanner logic.

**Scope:** ESP32 tests cover the model layer (Config.h, Token.h) AND payload/queue serialization. The JSON construction in `OrchestratorService.h` is duplicated between `sendScan()` and `queueScan()` — Task 6b extracts it into a pure `PayloadBuilder.h` (DRY fix + testability) and uses real ArduinoJson (v7, works natively) in PlatformIO tests. HAL/service I/O (WiFi, SD, HTTP, FreeRTOS) remains untested — that requires deeper mocking deferred to a future phase.

---

### Task 5: Install PlatformIO and set up ESP32 project

**Files:**
- Create: `arduino-cyd-player-scanner/platformio.ini`
- Create: `arduino-cyd-player-scanner/mock/Arduino.h`
- Create: `arduino-cyd-player-scanner/test/test_smoke/test_smoke.cpp`

**Context:** All ESP32 source is header-only `.h` files in `ALNScanner_v5/`. They `#include <Arduino.h>` (Arduino String, Serial, isDigit) and `#include "../config.h"` (7 namespaces of constants). PlatformIO's `native` environment compiles for the host machine (Raspberry Pi 5 aarch64), not for ESP32. This lets us run pure C++ logic tests without real hardware.

**Key architecture:**
- `-I mock` makes `#include <Arduino.h>` resolve to our mock header
- `-I ALNScanner_v5` makes `#include "models/Config.h"` resolve correctly
- Relative includes like `#include "../config.h"` in model headers resolve to the real `ALNScanner_v5/config.h` (which works because it's pure `constexpr` constants + logging macros that our mock Serial handles)
- No mock config.h needed — the real one works with our Arduino.h mock

**Step 1: Install PlatformIO**

```bash
pip3 install platformio
```

Expected: PlatformIO installs successfully. Verify with `pio --version`.

**Step 2: Create platformio.ini**

Create `arduino-cyd-player-scanner/platformio.ini`:

```ini
; PlatformIO Configuration — Native Unit Testing
;
; This runs pure logic tests on the host machine (no ESP32 hardware needed).
; Tests cover: models/Config.h, models/Token.h (validation, tokenId cleaning, path construction)
;
; Usage: pio test -e native
;
; NOTE: Only the [env:native] environment is defined. The production ESP32 build
; continues to use arduino-cli (see CLAUDE.md). PlatformIO is used ONLY for testing.

[env:native]
platform = native
test_framework = unity
build_flags =
    -std=c++17
    -I mock
    -I ALNScanner_v5
    -DDEBUG_MODE
test_build_src = false
lib_deps =
    bblanchon/ArduinoJson@^7
```

**Why `lib_deps = bblanchon/ArduinoJson@^7`:** ArduinoJson is header-only and compiles natively on any platform. The production code uses ArduinoJson v7.4.2 (`JsonDocument`, `doc["key"].to<JsonArray>()`). Using the real library avoids the need for a mock and ensures serialization tests match production behavior exactly.

**Why `-DDEBUG_MODE`:** The real `config.h` defines `LOG_VERBOSE` and `LOG_DEBUG` as no-ops unless `DEBUG_MODE` is set. With it defined, these macros call `Serial.printf()` which is stubbed by our mock. Either way works for tests, but defining it ensures all code paths compile.

**Step 3: Create mock/Arduino.h**

Create `arduino-cyd-player-scanner/mock/Arduino.h`:

```cpp
#pragma once
/**
 * Arduino Mock for PlatformIO Native Testing
 *
 * Provides the subset of Arduino API used by ALNScanner_v5 model headers:
 * - String class (length, startsWith, replace, trim, toLowerCase, charAt, c_str, operators)
 * - SerialMock (print, println, printf — all no-ops)
 * - isDigit() function
 * - F() macro and __FlashStringHelper type
 * - Arduino type aliases (byte, uint8_t, etc.)
 *
 * NOTE: This does NOT mock hardware APIs (WiFi, SD, SPI, I2S, FreeRTOS).
 * Only models/ headers are testable with this mock. Testing services/ or hal/
 * requires additional mocks (future phase).
 */

#include <cstdint>
#include <cstring>
#include <cstdio>
#include <cctype>
#include <string>

// ─── Arduino type aliases ─────────────────────────────────────────────

typedef uint8_t byte;

// ─── Flash string helper (no-op on native) ────────────────────────────

class __FlashStringHelper;
#define F(string_literal) (reinterpret_cast<const __FlashStringHelper *>(string_literal))

// ─── Arduino String class ─────────────────────────────────────────────
// Wraps std::string. Implements the subset used by models/Config.h and
// models/Token.h. Method signatures match Arduino's String exactly:
// replace() is void (mutates in place), toLowerCase() is void, etc.

class String {
    std::string _buf;
public:
    String() {}
    String(const char* s) : _buf(s ? s : "") {}
    String(const String& s) = default;
    String(String&& s) = default;
    String(const __FlashStringHelper* f) : _buf(reinterpret_cast<const char*>(f)) {}

    // Assignment
    String& operator=(const char* s) { _buf = s ? s : ""; return *this; }
    String& operator=(const String&) = default;
    String& operator=(String&&) = default;

    // Length
    unsigned int length() const { return static_cast<unsigned int>(_buf.length()); }

    // Access
    const char* c_str() const { return _buf.c_str(); }
    char charAt(unsigned int i) const { return i < _buf.length() ? _buf[i] : 0; }
    char operator[](unsigned int i) const { return charAt(i); }

    // Search
    bool startsWith(const char* prefix) const {
        return _buf.compare(0, std::strlen(prefix), prefix) == 0;
    }
    bool startsWith(const String& prefix) const { return startsWith(prefix.c_str()); }

    // Mutation (Arduino String mutates in place, returns void)
    void replace(const char* from, const char* to) {
        std::string f(from), t(to);
        size_t pos = 0;
        while ((pos = _buf.find(f, pos)) != std::string::npos) {
            _buf.replace(pos, f.length(), t);
            pos += t.length();
        }
    }
    void replace(const String& from, const String& to) { replace(from.c_str(), to.c_str()); }

    void trim() {
        size_t start = _buf.find_first_not_of(" \t\r\n");
        size_t end = _buf.find_last_not_of(" \t\r\n");
        if (start == std::string::npos) { _buf.clear(); return; }
        _buf = _buf.substr(start, end - start + 1);
    }

    void toLowerCase() {
        for (auto& c : _buf) c = static_cast<char>(::tolower(static_cast<unsigned char>(c)));
    }

    // Concatenation
    String operator+(const char* s) const { String r(*this); r._buf += (s ? s : ""); return r; }
    String operator+(const String& s) const { String r(*this); r._buf += s._buf; return r; }
    String& operator+=(const char* s) { _buf += (s ? s : ""); return *this; }
    String& operator+=(const String& s) { _buf += s._buf; return *this; }

    // Comparison
    bool operator==(const char* s) const { return _buf == (s ? s : ""); }
    bool operator==(const String& s) const { return _buf == s._buf; }
    bool operator!=(const char* s) const { return !(*this == s); }
    bool operator!=(const String& s) const { return !(*this == s); }

    // Friend: "literal" + String
    friend String operator+(const char* lhs, const String& rhs) {
        String r(lhs); r._buf += rhs._buf; return r;
    }
};

// ─── Serial mock (all no-ops) ─────────────────────────────────────────

class SerialMock {
public:
    void begin(unsigned long) {}
    void print(const char*) {}
    void print(const __FlashStringHelper*) {}
    void print(int) {}
    void println() {}
    void println(const char*) {}
    void println(const __FlashStringHelper*) {}
    void println(int) {}
    // printf is variadic — use va_list to accept any args
    void printf(const char*, ...) {}
};

// C++17 inline variable — avoids multiple-definition errors across translation units
inline SerialMock Serial;

// ─── Arduino functions ────────────────────────────────────────────────

inline bool isDigit(char c) { return c >= '0' && c <= '9'; }
```

**Step 4: Create smoke test**

Create `arduino-cyd-player-scanner/test/test_smoke/test_smoke.cpp`:

```cpp
#include <unity.h>
#include <Arduino.h>

// Unity requires setUp/tearDown (even if empty)
void setUp(void) {}
void tearDown(void) {}

// Verify mock Arduino String works
void test_string_basic() {
    String s("Hello");
    TEST_ASSERT_EQUAL(5, s.length());
    TEST_ASSERT_EQUAL_STRING("Hello", s.c_str());
}

void test_string_replace() {
    String s("foo:bar:baz");
    s.replace(":", "");
    TEST_ASSERT_EQUAL_STRING("foobarbaz", s.c_str());
}

void test_string_toLowerCase() {
    String s("ABC123");
    s.toLowerCase();
    TEST_ASSERT_EQUAL_STRING("abc123", s.c_str());
}

void test_string_trim() {
    String s("  hello  ");
    s.trim();
    TEST_ASSERT_EQUAL_STRING("hello", s.c_str());
}

void test_string_startsWith() {
    String s("https://example.com");
    TEST_ASSERT_TRUE(s.startsWith("https://"));
    TEST_ASSERT_FALSE(s.startsWith("http://"));
}

void test_isDigit() {
    TEST_ASSERT_TRUE(isDigit('0'));
    TEST_ASSERT_TRUE(isDigit('9'));
    TEST_ASSERT_FALSE(isDigit('a'));
    TEST_ASSERT_FALSE(isDigit(' '));
}

// Verify real config.h compiles with our mock
#include "config.h"

void test_config_constants() {
    TEST_ASSERT_EQUAL(3, limits::TEAM_ID_LENGTH);
    TEST_ASSERT_EQUAL(32, limits::MAX_SSID_LENGTH);
    TEST_ASSERT_EQUAL_STRING("/assets/images/", paths::IMAGES_DIR);
    TEST_ASSERT_EQUAL_STRING("/assets/audio/", paths::AUDIO_DIR);
}

int main(int argc, char** argv) {
    UNITY_BEGIN();
    RUN_TEST(test_string_basic);
    RUN_TEST(test_string_replace);
    RUN_TEST(test_string_toLowerCase);
    RUN_TEST(test_string_trim);
    RUN_TEST(test_string_startsWith);
    RUN_TEST(test_isDigit);
    RUN_TEST(test_config_constants);
    return UNITY_END();
}
```

**Step 5: Run smoke test**

```bash
cd arduino-cyd-player-scanner
pio test -e native
```

Expected: All 7 tests PASS. First run downloads the native platform toolchain and ArduinoJson library — may take a few minutes.

**Step 6: Commit**

First, add PlatformIO build artifacts to `.gitignore`. In `arduino-cyd-player-scanner/.gitignore`, add:

```
# PlatformIO build artifacts
.pio/
```

Then commit:

```bash
cd arduino-cyd-player-scanner
git add .gitignore platformio.ini mock/Arduino.h test/test_smoke/test_smoke.cpp
git commit -m "feat: add PlatformIO native test infrastructure with Arduino mock"
```

Then update parent ref:
```bash
cd ..
git add arduino-cyd-player-scanner
git commit -m "chore: update arduino-cyd-player-scanner ref (PlatformIO test infra)"
```

---

### Task 6: ESP32 pure logic unit tests

**Files:**
- Create: `arduino-cyd-player-scanner/test/test_config/test_config.cpp`
- Create: `arduino-cyd-player-scanner/test/test_token/test_token.cpp`

**Context:** Tests cover the model layer (`models/Config.h`, `models/Token.h`). These headers contain validation logic, token ID normalization, path construction, and scan data validation — all pure logic that depends only on Arduino String + config.h constants.

**CRITICAL namespace:** All classes are in `namespace models` — use `models::DeviceConfig`, `models::TokenMetadata`, `models::ScanData`.

**Step 1: Write Config.h tests**

Create `arduino-cyd-player-scanner/test/test_config/test_config.cpp`:

```cpp
#include <unity.h>
#include <Arduino.h>
#include "models/Config.h"

// Unity requires setUp/tearDown (even if empty)
void setUp(void) {}
void tearDown(void) {}

// ─── DeviceConfig::validate() ─────────────────────────────────────────

void test_validate_valid_config() {
    models::DeviceConfig cfg;
    cfg.wifiSSID = "TestNetwork";
    cfg.wifiPassword = "password123";
    cfg.orchestratorURL = "https://10.0.0.177:3000";
    cfg.teamID = "001";
    cfg.deviceID = "SCANNER_001";

    TEST_ASSERT_TRUE(cfg.validate());
}

void test_validate_empty_ssid_fails() {
    models::DeviceConfig cfg;
    cfg.wifiSSID = "";
    cfg.orchestratorURL = "https://10.0.0.177:3000";
    cfg.teamID = "001";

    TEST_ASSERT_FALSE(cfg.validate());
}

void test_validate_ssid_too_long_fails() {
    models::DeviceConfig cfg;
    // MAX_SSID_LENGTH = 32, use std::string to avoid hand-counting
    cfg.wifiSSID = std::string(33, 'A').c_str();
    cfg.orchestratorURL = "https://10.0.0.177:3000";
    cfg.teamID = "001";

    TEST_ASSERT_FALSE(cfg.validate());
}

void test_validate_ssid_at_max_length_passes() {
    models::DeviceConfig cfg;
    cfg.wifiSSID = std::string(32, 'A').c_str(); // Exactly MAX_SSID_LENGTH
    cfg.orchestratorURL = "https://10.0.0.177:3000";
    cfg.teamID = "001";

    TEST_ASSERT_TRUE(cfg.validate());
}

void test_validate_password_too_long_fails() {
    models::DeviceConfig cfg;
    cfg.wifiSSID = "TestNetwork";
    // MAX_PASSWORD_LENGTH = 63, use std::string to avoid hand-counting
    cfg.wifiPassword = std::string(64, 'A').c_str();
    cfg.orchestratorURL = "https://10.0.0.177:3000";
    cfg.teamID = "001";

    TEST_ASSERT_FALSE(cfg.validate());
}

void test_validate_empty_password_passes() {
    // Password is optional (open networks exist)
    models::DeviceConfig cfg;
    cfg.wifiSSID = "OpenNetwork";
    cfg.wifiPassword = "";
    cfg.orchestratorURL = "https://10.0.0.177:3000";
    cfg.teamID = "001";

    TEST_ASSERT_TRUE(cfg.validate());
}

void test_validate_empty_url_fails() {
    models::DeviceConfig cfg;
    cfg.wifiSSID = "TestNetwork";
    cfg.orchestratorURL = "";
    cfg.teamID = "001";

    TEST_ASSERT_FALSE(cfg.validate());
}

void test_validate_url_no_protocol_fails() {
    models::DeviceConfig cfg;
    cfg.wifiSSID = "TestNetwork";
    cfg.orchestratorURL = "10.0.0.177:3000";
    cfg.teamID = "001";

    TEST_ASSERT_FALSE(cfg.validate());
}

void test_validate_url_https_passes() {
    models::DeviceConfig cfg;
    cfg.wifiSSID = "TestNetwork";
    cfg.orchestratorURL = "https://10.0.0.177:3000";
    cfg.teamID = "001";

    TEST_ASSERT_TRUE(cfg.validate());
}

void test_validate_url_http_auto_upgrades() {
    // validate() should mutate orchestratorURL from http:// to https://
    models::DeviceConfig cfg;
    cfg.wifiSSID = "TestNetwork";
    cfg.orchestratorURL = "http://10.0.0.177:3000";
    cfg.teamID = "001";

    TEST_ASSERT_TRUE(cfg.validate());
    TEST_ASSERT_EQUAL_STRING("https://10.0.0.177:3000", cfg.orchestratorURL.c_str());
}

void test_validate_teamid_exactly_3_digits() {
    models::DeviceConfig cfg;
    cfg.wifiSSID = "TestNetwork";
    cfg.orchestratorURL = "https://10.0.0.177:3000";
    cfg.teamID = "042";

    TEST_ASSERT_TRUE(cfg.validate());
}

void test_validate_teamid_too_short_fails() {
    models::DeviceConfig cfg;
    cfg.wifiSSID = "TestNetwork";
    cfg.orchestratorURL = "https://10.0.0.177:3000";
    cfg.teamID = "01";

    TEST_ASSERT_FALSE(cfg.validate());
}

void test_validate_teamid_too_long_fails() {
    models::DeviceConfig cfg;
    cfg.wifiSSID = "TestNetwork";
    cfg.orchestratorURL = "https://10.0.0.177:3000";
    cfg.teamID = "0001";

    TEST_ASSERT_FALSE(cfg.validate());
}

void test_validate_teamid_non_digit_fails() {
    models::DeviceConfig cfg;
    cfg.wifiSSID = "TestNetwork";
    cfg.orchestratorURL = "https://10.0.0.177:3000";
    cfg.teamID = "00a";

    TEST_ASSERT_FALSE(cfg.validate());
}

void test_validate_deviceid_optional() {
    models::DeviceConfig cfg;
    cfg.wifiSSID = "TestNetwork";
    cfg.orchestratorURL = "https://10.0.0.177:3000";
    cfg.teamID = "001";
    cfg.deviceID = ""; // Empty is OK (auto-generated from MAC)

    TEST_ASSERT_TRUE(cfg.validate());
}

void test_validate_deviceid_too_long_fails() {
    models::DeviceConfig cfg;
    cfg.wifiSSID = "TestNetwork";
    cfg.orchestratorURL = "https://10.0.0.177:3000";
    cfg.teamID = "001";
    // MAX_DEVICE_ID_LENGTH = 100, create 101-char ID
    std::string longId(101, 'X');
    cfg.deviceID = longId.c_str();

    TEST_ASSERT_FALSE(cfg.validate());
}

// ─── DeviceConfig::isComplete() ───────────────────────────────────────

void test_isComplete_with_all_required() {
    models::DeviceConfig cfg;
    cfg.wifiSSID = "TestNetwork";
    cfg.orchestratorURL = "https://10.0.0.177:3000";
    cfg.teamID = "001";

    TEST_ASSERT_TRUE(cfg.isComplete());
}

void test_isComplete_missing_ssid() {
    models::DeviceConfig cfg;
    cfg.orchestratorURL = "https://10.0.0.177:3000";
    cfg.teamID = "001";

    TEST_ASSERT_FALSE(cfg.isComplete());
}

void test_isComplete_missing_url() {
    models::DeviceConfig cfg;
    cfg.wifiSSID = "TestNetwork";
    cfg.teamID = "001";

    TEST_ASSERT_FALSE(cfg.isComplete());
}

void test_isComplete_missing_teamid() {
    models::DeviceConfig cfg;
    cfg.wifiSSID = "TestNetwork";
    cfg.orchestratorURL = "https://10.0.0.177:3000";

    TEST_ASSERT_FALSE(cfg.isComplete());
}

void test_isComplete_wrong_teamid_length() {
    models::DeviceConfig cfg;
    cfg.wifiSSID = "TestNetwork";
    cfg.orchestratorURL = "https://10.0.0.177:3000";
    cfg.teamID = "01"; // 2 chars, needs 3

    TEST_ASSERT_FALSE(cfg.isComplete());
}

// ─── Default values ───────────────────────────────────────────────────

void test_defaults() {
    models::DeviceConfig cfg;
    TEST_ASSERT_TRUE(cfg.syncTokens);
    TEST_ASSERT_FALSE(cfg.debugMode);
    TEST_ASSERT_EQUAL(0, cfg.wifiSSID.length());
    TEST_ASSERT_EQUAL(0, cfg.deviceID.length());
}

int main(int argc, char** argv) {
    UNITY_BEGIN();

    // validate()
    RUN_TEST(test_validate_valid_config);
    RUN_TEST(test_validate_empty_ssid_fails);
    RUN_TEST(test_validate_ssid_too_long_fails);
    RUN_TEST(test_validate_ssid_at_max_length_passes);
    RUN_TEST(test_validate_password_too_long_fails);
    RUN_TEST(test_validate_empty_password_passes);
    RUN_TEST(test_validate_empty_url_fails);
    RUN_TEST(test_validate_url_no_protocol_fails);
    RUN_TEST(test_validate_url_https_passes);
    RUN_TEST(test_validate_url_http_auto_upgrades);
    RUN_TEST(test_validate_teamid_exactly_3_digits);
    RUN_TEST(test_validate_teamid_too_short_fails);
    RUN_TEST(test_validate_teamid_too_long_fails);
    RUN_TEST(test_validate_teamid_non_digit_fails);
    RUN_TEST(test_validate_deviceid_optional);
    RUN_TEST(test_validate_deviceid_too_long_fails);

    // isComplete()
    RUN_TEST(test_isComplete_with_all_required);
    RUN_TEST(test_isComplete_missing_ssid);
    RUN_TEST(test_isComplete_missing_url);
    RUN_TEST(test_isComplete_missing_teamid);
    RUN_TEST(test_isComplete_wrong_teamid_length);

    // Defaults
    RUN_TEST(test_defaults);

    return UNITY_END();
}
```

**Step 2: Run Config.h tests**

```bash
cd arduino-cyd-player-scanner
pio test -e native -f test_config
```

Expected: 22 tests PASS.

**Step 3: Write Token.h tests**

Create `arduino-cyd-player-scanner/test/test_token/test_token.cpp`:

```cpp
#include <unity.h>
#include <Arduino.h>
#include "models/Token.h"

// Unity requires setUp/tearDown (even if empty)
void setUp(void) {}
void tearDown(void) {}

// ─── TokenMetadata::cleanTokenId() ────────────────────────────────────

void test_cleanTokenId_lowercase() {
    String result = models::TokenMetadata::cleanTokenId("KAA001");
    TEST_ASSERT_EQUAL_STRING("kaa001", result.c_str());
}

void test_cleanTokenId_removes_colons() {
    // UID hex format from RFID reader: "04:A1:B2:C3:D4:E5:F6"
    String result = models::TokenMetadata::cleanTokenId("04:A1:B2:C3");
    TEST_ASSERT_EQUAL_STRING("04a1b2c3", result.c_str());
}

void test_cleanTokenId_removes_spaces() {
    String result = models::TokenMetadata::cleanTokenId("kaa 001");
    TEST_ASSERT_EQUAL_STRING("kaa001", result.c_str());
}

void test_cleanTokenId_trims_whitespace() {
    String result = models::TokenMetadata::cleanTokenId("  kaa001  ");
    TEST_ASSERT_EQUAL_STRING("kaa001", result.c_str());
}

void test_cleanTokenId_combined() {
    // Real-world: UID with colons, spaces, mixed case, whitespace
    String result = models::TokenMetadata::cleanTokenId("  04:A1:B2 C3:D4  ");
    TEST_ASSERT_EQUAL_STRING("04a1b2c3d4", result.c_str());
}

void test_cleanTokenId_already_clean() {
    String result = models::TokenMetadata::cleanTokenId("kaa001");
    TEST_ASSERT_EQUAL_STRING("kaa001", result.c_str());
}

void test_cleanTokenId_empty_string() {
    String result = models::TokenMetadata::cleanTokenId("");
    TEST_ASSERT_EQUAL_STRING("", result.c_str());
}

// ─── TokenMetadata::isVideoToken() ────────────────────────────────────

void test_isVideoToken_with_video() {
    models::TokenMetadata token;
    token.video = "kaa001.mp4";
    TEST_ASSERT_TRUE(token.isVideoToken());
}

void test_isVideoToken_empty_string() {
    models::TokenMetadata token;
    token.video = "";
    TEST_ASSERT_FALSE(token.isVideoToken());
}

void test_isVideoToken_null_string() {
    // tokens.json has "video": null which maps to "null" string in ArduinoJson
    models::TokenMetadata token;
    token.video = "null";
    TEST_ASSERT_FALSE(token.isVideoToken());
}

void test_isVideoToken_default() {
    models::TokenMetadata token;
    // Default-constructed String is empty
    TEST_ASSERT_FALSE(token.isVideoToken());
}

// ─── TokenMetadata::getImagePath() / getAudioPath() ──────────────────

void test_getImagePath() {
    models::TokenMetadata token;
    token.tokenId = "kaa001";
    TEST_ASSERT_EQUAL_STRING("/assets/images/kaa001.bmp", token.getImagePath().c_str());
}

void test_getAudioPath() {
    models::TokenMetadata token;
    token.tokenId = "kaa001";
    TEST_ASSERT_EQUAL_STRING("/assets/audio/kaa001.wav", token.getAudioPath().c_str());
}

void test_getImagePath_cleans_id() {
    // Path construction uses cleanTokenId internally
    models::TokenMetadata token;
    token.tokenId = "04:A1:B2:C3";
    TEST_ASSERT_EQUAL_STRING("/assets/images/04a1b2c3.bmp", token.getImagePath().c_str());
}

void test_getAudioPath_cleans_id() {
    models::TokenMetadata token;
    token.tokenId = "KAA001";
    TEST_ASSERT_EQUAL_STRING("/assets/audio/kaa001.wav", token.getAudioPath().c_str());
}

// ─── ScanData ─────────────────────────────────────────────────────────

void test_scandata_default_deviceType() {
    models::ScanData scan;
    TEST_ASSERT_EQUAL_STRING("esp32", scan.deviceType.c_str());
}

void test_scandata_constructor() {
    models::ScanData scan("kaa001", "001", "SCANNER_001", "2026-04-01T12:00:00Z");
    TEST_ASSERT_EQUAL_STRING("kaa001", scan.tokenId.c_str());
    TEST_ASSERT_EQUAL_STRING("001", scan.teamId.c_str());
    TEST_ASSERT_EQUAL_STRING("SCANNER_001", scan.deviceId.c_str());
    TEST_ASSERT_EQUAL_STRING("esp32", scan.deviceType.c_str());
    TEST_ASSERT_EQUAL_STRING("2026-04-01T12:00:00Z", scan.timestamp.c_str());
}

void test_scandata_isValid_complete() {
    models::ScanData scan("kaa001", "", "SCANNER_001", "2026-04-01T12:00:00Z");
    TEST_ASSERT_TRUE(scan.isValid());
}

void test_scandata_isValid_no_teamid() {
    // teamId is optional
    models::ScanData scan;
    scan.tokenId = "kaa001";
    scan.deviceId = "SCANNER_001";
    scan.timestamp = "2026-04-01T12:00:00Z";
    TEST_ASSERT_TRUE(scan.isValid());
}

void test_scandata_isValid_missing_tokenId() {
    models::ScanData scan;
    scan.deviceId = "SCANNER_001";
    scan.timestamp = "2026-04-01T12:00:00Z";
    TEST_ASSERT_FALSE(scan.isValid());
}

void test_scandata_isValid_missing_deviceId() {
    models::ScanData scan;
    scan.tokenId = "kaa001";
    scan.timestamp = "2026-04-01T12:00:00Z";
    TEST_ASSERT_FALSE(scan.isValid());
}

void test_scandata_isValid_missing_timestamp() {
    models::ScanData scan;
    scan.tokenId = "kaa001";
    scan.deviceId = "SCANNER_001";
    TEST_ASSERT_FALSE(scan.isValid());
}

void test_scandata_isValid_missing_deviceType() {
    models::ScanData scan;
    scan.tokenId = "kaa001";
    scan.deviceId = "SCANNER_001";
    scan.timestamp = "2026-04-01T12:00:00Z";
    scan.deviceType = ""; // Override default
    TEST_ASSERT_FALSE(scan.isValid());
}

int main(int argc, char** argv) {
    UNITY_BEGIN();

    // cleanTokenId
    RUN_TEST(test_cleanTokenId_lowercase);
    RUN_TEST(test_cleanTokenId_removes_colons);
    RUN_TEST(test_cleanTokenId_removes_spaces);
    RUN_TEST(test_cleanTokenId_trims_whitespace);
    RUN_TEST(test_cleanTokenId_combined);
    RUN_TEST(test_cleanTokenId_already_clean);
    RUN_TEST(test_cleanTokenId_empty_string);

    // isVideoToken
    RUN_TEST(test_isVideoToken_with_video);
    RUN_TEST(test_isVideoToken_empty_string);
    RUN_TEST(test_isVideoToken_null_string);
    RUN_TEST(test_isVideoToken_default);

    // Path construction
    RUN_TEST(test_getImagePath);
    RUN_TEST(test_getAudioPath);
    RUN_TEST(test_getImagePath_cleans_id);
    RUN_TEST(test_getAudioPath_cleans_id);

    // ScanData
    RUN_TEST(test_scandata_default_deviceType);
    RUN_TEST(test_scandata_constructor);
    RUN_TEST(test_scandata_isValid_complete);
    RUN_TEST(test_scandata_isValid_no_teamid);
    RUN_TEST(test_scandata_isValid_missing_tokenId);
    RUN_TEST(test_scandata_isValid_missing_deviceId);
    RUN_TEST(test_scandata_isValid_missing_timestamp);
    RUN_TEST(test_scandata_isValid_missing_deviceType);

    return UNITY_END();
}
```

**Step 4: Run Token.h tests**

```bash
cd arduino-cyd-player-scanner
pio test -e native -f test_token
```

Expected: 23 tests PASS.

**Step 5: Run all tests together**

```bash
cd arduino-cyd-player-scanner
pio test -e native
```

Expected: 3 test suites (smoke, config, token), 52 total tests, all PASS. (Task 6b adds the 4th suite.)

**Step 6: Commit**

```bash
cd arduino-cyd-player-scanner
git add test/test_config/test_config.cpp test/test_token/test_token.cpp
git commit -m "test: add unit tests for Config.h validate/isComplete and Token.h cleanTokenId/ScanData"
```

Then update parent ref:
```bash
cd ..
git add arduino-cyd-player-scanner
git commit -m "chore: update arduino-cyd-player-scanner ref (model unit tests)"
```

---

### Task 6b: Extract payload builders and test with real ArduinoJson

**Files:**
- Create: `arduino-cyd-player-scanner/ALNScanner_v5/services/PayloadBuilder.h`
- Modify: `arduino-cyd-player-scanner/ALNScanner_v5/services/OrchestratorService.h` (call extracted functions)
- Create: `arduino-cyd-player-scanner/test/test_payload/test_payload.cpp`

**Context:** The JSON construction in `OrchestratorService.h` is duplicated — `sendScan()` (lines 182-190) and `queueScan()` (lines 255-263) build identical JSON. `uploadQueueBatch()` (lines 459-473) builds the batch payload. All three are interleaved with I/O (HTTP, SD, FreeRTOS), but the JSON construction itself is pure logic.

This task extracts the pure JSON construction into `PayloadBuilder.h`, eliminates the DRY violation, and tests it with real ArduinoJson (v7, works natively). The I/O-dependent code in OrchestratorService.h just calls the extracted functions.

**Why this matters:** Wrong payload format causes **silent scan loss** — the backend rejects the request and the player never knows. This is the worst failure mode for the game system. Config validation (Task 6) catches boot-time errors; payload tests catch runtime data loss.

**Step 1: Create PayloadBuilder.h**

Create `arduino-cyd-player-scanner/ALNScanner_v5/services/PayloadBuilder.h`:

```cpp
#pragma once

/**
 * @file PayloadBuilder.h
 * @brief Pure JSON construction functions for orchestrator communication.
 *
 * Extracted from OrchestratorService.h to eliminate duplication (sendScan and
 * queueScan had identical JSON construction) and enable native unit testing.
 *
 * These functions have NO I/O dependencies — only ArduinoJson + model types.
 * Tested in test/test_payload/ with real ArduinoJson on native platform.
 */

#include <Arduino.h>
#include <ArduinoJson.h>
#include <vector>
#include "../models/Token.h"
#include "../models/Config.h"

namespace services {

/**
 * Build JSON string for a single scan (POST /api/scan body and JSONL queue entry).
 * teamId is omitted when empty (matches backend contract: optional field, not null).
 */
inline String buildScanJson(const models::ScanData& scan) {
    JsonDocument doc;
    doc["tokenId"] = scan.tokenId;
    if (scan.teamId.length() > 0) doc["teamId"] = scan.teamId;
    doc["deviceId"] = scan.deviceId;
    doc["deviceType"] = scan.deviceType;
    doc["timestamp"] = scan.timestamp;

    String json;
    serializeJson(doc, json);
    return json;
}

/**
 * Parse a single JSONL queue line back into ScanData.
 * Returns true if parsing succeeded and all required fields are present.
 * Missing deviceType defaults to "esp32" (backward compat for pre-P2.3 queue entries).
 */
inline bool parseScanFromJsonl(const String& line, models::ScanData& scan) {
    JsonDocument doc;
    DeserializationError error = deserializeJson(doc, line);
    if (error != DeserializationError::Ok) return false;

    // Required fields
    if (!doc.containsKey("tokenId") || !doc.containsKey("deviceId") ||
        !doc.containsKey("timestamp")) {
        return false;
    }

    scan.tokenId = doc["tokenId"].as<String>();
    scan.teamId = doc.containsKey("teamId") ? doc["teamId"].as<String>() : "";
    scan.deviceId = doc["deviceId"].as<String>();
    scan.deviceType = doc.containsKey("deviceType") ? doc["deviceType"].as<String>() : "esp32";
    scan.timestamp = doc["timestamp"].as<String>();
    return true;
}

/**
 * Build JSON string for batch upload (POST /api/scan/batch body).
 * Each transaction in the array follows the same schema as single scan.
 */
inline String buildBatchJson(const String& batchId,
                             const std::vector<models::ScanData>& batch) {
    JsonDocument doc;
    doc["batchId"] = batchId;
    JsonArray transactions = doc["transactions"].to<JsonArray>();

    for (const auto& entry : batch) {
        JsonObject t = transactions.add<JsonObject>();
        t["tokenId"] = entry.tokenId;
        if (entry.teamId.length() > 0) t["teamId"] = entry.teamId;
        t["deviceId"] = entry.deviceId;
        t["deviceType"] = entry.deviceType;
        t["timestamp"] = entry.timestamp;
    }

    String json;
    serializeJson(doc, json);
    return json;
}

} // namespace services
```

**Step 2: Update OrchestratorService.h to use PayloadBuilder**

In `OrchestratorService.h`, add the include after the existing model includes (line ~34):

```cpp
#include "PayloadBuilder.h"
```

Replace the JSON construction in `sendScan()` (lines 182-190):

```cpp
        // Build JSON payload
        JsonDocument doc;
        doc["tokenId"] = scan.tokenId;
        if (scan.teamId.length() > 0) doc["teamId"] = scan.teamId;
        doc["deviceId"] = scan.deviceId;
        doc["deviceType"] = scan.deviceType;  // P2.3: Required by backend validators
        doc["timestamp"] = scan.timestamp;

        String requestBody;
        serializeJson(doc, requestBody);
```

With:

```cpp
        // Build JSON payload (extracted to PayloadBuilder.h for DRY + testability)
        String requestBody = services::buildScanJson(scan);
```

Replace the identical JSON construction in `queueScan()` (lines 255-263):

```cpp
        // Build JSONL entry
        JsonDocument doc;
        doc["tokenId"] = scan.tokenId;
        if (scan.teamId.length() > 0) doc["teamId"] = scan.teamId;
        doc["deviceId"] = scan.deviceId;
        doc["deviceType"] = scan.deviceType;  // P2.3: Required by backend validators
        doc["timestamp"] = scan.timestamp;

        String jsonLine;
        serializeJson(doc, jsonLine);
```

With:

```cpp
        // Build JSONL entry (extracted to PayloadBuilder.h for DRY + testability)
        String jsonLine = services::buildScanJson(scan);
```

Replace the batch JSON construction in `uploadQueueBatch()` (lines 459-473):

```cpp
        // Build batch request JSON
        JsonDocument doc;
        doc["batchId"] = batchId;
        JsonArray transactions = doc["transactions"].to<JsonArray>();

        for (const models::ScanData& entry : batch) {
            JsonObject transaction = transactions.add<JsonObject>();
            transaction["tokenId"] = entry.tokenId;
            if (entry.teamId.length() > 0) transaction["teamId"] = entry.teamId;
            transaction["deviceId"] = entry.deviceId;
            transaction["deviceType"] = entry.deviceType;  // P2.3: Required by backend validators
            transaction["timestamp"] = entry.timestamp;
        }

        String requestBody;
        serializeJson(doc, requestBody);
```

With:

```cpp
        // Build batch request JSON (extracted to PayloadBuilder.h for DRY + testability)
        String requestBody = services::buildBatchJson(batchId, batch);
```

Replace the parsing logic in `readQueue()` (lines 824-839):

```cpp
            JsonDocument doc;
            DeserializationError error = deserializeJson(doc, line);

            if (error == DeserializationError::Ok) {
                // Validate required fields (P2.3: deviceType now required)
                if (doc.containsKey("tokenId") && doc.containsKey("deviceId") &&
                    doc.containsKey("timestamp")) {

                    models::ScanData scan;
                    scan.tokenId = doc["tokenId"].as<String>();
                    scan.teamId = doc.containsKey("teamId") ? doc["teamId"].as<String>() : "";
                    scan.deviceId = doc["deviceId"].as<String>();
                    // P2.3: Read deviceType from queue (defaults to "esp32" if missing for backwards compat)
                    scan.deviceType = doc.containsKey("deviceType") ? doc["deviceType"].as<String>() : "esp32";
                    scan.timestamp = doc["timestamp"].as<String>();

                    batch.push_back(scan);
                    count++;
```

With:

```cpp
            models::ScanData scan;
            if (services::parseScanFromJsonl(line, scan)) {
                    batch.push_back(scan);
                    count++;
```

(Adjust the else/error branches to match the new structure.)

**Step 3: Verify Arduino CLI compilation still passes**

```bash
cd arduino-cyd-player-scanner/ALNScanner_v5
arduino-cli compile --fqbn esp32:esp32:esp32:PartitionScheme=no_ota,UploadSpeed=921600 .
```

Expected: Compiles successfully. This is a pure structural refactor — no behavior change.

**Step 4: Write payload tests**

Create `arduino-cyd-player-scanner/test/test_payload/test_payload.cpp`:

```cpp
#include <unity.h>
#include <Arduino.h>
#include <ArduinoJson.h>
#include "services/PayloadBuilder.h"

// Unity requires setUp/tearDown (even if empty)
void setUp(void) {}
void tearDown(void) {}

// ─── buildScanJson ────────────────────────────────────────────────────

void test_buildScanJson_contains_required_fields() {
    models::ScanData scan("kaa001", "001", "SCANNER_001", "2026-04-01T12:00:00Z");

    String json = services::buildScanJson(scan);
    JsonDocument doc;
    deserializeJson(doc, json);

    TEST_ASSERT_EQUAL_STRING("kaa001", doc["tokenId"].as<const char*>());
    TEST_ASSERT_EQUAL_STRING("001", doc["teamId"].as<const char*>());
    TEST_ASSERT_EQUAL_STRING("SCANNER_001", doc["deviceId"].as<const char*>());
    TEST_ASSERT_EQUAL_STRING("esp32", doc["deviceType"].as<const char*>());
    TEST_ASSERT_EQUAL_STRING("2026-04-01T12:00:00Z", doc["timestamp"].as<const char*>());
}

void test_buildScanJson_omits_empty_teamId() {
    models::ScanData scan;
    scan.tokenId = "kaa001";
    scan.teamId = ""; // Empty — should be omitted
    scan.deviceId = "SCANNER_001";
    scan.timestamp = "2026-04-01T12:00:00Z";

    String json = services::buildScanJson(scan);
    JsonDocument doc;
    deserializeJson(doc, json);

    TEST_ASSERT_FALSE(doc.containsKey("teamId"));
}

void test_buildScanJson_includes_nonempty_teamId() {
    models::ScanData scan("kaa001", "TeamAlpha", "SCANNER_001", "2026-04-01T12:00:00Z");

    String json = services::buildScanJson(scan);
    JsonDocument doc;
    deserializeJson(doc, json);

    TEST_ASSERT_TRUE(doc.containsKey("teamId"));
    TEST_ASSERT_EQUAL_STRING("TeamAlpha", doc["teamId"].as<const char*>());
}

void test_buildScanJson_deviceType_always_esp32() {
    models::ScanData scan;
    scan.tokenId = "test";
    scan.deviceId = "dev";
    scan.timestamp = "ts";
    // deviceType defaults to "esp32" in ScanData constructor

    String json = services::buildScanJson(scan);
    JsonDocument doc;
    deserializeJson(doc, json);

    TEST_ASSERT_EQUAL_STRING("esp32", doc["deviceType"].as<const char*>());
}

// ─── parseScanFromJsonl (round-trip) ──────────────────────────────────

void test_roundtrip_serialize_then_parse() {
    models::ScanData original("kaa001", "001", "SCANNER_001", "2026-04-01T12:00:00Z");

    String json = services::buildScanJson(original);

    models::ScanData parsed;
    bool ok = services::parseScanFromJsonl(json, parsed);

    TEST_ASSERT_TRUE(ok);
    TEST_ASSERT_EQUAL_STRING(original.tokenId.c_str(), parsed.tokenId.c_str());
    TEST_ASSERT_EQUAL_STRING(original.teamId.c_str(), parsed.teamId.c_str());
    TEST_ASSERT_EQUAL_STRING(original.deviceId.c_str(), parsed.deviceId.c_str());
    TEST_ASSERT_EQUAL_STRING(original.deviceType.c_str(), parsed.deviceType.c_str());
    TEST_ASSERT_EQUAL_STRING(original.timestamp.c_str(), parsed.timestamp.c_str());
}

void test_roundtrip_empty_teamId() {
    models::ScanData original;
    original.tokenId = "kaa001";
    original.teamId = "";
    original.deviceId = "SCANNER_001";
    original.timestamp = "2026-04-01T12:00:00Z";

    String json = services::buildScanJson(original);

    models::ScanData parsed;
    bool ok = services::parseScanFromJsonl(json, parsed);

    TEST_ASSERT_TRUE(ok);
    TEST_ASSERT_EQUAL_STRING("", parsed.teamId.c_str());
}

void test_parse_rejects_corrupt_json() {
    models::ScanData scan;
    TEST_ASSERT_FALSE(services::parseScanFromJsonl("not json at all", scan));
}

void test_parse_rejects_missing_tokenId() {
    models::ScanData scan;
    TEST_ASSERT_FALSE(services::parseScanFromJsonl(
        "{\"deviceId\":\"dev\",\"timestamp\":\"ts\"}", scan));
}

void test_parse_rejects_missing_deviceId() {
    models::ScanData scan;
    TEST_ASSERT_FALSE(services::parseScanFromJsonl(
        "{\"tokenId\":\"tok\",\"timestamp\":\"ts\"}", scan));
}

void test_parse_rejects_missing_timestamp() {
    models::ScanData scan;
    TEST_ASSERT_FALSE(services::parseScanFromJsonl(
        "{\"tokenId\":\"tok\",\"deviceId\":\"dev\"}", scan));
}

void test_parse_defaults_deviceType_for_legacy_entries() {
    // Pre-P2.3 queue entries don't have deviceType
    models::ScanData scan;
    bool ok = services::parseScanFromJsonl(
        "{\"tokenId\":\"tok\",\"deviceId\":\"dev\",\"timestamp\":\"ts\"}", scan);

    TEST_ASSERT_TRUE(ok);
    TEST_ASSERT_EQUAL_STRING("esp32", scan.deviceType.c_str());
}

void test_parse_reads_explicit_deviceType() {
    models::ScanData scan;
    bool ok = services::parseScanFromJsonl(
        "{\"tokenId\":\"tok\",\"deviceId\":\"dev\",\"deviceType\":\"custom\",\"timestamp\":\"ts\"}", scan);

    TEST_ASSERT_TRUE(ok);
    TEST_ASSERT_EQUAL_STRING("custom", scan.deviceType.c_str());
}

void test_parse_rejects_empty_string() {
    models::ScanData scan;
    TEST_ASSERT_FALSE(services::parseScanFromJsonl("", scan));
}

// ─── buildBatchJson ───────────────────────────────────────────────────

void test_buildBatchJson_structure() {
    std::vector<models::ScanData> batch;
    batch.push_back(models::ScanData("tok1", "001", "dev1", "ts1"));
    batch.push_back(models::ScanData("tok2", "", "dev2", "ts2"));

    String json = services::buildBatchJson("SCANNER_001_0", batch);
    JsonDocument doc;
    deserializeJson(doc, json);

    TEST_ASSERT_EQUAL_STRING("SCANNER_001_0", doc["batchId"].as<const char*>());
    TEST_ASSERT_TRUE(doc["transactions"].is<JsonArray>());
    TEST_ASSERT_EQUAL(2, doc["transactions"].as<JsonArray>().size());
}

void test_buildBatchJson_transaction_fields() {
    std::vector<models::ScanData> batch;
    batch.push_back(models::ScanData("kaa001", "TeamA", "SCANNER_001", "2026-04-01T12:00:00Z"));

    String json = services::buildBatchJson("batch_1", batch);
    JsonDocument doc;
    deserializeJson(doc, json);

    JsonObject t = doc["transactions"][0];
    TEST_ASSERT_EQUAL_STRING("kaa001", t["tokenId"].as<const char*>());
    TEST_ASSERT_EQUAL_STRING("TeamA", t["teamId"].as<const char*>());
    TEST_ASSERT_EQUAL_STRING("SCANNER_001", t["deviceId"].as<const char*>());
    TEST_ASSERT_EQUAL_STRING("esp32", t["deviceType"].as<const char*>());
    TEST_ASSERT_EQUAL_STRING("2026-04-01T12:00:00Z", t["timestamp"].as<const char*>());
}

void test_buildBatchJson_omits_empty_teamId_in_transactions() {
    std::vector<models::ScanData> batch;
    models::ScanData scan;
    scan.tokenId = "tok";
    scan.teamId = "";
    scan.deviceId = "dev";
    scan.timestamp = "ts";
    batch.push_back(scan);

    String json = services::buildBatchJson("batch_1", batch);
    JsonDocument doc;
    deserializeJson(doc, json);

    JsonObject t = doc["transactions"][0];
    TEST_ASSERT_FALSE(t.containsKey("teamId"));
}

void test_buildBatchJson_empty_batch() {
    std::vector<models::ScanData> batch;

    String json = services::buildBatchJson("batch_1", batch);
    JsonDocument doc;
    deserializeJson(doc, json);

    TEST_ASSERT_EQUAL_STRING("batch_1", doc["batchId"].as<const char*>());
    TEST_ASSERT_EQUAL(0, doc["transactions"].as<JsonArray>().size());
}

int main(int argc, char** argv) {
    UNITY_BEGIN();

    // buildScanJson
    RUN_TEST(test_buildScanJson_contains_required_fields);
    RUN_TEST(test_buildScanJson_omits_empty_teamId);
    RUN_TEST(test_buildScanJson_includes_nonempty_teamId);
    RUN_TEST(test_buildScanJson_deviceType_always_esp32);

    // Round-trip (serialize → parse)
    RUN_TEST(test_roundtrip_serialize_then_parse);
    RUN_TEST(test_roundtrip_empty_teamId);

    // parseScanFromJsonl
    RUN_TEST(test_parse_rejects_corrupt_json);
    RUN_TEST(test_parse_rejects_missing_tokenId);
    RUN_TEST(test_parse_rejects_missing_deviceId);
    RUN_TEST(test_parse_rejects_missing_timestamp);
    RUN_TEST(test_parse_defaults_deviceType_for_legacy_entries);
    RUN_TEST(test_parse_reads_explicit_deviceType);
    RUN_TEST(test_parse_rejects_empty_string);

    // buildBatchJson
    RUN_TEST(test_buildBatchJson_structure);
    RUN_TEST(test_buildBatchJson_transaction_fields);
    RUN_TEST(test_buildBatchJson_omits_empty_teamId_in_transactions);
    RUN_TEST(test_buildBatchJson_empty_batch);

    return UNITY_END();
}
```

**Step 5: Run payload tests**

```bash
cd arduino-cyd-player-scanner
pio test -e native -f test_payload
```

Expected: 17 tests PASS.

**Step 6: Run all ESP32 tests together**

```bash
cd arduino-cyd-player-scanner
pio test -e native
```

Expected: 4 test suites (smoke, config, token, payload), 69 total tests, all PASS.

**Step 7: Commit**

```bash
cd arduino-cyd-player-scanner
git add ALNScanner_v5/services/PayloadBuilder.h ALNScanner_v5/services/OrchestratorService.h test/test_payload/test_payload.cpp
git commit -m "refactor: extract PayloadBuilder.h from OrchestratorService (DRY + testability)

Extracts JSON construction for scan payloads, queue entries, and batch uploads
into pure functions in PayloadBuilder.h. Eliminates duplication between sendScan()
and queueScan(). Adds round-trip serialization tests with real ArduinoJson."
```

Then update parent ref:
```bash
cd ..
git add arduino-cyd-player-scanner
git commit -m "chore: update arduino-cyd-player-scanner ref (PayloadBuilder extraction + tests)"
```

---

### Task 7: PWA scanner logic extraction

**Files:**
- Create: `aln-memory-scanner/js/scannerCore.js`
- Modify: `aln-memory-scanner/index.html` (delegate to extracted module, add script tag)

**Context:** The `MemoryScanner` class in `index.html` has a `normalizeTokenId()` method (lines 477-493) that contains pure logic mixed with DOM side effects (`this.showError()`, `navigator.vibrate()`). We extract the pure logic into `js/scannerCore.js` with a clean return-value API, then update `index.html` to delegate and handle side effects.

**Behavior change:** The original `normalizeTokenId(null)` crashes with TypeError (calling `.toLowerCase()` on null). The extracted version handles null input cleanly by returning `{ error: '...' }`.

**Dual-environment export:** Like `orchestratorIntegration.js` (line 329-331), the new file works in both browser (`window.scannerCore`) and Node.js/Jest (`module.exports`).

**Step 1: Create js/scannerCore.js**

Create `aln-memory-scanner/js/scannerCore.js`:

```javascript
/**
 * Scanner Core — Pure logic extracted from MemoryScanner class.
 * No DOM dependencies. Returns result objects instead of calling UI methods.
 *
 * Browser: available as window.scannerCore
 * Node.js/Jest: available via require('./js/scannerCore')
 */
const scannerCore = {
  /**
   * Normalize and validate a token ID.
   * @param {string} rawId - Raw token ID from QR/NFC/manual entry
   * @returns {{ tokenId: string } | { error: string }} - Normalized ID or error
   */
  normalizeTokenId(rawId) {
    if (!rawId || typeof rawId !== 'string') {
      return { error: 'Invalid token: empty input' };
    }

    const tokenId = rawId.toLowerCase().replace(/[^a-z0-9_]/g, '');

    if (!tokenId) {
      return { error: 'Invalid token: ID contains only special characters' };
    }

    if (tokenId.length > 100) {
      return { error: `Invalid token: ID too long (${tokenId.length} characters, max 100)` };
    }

    return { tokenId };
  },

  /**
   * Detect standalone vs networked mode from URL pathname.
   * @param {string} pathname - window.location.pathname
   * @returns {boolean} - true if standalone (no orchestrator)
   */
  isStandaloneMode(pathname) {
    if (!pathname) return true;
    return !pathname.startsWith('/player-scanner/') && pathname !== '/player-scanner';
  }
};

// Browser: attach to window
if (typeof window !== 'undefined') {
  window.scannerCore = scannerCore;
}

// Node.js/Jest: CJS export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = scannerCore;
}
```

**Step 2: Add script tag to index.html**

In `aln-memory-scanner/index.html`, add the scannerCore.js script tag BEFORE the orchestratorIntegration.js script tag. Find line 811:

```html
    <!-- Orchestrator Integration -->
    <script src="js/orchestratorIntegration.js"></script>
```

Add BEFORE it:

```html
    <!-- Scanner Core (pure logic, no DOM deps) -->
    <script src="js/scannerCore.js"></script>

```

**Step 3: Update normalizeTokenId in MemoryScanner class**

In `aln-memory-scanner/index.html`, replace the existing `normalizeTokenId` method (lines 477-493):

```javascript
            normalizeTokenId(rawId) {
                const tokenId = rawId.toLowerCase().replace(/[^a-z0-9_]/g, '');

                if (!tokenId) {
                    this.showError('Invalid token: ID contains only special characters');
                    if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
                    return null;
                }

                if (tokenId.length > 100) {
                    this.showError(`Invalid token: ID too long (${tokenId.length} characters, max 100)`);
                    if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
                    return null;
                }

                return tokenId;
            }
```

With:

```javascript
            normalizeTokenId(rawId) {
                const result = window.scannerCore.normalizeTokenId(rawId);
                if (result.error) {
                    this.showError(result.error);
                    if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
                    return null;
                }
                return result.tokenId;
            }
```

**Step 4: Update service worker**

In `aln-memory-scanner/sw.js`:

1. **Bump CACHE_NAME** (line 3) from `'aln-scanner-v1.4'` to `'aln-scanner-v1.5'` — required for existing service workers to pick up the new file.

2. **Add scannerCore.js to APP_SHELL** — insert `'./js/scannerCore.js',` after `'./js/orchestratorIntegration.js',` (line 11):

```javascript
  './js/orchestratorIntegration.js',
  './js/scannerCore.js',
  // Modular CSS architecture
```

**Step 5: Verify manually**

Open `aln-memory-scanner/index.html` in a browser or via `python3 -m http.server 8000` and test:
1. Manual token entry works (normalizes correctly)
2. Empty input shows error
3. Special-character-only input shows error

**Step 6: Commit**

```bash
cd aln-memory-scanner
git add js/scannerCore.js index.html sw.js
git commit -m "refactor: extract normalizeTokenId and isStandaloneMode into js/scannerCore.js"
```

Then update parent ref:
```bash
cd ..
git add aln-memory-scanner
git commit -m "chore: update aln-memory-scanner ref (scannerCore.js extraction)"
```

---

### Task 8: PWA scanner unit tests

**Files:**
- Create: `aln-memory-scanner/package.json`
- Create: `aln-memory-scanner/jest.config.js`
- Create: `aln-memory-scanner/tests/scannerCore.test.js`
- Create: `aln-memory-scanner/tests/orchestratorIntegration.test.js`

**Context:** The PWA scanner has no build system (pure HTML/JS/CSS). We add Jest for testing ONLY — no Babel, no Webpack, no Vite. `orchestratorIntegration.js` already exports via CJS (line 329-331). `scannerCore.js` (from Task 7) also exports via CJS.

**Key testing challenges:**
- `OrchestratorIntegration` constructor has side effects (reads localStorage, starts connection monitor with fetch + setInterval)
- Must mock `window.location`, `localStorage`, `fetch`, `AbortSignal.timeout`, `CustomEvent`, `window.dispatchEvent` before requiring the module
- Use `jest.useFakeTimers()` to control setInterval
- Use `jest.resetModules()` to get fresh imports per test (constructor runs at require time)

**Step 1: Create package.json**

Create `aln-memory-scanner/package.json`:

```json
{
  "name": "aln-memory-scanner",
  "version": "1.0.0",
  "private": true,
  "description": "ALN Player Scanner PWA — unit tests only (no build system)",
  "scripts": {
    "test": "jest --verbose"
  },
  "devDependencies": {
    "jest": "^29.7.0",
    "jest-environment-jsdom": "^29.7.0"
  }
}
```

**Step 2: Create jest.config.js**

Create `aln-memory-scanner/jest.config.js`:

```javascript
module.exports = {
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.js'],
  clearMocks: true,
  resetMocks: false,  // We manage mocks manually (constructor side effects)
  restoreMocks: true,
  verbose: true,
};
```

**Step 3: Install dependencies**

```bash
cd aln-memory-scanner
npm install
```

**Step 4: Write scannerCore.test.js**

Create `aln-memory-scanner/tests/scannerCore.test.js`:

```javascript
const scannerCore = require('../js/scannerCore');

describe('scannerCore', () => {
  describe('normalizeTokenId', () => {
    test('normalizes valid token ID to lowercase', () => {
      expect(scannerCore.normalizeTokenId('KAA001')).toEqual({ tokenId: 'kaa001' });
    });

    test('strips non-alphanumeric characters except underscore', () => {
      expect(scannerCore.normalizeTokenId('04:A1:B2:C3')).toEqual({ tokenId: '04a1b2c3' });
    });

    test('preserves underscores', () => {
      expect(scannerCore.normalizeTokenId('test_001')).toEqual({ tokenId: 'test_001' });
    });

    test('handles already-clean input', () => {
      expect(scannerCore.normalizeTokenId('kaa001')).toEqual({ tokenId: 'kaa001' });
    });

    test('returns error for null input', () => {
      const result = scannerCore.normalizeTokenId(null);
      expect(result).toHaveProperty('error');
      expect(result.error).toContain('empty input');
    });

    test('returns error for undefined input', () => {
      const result = scannerCore.normalizeTokenId(undefined);
      expect(result).toHaveProperty('error');
    });

    test('returns error for empty string', () => {
      const result = scannerCore.normalizeTokenId('');
      expect(result).toHaveProperty('error');
      expect(result.error).toContain('empty input');
    });

    test('returns error for non-string input', () => {
      const result = scannerCore.normalizeTokenId(12345);
      expect(result).toHaveProperty('error');
    });

    test('returns error when only special characters', () => {
      const result = scannerCore.normalizeTokenId(':::---...');
      expect(result).toHaveProperty('error');
      expect(result.error).toContain('special characters');
    });

    test('returns error for ID exceeding 100 characters', () => {
      const longId = 'a'.repeat(101);
      const result = scannerCore.normalizeTokenId(longId);
      expect(result).toHaveProperty('error');
      expect(result.error).toContain('too long');
    });

    test('accepts ID at exactly 100 characters', () => {
      const maxId = 'a'.repeat(100);
      const result = scannerCore.normalizeTokenId(maxId);
      expect(result).toEqual({ tokenId: maxId });
    });

    test('strips spaces and special chars before length check', () => {
      // 90 alphanumeric + 20 colons = 110 raw, but 90 after strip
      const rawId = ('a:').repeat(45);
      const result = scannerCore.normalizeTokenId(rawId);
      expect(result).toHaveProperty('tokenId');
      expect(result.tokenId.length).toBe(45);
    });
  });

  describe('isStandaloneMode', () => {
    test('returns false for /player-scanner/ path (networked)', () => {
      expect(scannerCore.isStandaloneMode('/player-scanner/')).toBe(false);
    });

    test('returns false for /player-scanner path without trailing slash', () => {
      expect(scannerCore.isStandaloneMode('/player-scanner')).toBe(false);
    });

    test('returns false for /player-scanner/index.html', () => {
      expect(scannerCore.isStandaloneMode('/player-scanner/index.html')).toBe(false);
    });

    test('returns true for root path (standalone/GitHub Pages)', () => {
      expect(scannerCore.isStandaloneMode('/')).toBe(true);
    });

    test('returns true for GitHub Pages subpath', () => {
      expect(scannerCore.isStandaloneMode('/aln-memory-scanner/')).toBe(true);
    });

    test('returns true for empty pathname', () => {
      expect(scannerCore.isStandaloneMode('')).toBe(true);
    });

    test('returns true for null pathname', () => {
      expect(scannerCore.isStandaloneMode(null)).toBe(true);
    });

    test('returns true for undefined pathname', () => {
      expect(scannerCore.isStandaloneMode(undefined)).toBe(true);
    });
  });
});
```

**Step 5: Run scannerCore tests**

```bash
cd aln-memory-scanner
npx jest tests/scannerCore.test.js --verbose
```

Expected: All tests PASS.

**Step 6: Write orchestratorIntegration.test.js**

Create `aln-memory-scanner/tests/orchestratorIntegration.test.js`:

```javascript
/**
 * OrchestratorIntegration tests
 *
 * The class constructor has side effects: reads localStorage, detects mode from
 * window.location.pathname, and starts a connection monitor (fetch + setInterval)
 * in networked mode. All external APIs must be mocked BEFORE requiring the module.
 */

// Storage mock (shared across tests)
let mockStorage;
function setupStorageMock() {
  mockStorage = {};
  jest.spyOn(Storage.prototype, 'getItem').mockImplementation(key => mockStorage[key] ?? null);
  jest.spyOn(Storage.prototype, 'setItem').mockImplementation((key, val) => { mockStorage[key] = String(val); });
  jest.spyOn(Storage.prototype, 'removeItem').mockImplementation(key => { delete mockStorage[key]; });
}

// Construct an instance with controlled window.location and fetch
function createInstance(pathname, fetchImpl) {
  // Set location
  delete window.location;
  window.location = {
    pathname: pathname || '/',
    origin: 'https://example.com',
    search: '',
  };

  // Set fetch
  global.fetch = fetchImpl || jest.fn().mockRejectedValue(new Error('no network'));

  // AbortSignal.timeout may not exist in jsdom
  if (!AbortSignal.timeout) {
    AbortSignal.timeout = jest.fn().mockReturnValue(new AbortController().signal);
  }

  // Fresh require (constructor runs immediately)
  jest.resetModules();
  const OrchestratorIntegration = require('../js/orchestratorIntegration');
  return new OrchestratorIntegration();
}

describe('OrchestratorIntegration', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    setupStorageMock();
    // Suppress console.log/error during tests
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(async () => {
    jest.useRealTimers();
    jest.restoreAllMocks();
    delete global.fetch;
  });

  // ─── Mode Detection ───────────────────────────────────────────────

  describe('mode detection', () => {
    test('standalone mode when served from root', () => {
      const orch = createInstance('/');
      expect(orch.isStandalone).toBe(true);
    });

    test('standalone mode when served from GitHub Pages subpath', () => {
      const orch = createInstance('/aln-memory-scanner/');
      expect(orch.isStandalone).toBe(true);
    });

    test('networked mode when served from /player-scanner/', () => {
      const orch = createInstance('/player-scanner/');
      expect(orch.isStandalone).toBe(false);
    });

    test('networked mode when served from /player-scanner (no trailing slash)', () => {
      const orch = createInstance('/player-scanner');
      expect(orch.isStandalone).toBe(false);
    });

    test('standalone mode does not start connection monitor', () => {
      const orch = createInstance('/');
      expect(orch.connectionCheckInterval).toBeNull();
      expect(orch.pendingConnectionCheck).toBeUndefined();
    });

    test('networked mode starts connection monitor', () => {
      const orch = createInstance('/player-scanner/');
      expect(orch.connectionCheckInterval).not.toBeNull();
    });
  });

  // ─── URL Detection & Normalization ────────────────────────────────

  describe('URL handling', () => {
    test('detectOrchestratorUrl returns origin for networked mode', () => {
      const orch = createInstance('/player-scanner/');
      expect(orch.baseUrl).toBe('https://example.com');
    });

    test('detectOrchestratorUrl returns localhost for standalone', () => {
      const orch = createInstance('/');
      expect(orch.baseUrl).toBe('https://localhost:3000');
    });

    test('uses stored URL from localStorage if present', () => {
      mockStorage['orchestrator_url'] = 'https://custom:9000';
      const orch = createInstance('/player-scanner/');
      expect(orch.baseUrl).toBe('https://custom:9000');
    });

    test('normalizeUrl converts http to https', () => {
      const orch = createInstance('/');
      expect(orch.normalizeUrl('http://example.com')).toBe('https://example.com');
    });

    test('normalizeUrl preserves https', () => {
      const orch = createInstance('/');
      expect(orch.normalizeUrl('https://example.com')).toBe('https://example.com');
    });

    test('normalizeUrl handles null', () => {
      const orch = createInstance('/');
      expect(orch.normalizeUrl(null)).toBeNull();
    });

    test('normalizeUrl handles empty string', () => {
      const orch = createInstance('/');
      expect(orch.normalizeUrl('')).toBe('');
    });
  });

  // ─── Offline Queue ────────────────────────────────────────────────

  describe('offline queue', () => {
    test('queueOffline adds item to queue', () => {
      const orch = createInstance('/player-scanner/');
      orch.queueOffline('kaa001', 'TeamAlpha');
      expect(orch.offlineQueue).toHaveLength(1);
      expect(orch.offlineQueue[0].tokenId).toBe('kaa001');
      expect(orch.offlineQueue[0].teamId).toBe('TeamAlpha');
    });

    test('queueOffline enforces max queue size (removes oldest)', () => {
      const orch = createInstance('/player-scanner/');
      // Fill to max
      for (let i = 0; i < 100; i++) {
        orch.queueOffline(`token${i}`, 'team');
      }
      expect(orch.offlineQueue).toHaveLength(100);

      // Add one more — oldest removed
      orch.queueOffline('overflow', 'team');
      expect(orch.offlineQueue).toHaveLength(100);
      expect(orch.offlineQueue[0].tokenId).toBe('token1'); // token0 removed
      expect(orch.offlineQueue[99].tokenId).toBe('overflow');
    });

    test('queueOffline persists to localStorage', () => {
      const orch = createInstance('/player-scanner/');
      orch.queueOffline('kaa001', 'team');
      expect(mockStorage['offline_queue']).toBeDefined();
      const saved = JSON.parse(mockStorage['offline_queue']);
      expect(saved).toHaveLength(1);
      expect(saved[0].tokenId).toBe('kaa001');
    });

    test('loadQueue restores from localStorage', () => {
      mockStorage['offline_queue'] = JSON.stringify([
        { tokenId: 'saved1', teamId: 'team', timestamp: 123, retryCount: 0 },
        { tokenId: 'saved2', teamId: 'team', timestamp: 456, retryCount: 0 },
      ]);
      const orch = createInstance('/player-scanner/');
      expect(orch.offlineQueue).toHaveLength(2);
      expect(orch.offlineQueue[0].tokenId).toBe('saved1');
    });

    test('clearQueue empties queue and localStorage', () => {
      const orch = createInstance('/player-scanner/');
      orch.queueOffline('kaa001', 'team');
      orch.clearQueue();
      expect(orch.offlineQueue).toHaveLength(0);
      expect(JSON.parse(mockStorage['offline_queue'])).toHaveLength(0);
    });

    test('getQueueStatus returns current state', () => {
      const orch = createInstance('/player-scanner/');
      orch.queueOffline('kaa001', 'team');
      const status = orch.getQueueStatus();
      expect(status.queueSize).toBe(1);
      expect(status.maxQueueSize).toBe(100);
      expect(status.connected).toBe(false);
      expect(status.deviceId).toBeDefined();
    });
  });

  // ─── Scan Operations ──────────────────────────────────────────────

  describe('scanToken', () => {
    test('standalone mode returns standalone status (no network call)', async () => {
      const orch = createInstance('/');
      const result = await orch.scanToken('kaa001', 'team');
      expect(result.status).toBe('standalone');
      expect(global.fetch).not.toHaveBeenCalled();
    });

    test('networked mode queues when disconnected', async () => {
      const orch = createInstance('/player-scanner/');
      orch.connected = false;
      const result = await orch.scanToken('kaa001', 'team');
      expect(result.status).toBe('offline');
      expect(result.queued).toBe(true);
      expect(orch.offlineQueue).toHaveLength(1);
    });

    test('networked mode sends POST when connected', async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });
      const orch = createInstance('/player-scanner/', mockFetch);
      orch.connected = true;

      const result = await orch.scanToken('kaa001', 'TeamAlpha');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://example.com/api/scan',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        })
      );

      // Verify payload (calls[0] is the health check from the constructor,
      // calls[1] is the scan POST — find the POST call by URL to be robust)
      const scanCall = mockFetch.mock.calls.find(([url]) =>
        typeof url === 'string' && url.includes('/api/scan')
      );
      const body = JSON.parse(scanCall[1].body);
      expect(body.tokenId).toBe('kaa001');
      expect(body.teamId).toBe('TeamAlpha');
      expect(body.deviceType).toBe('player');
      expect(body.deviceId).toBeDefined();
      expect(body.timestamp).toBeDefined();
    });

    test('omits teamId from payload when falsy', async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });
      const orch = createInstance('/player-scanner/', mockFetch);
      orch.connected = true;

      await orch.scanToken('kaa001', '');

      const scanCall = mockFetch.mock.calls.find(([url]) =>
        typeof url === 'string' && url.includes('/api/scan')
      );
      const body = JSON.parse(scanCall[1].body);
      expect(body).not.toHaveProperty('teamId');
    });

    test('queues on network error', async () => {
      const mockFetch = jest.fn().mockRejectedValue(new Error('network error'));
      const orch = createInstance('/player-scanner/', mockFetch);
      orch.connected = true;

      const result = await orch.scanToken('kaa001', 'team');
      expect(result.status).toBe('error');
      expect(result.queued).toBe(true);
      expect(orch.offlineQueue).toHaveLength(1);
    });
  });

  // ─── Connection Monitoring ────────────────────────────────────────

  describe('connection monitoring', () => {
    test('checkConnection sets connected=true on 200', async () => {
      const mockFetch = jest.fn().mockResolvedValue({ ok: true });
      const orch = createInstance('/player-scanner/', mockFetch);

      const result = await orch.checkConnection();
      expect(result).toBe(true);
      expect(orch.connected).toBe(true);
    });

    test('checkConnection sets connected=false on error', async () => {
      const mockFetch = jest.fn().mockRejectedValue(new Error('timeout'));
      const orch = createInstance('/player-scanner/', mockFetch);

      const result = await orch.checkConnection();
      expect(result).toBe(false);
      expect(orch.connected).toBe(false);
    });

    test('checkConnection includes deviceId in health URL', async () => {
      const mockFetch = jest.fn().mockResolvedValue({ ok: true });
      const orch = createInstance('/player-scanner/', mockFetch);
      orch.deviceId = 'TEST_DEVICE';

      await orch.checkConnection();

      const calledUrl = mockFetch.mock.calls[mockFetch.mock.calls.length - 1][0].toString();
      expect(calledUrl).toContain('deviceId=TEST_DEVICE');
      expect(calledUrl).toContain('type=player');
    });

    test('emits orchestrator:connected on state transition', async () => {
      const mockFetch = jest.fn().mockResolvedValue({ ok: true });
      const orch = createInstance('/player-scanner/', mockFetch);
      orch.connected = false;

      const handler = jest.fn();
      window.addEventListener('orchestrator:connected', handler);
      try {
        await orch.checkConnection();
        expect(handler).toHaveBeenCalled();
      } finally {
        window.removeEventListener('orchestrator:connected', handler);
      }
    });

    test('emits orchestrator:disconnected on state transition', async () => {
      const mockFetch = jest.fn().mockRejectedValue(new Error('down'));
      const orch = createInstance('/player-scanner/', mockFetch);
      orch.connected = true; // Was connected

      const handler = jest.fn();
      window.addEventListener('orchestrator:disconnected', handler);
      try {
        await orch.checkConnection();
        expect(handler).toHaveBeenCalled();
      } finally {
        window.removeEventListener('orchestrator:disconnected', handler);
      }
    });

    test('stopConnectionMonitor clears interval', () => {
      const orch = createInstance('/player-scanner/');
      expect(orch.connectionCheckInterval).not.toBeNull();

      orch.stopConnectionMonitor();
      expect(orch.connectionCheckInterval).toBeNull();
    });
  });

  // ─── Batch ID Generation ──────────────────────────────────────────

  describe('generateBatchId', () => {
    test('returns UUID v4 format', () => {
      const orch = createInstance('/');
      const id = orch.generateBatchId();
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    });

    test('generates unique IDs', () => {
      const orch = createInstance('/');
      const ids = new Set(Array.from({ length: 100 }, () => orch.generateBatchId()));
      expect(ids.size).toBe(100);
    });
  });

  // ─── Cleanup ──────────────────────────────────────────────────────

  describe('destroy', () => {
    test('standalone mode destroy is no-op', async () => {
      const orch = createInstance('/');
      await orch.destroy(); // Should not throw
    });

    test('networked mode destroy stops monitor and awaits pending check', async () => {
      const mockFetch = jest.fn().mockResolvedValue({ ok: true });
      const orch = createInstance('/player-scanner/', mockFetch);
      expect(orch.connectionCheckInterval).not.toBeNull();

      await orch.destroy();
      expect(orch.connectionCheckInterval).toBeNull();
      expect(orch.pendingConnectionCheck).toBeNull();
    });
  });
});
```

**Step 7: Run orchestratorIntegration tests**

```bash
cd aln-memory-scanner
npx jest tests/orchestratorIntegration.test.js --verbose
```

Expected: All tests PASS.

**Step 8: Run all PWA scanner tests**

```bash
cd aln-memory-scanner
npm test
```

Expected: 2 test suites, all tests PASS.

**Step 9: Create .gitignore**

The PWA scanner has no root `.gitignore`. Create `aln-memory-scanner/.gitignore`:

```
node_modules/
package-lock.json
coverage/
```

**Step 10: Commit**

```bash
cd aln-memory-scanner
git add package.json jest.config.js tests/ .gitignore
git commit -m "test: add Jest infrastructure with scannerCore and orchestratorIntegration tests"
```

Then update parent ref:
```bash
cd ..
git add aln-memory-scanner
git commit -m "chore: update aln-memory-scanner ref (Jest test infrastructure)"
```

---

### Task 8b: Phase 2 documentation updates

**Files:**
- Modify: `arduino-cyd-player-scanner/CLAUDE.md`
- Modify: `aln-memory-scanner/CLAUDE.md`
- Modify: `CLAUDE.md` (root)

**Step 1: Update ESP32 CLAUDE.md**

In `arduino-cyd-player-scanner/CLAUDE.md`, add a Testing section after the Development Commands section:

```markdown
## Testing

### PlatformIO Native Tests

Unit tests run on the host machine (Pi 5) using PlatformIO's `native` platform. No ESP32 hardware needed.

```bash
pio test -e native              # Run all tests
pio test -e native -f test_config  # Run only config tests
pio test -e native -f test_token   # Run only token tests
```

**What's tested:**
- `models/Config.h`: `validate()` (SSID/password/URL/teamID validation, http→https auto-upgrade), `isComplete()`, default values
- `models/Token.h`: `cleanTokenId()` (colon/space removal, lowercase, trim), `isVideoToken()`, `getImagePath()`/`getAudioPath()` path construction, `ScanData` validation
- `services/PayloadBuilder.h`: `buildScanJson()` (single scan payload), `parseScanFromJsonl()` (queue deserialization), `buildBatchJson()` (batch upload payload), round-trip serialization

**What's NOT tested (requires future mock infrastructure):**
- `services/OrchestratorService.h`: HTTP calls, WiFi management, SD queue file I/O, FreeRTOS background task
- `hal/` layer: Hardware-dependent (RFID, display, audio, touch, SD card)
- `ui/` layer: Depends on hal/ and display hardware
- `services/ConfigService.h`: SD card file I/O (needs SD mock)

**Mock infrastructure:** `mock/Arduino.h` provides String class, Serial stubs, isDigit(), F() macro. The real `config.h` compiles as-is (pure constexpr constants).

**Adding new tests:** Create `test/test_<name>/test_<name>.cpp`, include `<unity.h>` and `<Arduino.h>`, use `TEST_ASSERT_*` macros.
```

**Step 2: Update PWA scanner CLAUDE.md**

In `aln-memory-scanner/CLAUDE.md`, add a Testing section (or update if one exists):

```markdown
## Testing

```bash
npm test                           # Run all Jest tests
npx jest tests/scannerCore.test.js # Run specific test file
```

**Test infrastructure:** Jest with jsdom environment. No build system required.

**Test files:**
- `tests/scannerCore.test.js` — normalizeTokenId() and isStandaloneMode() pure logic
- `tests/orchestratorIntegration.test.js` — mode detection, URL handling, offline queue, scan operations, connection monitoring

**Key patterns:**
- `orchestratorIntegration.js` constructor has side effects (localStorage read, setInterval) — tests use `jest.useFakeTimers()` and `jest.resetModules()` for isolation
- `window.location` mocked via property deletion + reassignment before each import
- `fetch` mocked globally before construction

### scannerCore.js

Extracted pure logic (no DOM dependencies) from `MemoryScanner` class:
- `normalizeTokenId(rawId)` — returns `{ tokenId }` or `{ error }` (no side effects)
- `isStandaloneMode(pathname)` — path-based mode detection

Works in both browser (`window.scannerCore`) and Node.js (`module.exports`). Index.html delegates to `window.scannerCore.normalizeTokenId()` and handles DOM side effects (showError, vibrate) locally.
```

**Step 3: Update root CLAUDE.md**

In the Key Commands section of `CLAUDE.md`, add ESP32 and PWA scanner test commands:

```markdown
**ESP32 Scanner:** See 'arduino-cyd-player-scanner/CLAUDE.md' for full command reference.
```bash
cd arduino-cyd-player-scanner
pio test -e native       # PlatformIO unit tests (models layer)
```

**Player Scanner (Web):** See 'aln-memory-scanner/CLAUDE.md' for full command reference.
```bash
cd aln-memory-scanner
npm test                 # Jest unit tests
```
```

**Step 4: Commit documentation in each submodule, then parent**

```bash
cd arduino-cyd-player-scanner
git add CLAUDE.md
git commit -m "docs: add PlatformIO testing section to CLAUDE.md"

cd ../aln-memory-scanner
git add CLAUDE.md
git commit -m "docs: add Jest testing and scannerCore.js documentation"

cd ..
git add CLAUDE.md arduino-cyd-player-scanner aln-memory-scanner
git commit -m "docs: update root CLAUDE.md with ESP32 and PWA scanner test commands"
```

---

### Phase 2 Completion Checklist

After all tasks (5, 6, 6b, 7, 8, 8b):
1. Run full verification:
   ```bash
   # ESP32 tests
   cd arduino-cyd-player-scanner && pio test -e native

   # PWA scanner tests
   cd ../aln-memory-scanner && npm test

   # Backend (verify nothing broke)
   cd ../backend && npm test && npm run test:integration

   # ALNScanner (verify nothing broke)
   cd ../ALNScanner && npm test
   ```
2. Run code review via `superpowers:requesting-code-review`
3. Investigate ALL findings — fix before proceeding
4. Commit any fixes
5. Push submodules (arduino-cyd-player-scanner, aln-memory-scanner), verify CI if applicable
6. Update parent submodule refs and push

---

## Phase 3: Contract and Coverage Hardening (fully detailed)

> **Expanded:** 2026-04-01 using `superpowers:writing-plans` skill.

**Context:** Phase 2 gave both scanners first-ever test coverage. Phase 3 closes the gap between scanner payload construction and backend API expectations via AJV schema validation, hardens backend edge cases, enforces coverage ratchet in CI, and prepares NDEF parser extraction for hardware investigation.

**Key insight:** The contract-validator.js helper only validates RESPONSE schemas (`getHTTPSchema` extracts from `responses[status]`). Task 9 adds REQUEST schema validation (`getHTTPRequestSchema` extracts from `requestBody`). The existing `player-scanner/http-request-compliance.test.js` does manual field checks — not AJV validation against the OpenAPI spec. Task 9 adds the AJV layer.

**ESP32 contract approach:** Rather than a C-header extraction script (complex, fragile), we use canonical JSON fixtures in the backend contract test suite that match PayloadBuilder's output format. If PayloadBuilder changes → C++ tests catch it. If OpenAPI spec changes → Node.js contract tests catch it. The two together ensure consistency across the language boundary.

---

### Task 9: Contract request schema validation

**Files:**
- Modify: `backend/tests/helpers/contract-validator.js` (add request schema extraction)
- Create: `backend/tests/contract/scanner/request-schema-validation.test.js`

**Context:** `contract-validator.js` currently exports `getHTTPSchema(path, method, status)` which extracts RESPONSE schemas from `openapi.yaml`. We need a companion function that extracts REQUEST body schemas for validating scanner payloads.

Existing `player-scanner/http-request-compliance.test.js` does manual field checks (`typeof request.body.tokenId === 'string'`). That's valuable but doesn't catch schema drift. Task 9 adds AJV-based validation that compiles the OpenAPI request schema and validates canonical payloads against it.

**Step 1: Add request schema extraction to contract-validator.js**

In `backend/tests/helpers/contract-validator.js`, add before the `module.exports` block (around line 110):

```javascript
/**
 * Extract REQUEST body schema from OpenAPI spec
 * @param {string} path - OpenAPI path (e.g., '/api/scan')
 * @param {string} method - HTTP method (e.g., 'post')
 * @returns {object} JSON Schema for the request body
 */
function getHTTPRequestSchema(path, method) {
  const pathSpec = openapi.paths[path];
  if (!pathSpec) throw new Error(`Path ${path} not found in OpenAPI spec`);

  const methodSpec = pathSpec[method.toLowerCase()];
  if (!methodSpec) throw new Error(`Method ${method} not found for ${path}`);

  const requestBody = methodSpec.requestBody;
  if (!requestBody) throw new Error(`No requestBody defined for ${method} ${path}`);

  return requestBody.content['application/json'].schema;
}

/**
 * Validate a request body against OpenAPI request schema
 * @param {object} body - Request body to validate
 * @param {string} path - OpenAPI path
 * @param {string} method - HTTP method
 * @returns {boolean} true if valid
 * @throws {Error} if validation fails with detailed errors
 */
function validateHTTPRequest(body, path, method) {
  const schema = getHTTPRequestSchema(path, method);
  const validate = ajv.compile(schema);
  const valid = validate(body);

  if (!valid) {
    throw new Error(
      `HTTP request validation failed for ${method.toUpperCase()} ${path}:\n` +
      JSON.stringify(validate.errors, null, 2)
    );
  }

  return true;
}
```

Update the `module.exports` to include the new functions:

```javascript
module.exports = {
  validateHTTPResponse,
  validateHTTPRequest,
  validateWebSocketEvent,
  getHTTPSchema,
  getHTTPRequestSchema,
  getWebSocketSchema
};
```

**Step 2: Run existing contract tests to verify no regression**

```bash
cd backend && npm run test:contract
```

Expected: All existing contract tests pass (no regression from adding new functions).

**Step 3: Create request schema validation tests**

Create `backend/tests/contract/scanner/request-schema-validation.test.js`:

```javascript
/**
 * Scanner Request Schema Validation
 *
 * Validates that scanner payloads (both ESP32 and PWA) conform to the
 * OpenAPI request body schema. Uses AJV compilation against the actual
 * openapi.yaml spec — catches schema drift that manual field checks miss.
 *
 * Canonical payloads match the output of:
 * - ESP32: PayloadBuilder.buildScanJson() / buildBatchJson()
 * - PWA: OrchestratorIntegration.scanToken() / processOfflineQueue()
 */

const { validateHTTPRequest, getHTTPRequestSchema } = require('../../helpers/contract-validator');

describe('Scanner Request Schema Validation', () => {

  describe('POST /api/scan — Single Scan Request', () => {

    test('ESP32 scan payload (all fields) passes schema validation', () => {
      // Matches PayloadBuilder.buildScanJson() output with teamId
      const payload = {
        tokenId: 'kaa001',
        teamId: '001',
        deviceId: 'SCANNER_001',
        deviceType: 'esp32',
        timestamp: '2026-04-01T12:00:00.000Z'
      };

      expect(() => validateHTTPRequest(payload, '/api/scan', 'post')).not.toThrow();
    });

    test('ESP32 scan payload (no teamId) passes schema validation', () => {
      // Matches PayloadBuilder.buildScanJson() output when teamId is empty
      const payload = {
        tokenId: 'kaa001',
        deviceId: 'SCANNER_001',
        deviceType: 'esp32',
        timestamp: '2026-04-01T12:00:00.000Z'
      };

      expect(() => validateHTTPRequest(payload, '/api/scan', 'post')).not.toThrow();
    });

    test('PWA player scan payload (all fields) passes schema validation', () => {
      // Matches OrchestratorIntegration.scanToken() output
      const payload = {
        tokenId: 'kaa001',
        teamId: 'Team Alpha',
        deviceId: 'PLAYER_1234567890',
        deviceType: 'player',
        timestamp: '2026-04-01T12:00:00.000Z'
      };

      expect(() => validateHTTPRequest(payload, '/api/scan', 'post')).not.toThrow();
    });

    test('PWA player scan payload (no teamId) passes schema validation', () => {
      const payload = {
        tokenId: 'test_001',
        deviceId: 'PLAYER_1234567890',
        deviceType: 'player',
        timestamp: '2026-04-01T12:00:00.000Z'
      };

      expect(() => validateHTTPRequest(payload, '/api/scan', 'post')).not.toThrow();
    });

    // --- Schema enforcement ---

    test('rejects missing tokenId', () => {
      const payload = {
        deviceId: 'dev',
        deviceType: 'player',
        timestamp: '2026-04-01T12:00:00.000Z'
      };

      expect(() => validateHTTPRequest(payload, '/api/scan', 'post')).toThrow(/tokenId/);
    });

    test('rejects missing deviceId', () => {
      const payload = {
        tokenId: 'tok',
        deviceType: 'player',
        timestamp: '2026-04-01T12:00:00.000Z'
      };

      expect(() => validateHTTPRequest(payload, '/api/scan', 'post')).toThrow(/deviceId/);
    });

    test('rejects missing deviceType', () => {
      const payload = {
        tokenId: 'tok',
        deviceId: 'dev',
        timestamp: '2026-04-01T12:00:00.000Z'
      };

      expect(() => validateHTTPRequest(payload, '/api/scan', 'post')).toThrow(/deviceType/);
    });

    test('rejects invalid deviceType enum value', () => {
      const payload = {
        tokenId: 'tok',
        deviceId: 'dev',
        deviceType: 'gm',  // Not in enum [player, esp32]
        timestamp: '2026-04-01T12:00:00.000Z'
      };

      expect(() => validateHTTPRequest(payload, '/api/scan', 'post')).toThrow();
    });

    test('rejects empty tokenId', () => {
      const payload = {
        tokenId: '',  // minLength: 1
        deviceId: 'dev',
        deviceType: 'player',
        timestamp: '2026-04-01T12:00:00.000Z'
      };

      expect(() => validateHTTPRequest(payload, '/api/scan', 'post')).toThrow();
    });

    test('request schema has expected required fields', () => {
      const schema = getHTTPRequestSchema('/api/scan', 'post');
      expect(schema.required).toEqual(
        expect.arrayContaining(['tokenId', 'deviceId', 'deviceType'])
      );
    });

    test('request schema allows player and esp32 deviceTypes', () => {
      const schema = getHTTPRequestSchema('/api/scan', 'post');
      expect(schema.properties.deviceType.enum).toEqual(['player', 'esp32']);
    });
  });

  describe('POST /api/scan/batch — Batch Request', () => {

    test('ESP32 batch payload passes schema validation', () => {
      // Matches PayloadBuilder.buildBatchJson() output
      const payload = {
        batchId: 'SCANNER_001_0',
        transactions: [
          {
            tokenId: 'kaa001',
            teamId: '001',
            deviceId: 'SCANNER_001',
            deviceType: 'esp32',
            timestamp: '2026-04-01T12:00:00.000Z'
          },
          {
            tokenId: 'jaw002',
            deviceId: 'SCANNER_001',
            deviceType: 'esp32',
            timestamp: '2026-04-01T12:01:00.000Z'
          }
        ]
      };

      expect(() => validateHTTPRequest(payload, '/api/scan/batch', 'post')).not.toThrow();
    });

    test('PWA batch payload passes schema validation', () => {
      // Matches OrchestratorIntegration.processOfflineQueue() output
      const payload = {
        batchId: 'a3f4b2c1-5678-90ab-cdef-1234567890ab',
        transactions: [
          {
            tokenId: 'token1',
            teamId: 'Team Alpha',
            deviceId: 'PLAYER_1234567890',
            deviceType: 'player',
            timestamp: '2026-04-01T12:00:00.000Z'
          }
        ]
      };

      expect(() => validateHTTPRequest(payload, '/api/scan/batch', 'post')).not.toThrow();
    });

    test('rejects missing batchId', () => {
      const payload = {
        transactions: [{ tokenId: 'tok', deviceId: 'dev', deviceType: 'player' }]
      };

      expect(() => validateHTTPRequest(payload, '/api/scan/batch', 'post')).toThrow(/batchId/);
    });

    test('rejects missing transactions', () => {
      const payload = { batchId: 'batch_1' };

      expect(() => validateHTTPRequest(payload, '/api/scan/batch', 'post')).toThrow(/transactions/);
    });

    test('rejects transaction missing required deviceType', () => {
      const payload = {
        batchId: 'batch_1',
        transactions: [{ tokenId: 'tok', deviceId: 'dev' }]
      };

      expect(() => validateHTTPRequest(payload, '/api/scan/batch', 'post')).toThrow();
    });

    test('accepts empty transactions array', () => {
      // Edge case: batch with no transactions (valid per schema, server may reject)
      const payload = {
        batchId: 'batch_1',
        transactions: []
      };

      expect(() => validateHTTPRequest(payload, '/api/scan/batch', 'post')).not.toThrow();
    });
  });
});
```

**Step 4: Run new tests**

```bash
cd backend && npx jest tests/contract/scanner/request-schema-validation.test.js --verbose
```

Expected: All tests PASS.

**Step 5: Run full contract suite**

```bash
cd backend && npm run test:contract
```

Expected: All contract tests pass including new scanner request validation.

**Step 6: Commit**

```bash
cd backend
git add tests/helpers/contract-validator.js tests/contract/scanner/request-schema-validation.test.js
git commit -m "feat: add AJV-based request schema validation for scanner payloads

Adds getHTTPRequestSchema() and validateHTTPRequest() to contract-validator.js.
New test suite validates ESP32 and PWA scanner payloads against the actual
OpenAPI requestBody schema — catches schema drift that manual field checks miss."
```

---

### Task 9b: Extend test fixtures to include real tokens from ALN-TokenData

**Files:**
- Modify: `backend/tests/fixtures/test-tokens.js`

**Context:** Integration tests currently use hand-crafted synthetic tokens (`rat001`, `asm001`, etc.). New tests in Task 10 need real production token IDs (`ale001`, `kai001`, etc.). Rather than maintaining two separate token universes, we extend the existing fixture to ALSO load real tokens from `ALN-TokenData/tokens.json` via `tokenService.loadTokens()`.

**Design:** The `getAllAsObject()` method returns the union of curated test tokens + real production tokens. Curated tokens take precedence (they have specific properties needed by existing tests like group-completion). The 81 real tokens are loaded alongside — giving new tests access to production token IDs without breaking any existing tests.

**Step 1: Read the current test-tokens.js**

Read `backend/tests/fixtures/test-tokens.js` to understand the `getAllAsObject()` method (around line 358). This is where real tokens will be added.

**Step 2: Modify getAllAsObject() to load real tokens**

In `backend/tests/fixtures/test-tokens.js`, modify the `getAllAsObject()` method. After all existing curated tokens are added (around line 388, after the null-scoring token), add:

```javascript
    // Load real tokens from ALN-TokenData (production database)
    // Curated tokens above take precedence for existing test expectations.
    // Real tokens provide production IDs (ale001, kai001, etc.) for new tests.
    try {
      const { loadTokens } = require('../../src/services/tokenService');
      const realTokens = loadTokens();
      for (const token of realTokens) {
        if (!tokens[token.id]) {
          tokens[token.id] = token;
        }
      }
    } catch (e) {
      // Graceful fallback — submodule may not be available in CI
      console.warn('test-tokens: could not load real tokens from ALN-TokenData:', e.message);
    }
```

**Step 3: Verify ALL existing integration tests still pass**

```bash
cd backend && npm run test:integration
```

Expected: 295/295 pass. Existing tests use curated token IDs which are still present — real tokens are additive only. If any test fails, it means a real token ID collides with a curated one (shouldn't happen since curated tokens take precedence).

**Step 4: Verify real tokens are accessible**

```bash
cd backend && node -e "
  const TestTokens = require('./tests/fixtures/test-tokens');
  const all = TestTokens.getAllAsObject();
  console.log('Total tokens:', Object.keys(all).length);
  console.log('Has ale001:', !!all['ale001']);
  console.log('Has kai001 (video):', !!all['kai001']);
  console.log('Has rat001 (curated):', !!all['rat001']);
  console.log('ale001 value:', all['ale001']?.value);
"
```

Expected: Total ~95+ tokens (14 curated + 81 real), all three lookups return true.

**Step 5: Run unit+contract tests too (verify no regression)**

```bash
cd backend && npm test
```

Expected: All pass.

**Step 6: Commit**

```bash
cd backend
git add tests/fixtures/test-tokens.js
git commit -m "feat: extend test fixtures to include real tokens from ALN-TokenData

getAllAsObject() now loads production tokens alongside curated test tokens.
Curated tokens take precedence (existing test expectations preserved).
Real tokens provide production IDs (ale001, kai001, etc.) for new tests.
Graceful fallback if ALN-TokenData submodule unavailable."
```

---

### Task 10: Backend scanner API edge case tests

**Files:**
- Create: `backend/tests/integration/scan-edge-cases.test.js`

**Context:** Tests scan API behavior under non-happy-path conditions. Uses the real integration test server with real tokens (loaded from ALN-TokenData via Task 9b).

**CRITICAL — Actual scan route behavior (from reading `scanRoutes.js`):**
- `POST /api/scan` does NOT check session status (setup/active/paused/ended) — if ANY session exists, player scans are accepted. This is by design: player scanners are "intel gathering" devices.
- No session → returns **409** (not 400) with `SESSION_NOT_FOUND`
- Unknown token → returns **404** with `TOKEN_NOT_FOUND`
- Joi validation failure (missing fields, invalid deviceType) → returns **400** with `VALIDATION_ERROR`
- Integration tests use `setupIntegrationTestServer()` / `cleanupIntegrationTestServer()` from `tests/helpers/integration-test-server.js`
- HTTP requests use native `fetch()` with `testContext.url`
- Service reset uses `resetAllServicesForTesting(io, services)` from `tests/helpers/service-reset.js`

**Step 1: Read existing integration test patterns**

Read `backend/tests/integration/transaction-flow.test.js` (lines 1-55) for the correct beforeAll/afterAll/beforeEach pattern. Key imports:
- `{ setupIntegrationTestServer, cleanupIntegrationTestServer }` from `../helpers/integration-test-server`
- `{ resetAllServicesForTesting }` from `../helpers/service-reset`
- Direct service requires for `sessionService`, `transactionService`, `videoQueueService`, `offlineQueueService`
- `TestTokens` from `../fixtures/test-tokens`

**Step 2: Create scan edge case tests**

Create `backend/tests/integration/scan-edge-cases.test.js`:

```javascript
/**
 * Scan API Edge Cases — Integration Tests
 *
 * Tests scan behavior under non-happy-path conditions:
 * no session, validation boundaries, unknown tokens, batch edge cases.
 *
 * IMPORTANT: Player scan route (scanRoutes.js) does NOT check session status —
 * any session (setup/active/paused/ended) allows player scans. This is by design:
 * player scanners are "intel gathering" devices. Only GM transactions enforce
 * session state via transactionService.processScan().
 */

// CRITICAL: Load browser mocks FIRST before any scanner code
require('../helpers/browser-mocks');

const { setupIntegrationTestServer, cleanupIntegrationTestServer } = require('../helpers/integration-test-server');
const { resetAllServicesForTesting } = require('../helpers/service-reset');
const sessionService = require('../../src/services/sessionService');
const transactionService = require('../../src/services/transactionService');
const videoQueueService = require('../../src/services/videoQueueService');
const offlineQueueService = require('../../src/services/offlineQueueService');
const TestTokens = require('../fixtures/test-tokens');

describe('Scan API Edge Cases', () => {
  let testContext;

  beforeAll(async () => {
    testContext = await setupIntegrationTestServer();
  });

  afterAll(async () => {
    await cleanupIntegrationTestServer(testContext);
  });

  beforeEach(async () => {
    await resetAllServicesForTesting(testContext.io, {
      sessionService,
      transactionService,
      videoQueueService,
      offlineQueueService
    });

    // Re-initialize tokens after reset
    const testTokens = TestTokens.getAllAsArray();
    await transactionService.init(testTokens);
  });

  // Helper: POST to scan endpoint
  async function postScan(body) {
    const res = await fetch(`${testContext.url}/api/scan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await res.json().catch(() => ({}));
    return { status: res.status, body: data };
  }

  // Helper: POST to batch endpoint
  async function postBatch(body) {
    const res = await fetch(`${testContext.url}/api/scan/batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await res.json().catch(() => ({}));
    return { status: res.status, body: data };
  }

  // ─── No Session ─────────────────────────────────────────────────────

  describe('no session', () => {
    test('returns 409 SESSION_NOT_FOUND when no session exists', async () => {
      const res = await postScan({
        tokenId: 'ale001',
        deviceId: 'TEST_DEVICE',
        deviceType: 'player',
        timestamp: new Date().toISOString()
      });

      expect(res.status).toBe(409);
      expect(res.body.error).toBe('SESSION_NOT_FOUND');
    });
  });

  // ─── Session State (Player scanners accept all states) ──────────────

  describe('session state acceptance', () => {
    test('accepts scan during setup state (player = intel gathering)', async () => {
      await sessionService.createSession({ name: 'Test' });
      // Still in setup — NOT started

      const res = await postScan({
        tokenId: 'ale001',
        deviceId: 'TEST_DEVICE',
        deviceType: 'player',
        timestamp: new Date().toISOString()
      });

      expect(res.status).toBe(200);
    });

    test('accepts scan during active session', async () => {
      await sessionService.createSession({ name: 'Test' });
      await sessionService.startGame();

      const res = await postScan({
        tokenId: 'ale001',
        deviceId: 'TEST_DEVICE',
        deviceType: 'player',
        timestamp: new Date().toISOString()
      });

      expect(res.status).toBe(200);
    });

    test('accepts scan during paused session', async () => {
      await sessionService.createSession({ name: 'Test' });
      await sessionService.startGame();
      await sessionService.updateSessionStatus('paused');

      const res = await postScan({
        tokenId: 'ale001',
        deviceId: 'TEST_DEVICE',
        deviceType: 'player',
        timestamp: new Date().toISOString()
      });

      expect(res.status).toBe(200);
    });

    test('accepts scan after session ended', async () => {
      await sessionService.createSession({ name: 'Test' });
      await sessionService.startGame();
      await sessionService.endSession();

      const res = await postScan({
        tokenId: 'ale001',
        deviceId: 'TEST_DEVICE',
        deviceType: 'player',
        timestamp: new Date().toISOString()
      });

      expect(res.status).toBe(200);
    });
  });

  // ─── Request Validation (Joi) ───────────────────────────────────────

  describe('request validation', () => {
    beforeEach(async () => {
      await sessionService.createSession({ name: 'Test' });
      await sessionService.startGame();
    });

    test('rejects empty body (400)', async () => {
      const res = await postScan({});
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('VALIDATION_ERROR');
    });

    test('rejects missing tokenId (400)', async () => {
      const res = await postScan({
        deviceId: 'dev',
        deviceType: 'player'
      });
      expect(res.status).toBe(400);
    });

    test('rejects missing deviceType (400)', async () => {
      const res = await postScan({
        tokenId: 'ale001',
        deviceId: 'dev'
      });
      expect(res.status).toBe(400);
    });

    test('rejects invalid deviceType enum value (400)', async () => {
      const res = await postScan({
        tokenId: 'ale001',
        deviceId: 'dev',
        deviceType: 'gm'  // Not valid for player scan endpoint
      });
      expect(res.status).toBe(400);
    });

    test('returns 404 for unknown token', async () => {
      const res = await postScan({
        tokenId: 'nonexistent_token_xyz',
        deviceId: 'dev',
        deviceType: 'player',
        timestamp: new Date().toISOString()
      });
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('TOKEN_NOT_FOUND');
    });
  });

  // ─── Batch Edge Cases ───────────────────────────────────────────────

  describe('batch edge cases', () => {
    beforeEach(async () => {
      await sessionService.createSession({ name: 'Test' });
      await sessionService.startGame();
    });

    test('rejects missing batchId (400)', async () => {
      const res = await postBatch({
        transactions: [{ tokenId: 'ale001', deviceId: 'dev', deviceType: 'player' }]
      });
      expect(res.status).toBe(400);
    });

    test('rejects non-array transactions (400)', async () => {
      const res = await postBatch({
        batchId: 'batch_1',
        transactions: 'not-an-array'
      });
      expect(res.status).toBe(400);
    });

    test('handles batch with mix of known and unknown tokens', async () => {
      const res = await postBatch({
        batchId: `batch_mixed_${Date.now()}`,
        transactions: [
          { tokenId: 'ale001', deviceId: 'dev', deviceType: 'player', timestamp: new Date().toISOString() },
          { tokenId: 'nonexistent_xyz', deviceId: 'dev', deviceType: 'player', timestamp: new Date().toISOString() }
        ]
      });

      // Batch returns 200 with per-transaction results
      expect(res.status).toBe(200);
      expect(res.body.results).toHaveLength(2);
    });

    test('handles duplicate batchId (idempotency)', async () => {
      const batchId = `idempotent_${Date.now()}`;
      const batch = {
        batchId,
        transactions: [
          { tokenId: 'ale001', deviceId: 'dev', deviceType: 'esp32', timestamp: new Date().toISOString() }
        ]
      };

      const res1 = await postBatch(batch);
      expect(res1.status).toBe(200);

      // Second request with same batchId returns cached result
      const res2 = await postBatch(batch);
      expect(res2.status).toBe(200);
      expect(res2.body.batchId).toBe(batchId);
    });
  });
});
```

**Step 3: Run new tests**

```bash
cd backend && npx jest --config jest.integration.config.js tests/integration/scan-edge-cases.test.js --verbose
```

Expected: All tests PASS. If any assertion is wrong, read the actual response body to understand the real behavior and adjust expectations.

**Step 4: Run full integration suite**

```bash
cd backend && npm run test:integration
```

Expected: All 295+ integration tests pass including new scan edge cases.

**Step 5: Commit**

```bash
cd backend
git add tests/integration/scan-edge-cases.test.js
git commit -m "test: add scan API edge case integration tests

Documents actual behavior: player scans accepted in ANY session state
(setup/active/paused/ended) — intel gathering by design. Tests cover:
no session (409), Joi validation failures (400), unknown tokens (404),
batch edge cases (missing batchId, mixed results, idempotency)."
```

---

### Task 11: Coverage ratchet enforcement in local test scripts

**Files:**
- Modify: `backend/package.json` (update test:all and test:ci scripts)
- Modify: `ALNScanner/.github/workflows/test.yml` (add coverage:ratchet step)

**Context:** The coverage ratchet (Phase 1) generates per-file thresholds but isn't enforced in the standard test workflow. Task 11 wires `coverage:check` into the test scripts so regressions are caught automatically.

**Step 1: Update backend package.json**

In `backend/package.json`, update the `test:all` and `test:ci` scripts to run coverage with the default jest config (unit+contract) and check thresholds:

Current:
```json
"test:all": "npm run test:unit && npm run test:contract && npm run test:integration",
"test:ci": "npm run test:unit && npm run test:contract && npm run test:integration",
```

Replace with:
```json
"test:all": "npm test -- --coverage && npm run coverage:check && npm run test:integration",
"test:ci": "npm test -- --coverage && npm run coverage:check && npm run test:integration",
```

**Why `npm test -- --coverage`:** The existing `test` script (`jest`) already runs both unit and contract tests via the default jest config. Adding `--coverage` produces a single coverage report. Running unit and contract separately would produce two reports — the second overwrites the first.

**Step 2: Verify test:all works**

```bash
cd backend && npm run test:all
```

Expected: Unit+contract tests run with coverage → coverage:check passes → integration tests run.

**Step 3: Update ALNScanner CI workflow**

In `ALNScanner/.github/workflows/test.yml`, update the unit-tests job to add coverage ratchet:

Find the "Run unit tests with coverage" step (line ~32) and add a new step after it:

```yaml
      - name: Check coverage ratchet
        run: npm run coverage:check
```

**Step 4: Verify locally**

```bash
cd ALNScanner && npm test -- --coverage && npm run coverage:check
```

Expected: Tests pass, coverage check passes.

**Step 5: Commit**

```bash
# Backend
cd backend
git add package.json
git commit -m "feat: enforce coverage ratchet in test:all and test:ci scripts"

# ALNScanner
cd ../ALNScanner
git add .github/workflows/test.yml
git commit -m "ci: add coverage ratchet check to CI workflow"

# Parent
cd ..
git add backend ALNScanner
git commit -m "chore: update refs (coverage ratchet enforcement)"
```

---

### Task 12: Instrument RFIDReader.h for NDEF investigation

**Files:**
- Modify: `arduino-cyd-player-scanner/ALNScanner_v5/config.h` (add NDEF_DEBUG flag)
- Modify: `arduino-cyd-player-scanner/ALNScanner_v5/hal/RFIDReader.h` (add NDEF_DEBUG logging)

**Context:** RFIDReader.h already has extensive `LOG_DEBUG` calls in `extractNDEFTextInternal()` (lines 583-734) that log raw bytes, TLV parsing, and text extraction. But `LOG_DEBUG` is compiled out when `DEBUG_MODE` is not defined — and in production, `DEBUG_MODE` must be off because GPIO 3 is shared between Serial RX and RFID_SS.

However, Serial TX still works in production (only RX is killed). So we add a separate `NDEF_DEBUG` flag that enables NDEF diagnostic output via `LOG_INFO` (always compiled) even when `DEBUG_MODE` is off. This lets us capture byte-level NDEF data during real game sessions.

**Step 1: Add NDEF_DEBUG flag to config.h**

In `arduino-cyd-player-scanner/ALNScanner_v5/config.h`, add after the existing debug section (around line 111, before the `logError` function):

```cpp
// NDEF diagnostic logging — enable even in production builds
// Serial TX still works when RFID is active (only RX is killed by GPIO 3)
// Uncomment to capture byte-level NDEF data during game sessions:
// #define NDEF_DEBUG

#ifdef NDEF_DEBUG
  #define LOG_NDEF(...) Serial.printf(__VA_ARGS__)
#else
  #define LOG_NDEF(...) ((void)0)
#endif
```

**Step 2: Add LOG_NDEF calls to extractNDEFTextInternal**

In `RFIDReader.h` `extractNDEFTextInternal()`, add `LOG_NDEF` calls at key decision points. These supplement (not replace) existing LOG_DEBUG calls:

After the SAK check (line ~589):
```cpp
    LOG_NDEF("[NDEF-DIAG] SAK=0x%02X, UID=");
    for (int i = 0; i < _currentUid.size; i++) {
        LOG_NDEF("%02X", _currentUid.uidByte[i]);
    }
    LOG_NDEF("\n");
```

After reading pages 3-6 (line ~601, after `readPage(3, ...)`):
```cpp
    LOG_NDEF("[NDEF-DIAG] Pages 3-6 raw: ");
    for (int i = 0; i < 16; i++) LOG_NDEF("%02X ", buffer[i]);
    LOG_NDEF("\n");
```

After reading pages 7-10 (line ~617, after `readPage(7, ...)`):
```cpp
    LOG_NDEF("[NDEF-DIAG] Pages 7-10 raw: ");
    for (int i = 0; i < 16; i++) LOG_NDEF("%02X ", buffer2[i]);
    LOG_NDEF("\n");
```

After finding (or not finding) NDEF TLV (line ~659):
```cpp
    LOG_NDEF("[NDEF-DIAG] TLV scan result: ndefStart=%d, ndefLength=%d\n", ndefStart, ndefLength);
```

Before the final return empty string (line ~731):
```cpp
    LOG_NDEF("[NDEF-DIAG] NDEF parse FAILED — returning empty (caller will use UID hex fallback)\n");
```

After successful text extraction (line ~724):
```cpp
    LOG_NDEF("[NDEF-DIAG] NDEF parse SUCCESS — text='%s'\n", extractedText.c_str());
```

**Step 3: Verify compilation**

```bash
cd arduino-cyd-player-scanner/ALNScanner_v5
arduino-cli compile --fqbn esp32:esp32:esp32:PartitionScheme=no_ota,UploadSpeed=921600 .
```

Expected: Compiles successfully with NDEF_DEBUG disabled (all LOG_NDEF are no-ops).

**Step 4: Verify compilation with NDEF_DEBUG enabled**

Temporarily uncomment `#define NDEF_DEBUG` in config.h and compile:

```bash
arduino-cli compile --fqbn esp32:esp32:esp32:PartitionScheme=no_ota,UploadSpeed=921600 .
```

Expected: Compiles successfully. Then re-comment the `#define`.

**Step 5: Verify PlatformIO tests still pass**

```bash
cd arduino-cyd-player-scanner && pio test -e native
```

Expected: 69/69 pass (NDEF_DEBUG is not defined in native tests, LOG_NDEF compiles to no-op).

**Step 6: Commit**

```bash
cd arduino-cyd-player-scanner
git add ALNScanner_v5/config.h ALNScanner_v5/hal/RFIDReader.h
git commit -m "feat: add NDEF_DEBUG diagnostic logging for game-session byte capture

Adds LOG_NDEF macro (separate from DEBUG_MODE) that logs raw page bytes,
TLV parse results, and extraction outcomes via Serial TX even in production.
Disabled by default — uncomment #define NDEF_DEBUG in config.h to enable."
```

Then parent ref:
```bash
cd ..
git add arduino-cyd-player-scanner
git commit -m "chore: update arduino-cyd-player-scanner ref (NDEF_DEBUG instrumentation)"
```

---

### Task 13: Extract NDEF parser and write tests with synthetic byte sequences

**Files:**
- Create: `arduino-cyd-player-scanner/ALNScanner_v5/hal/NDEFParser.h`
- Modify: `arduino-cyd-player-scanner/ALNScanner_v5/hal/RFIDReader.h` (delegate to NDEFParser)
- Create: `arduino-cyd-player-scanner/test/test_ndef/test_ndef.cpp`

**Depends on Task 12:** NDEFParser.h uses the `LOG_NDEF` macro defined in Task 12's config.h changes. Task 12 MUST be completed first or `LOG_NDEF` will be undefined.

**Context:** The NDEF parsing logic in `extractNDEFTextInternal()` (lines 583-734) is interleaved with hardware reads (`readPage()`). We extract the pure parsing logic into `NDEFParser.h` — a function that takes raw page bytes as input and returns the extracted text. This enables unit testing with synthetic byte sequences now and real captured sequences later.

The extracted function signature:
```cpp
String parseNDEFText(const uint8_t* pages3to6, size_t len1,
                     const uint8_t* pages7to10, size_t len2,
                     uint8_t sak);
```

**Step 1: Create NDEFParser.h**

Create `arduino-cyd-player-scanner/ALNScanner_v5/hal/NDEFParser.h`:

```cpp
#pragma once

/**
 * @file NDEFParser.h
 * @brief Pure NDEF text extraction from raw page data.
 *
 * Extracted from RFIDReader.h extractNDEFTextInternal() for testability.
 * Takes raw NTAG page bytes as input — no hardware dependencies.
 *
 * Decision tree:
 * 1. SAK != 0x00 → not NTAG → return ""
 * 2. Find TLV type 0x03 (NDEF Message) in pages 3-6
 * 3. Parse NDEF record: TNF=001 (Well-known), Type='T' (Text)
 * 4. Extract text after language code
 * 5. Return "" if any step fails
 *
 * Tested in test/test_ndef/ with synthetic byte sequences.
 * Future: add real captured sequences from NDEF_DEBUG game sessions.
 */

#include <Arduino.h>
#include "../config.h"

namespace hal {

/**
 * Parse NDEF text record from raw NTAG page data.
 *
 * @param pages3to6  Raw bytes from NTAG pages 3-6 (16 bytes expected)
 * @param len1       Length of pages3to6 buffer
 * @param pages7to10 Raw bytes from NTAG pages 7-10 (16 bytes expected)
 * @param len2       Length of pages7to10 buffer
 * @param sak        SAK byte from card selection (0x00 = NTAG/Ultralight)
 * @return Extracted text string, or "" if parsing fails at any step
 */
inline String parseNDEFText(const uint8_t* pages3to6, size_t len1,
                            const uint8_t* pages7to10, size_t len2,
                            uint8_t sak) {
    // Only process NTAG/Ultralight cards (SAK=0x00)
    if (sak != 0x00) {
        LOG_NDEF("[NDEF-PARSE] Not an NTAG (SAK=0x%02X), skipping\n", sak);
        return "";
    }

    if (len1 < 16 || len2 < 16) {
        LOG_NDEF("[NDEF-PARSE] Insufficient page data (len1=%zu, len2=%zu)\n", len1, len2);
        return "";
    }

    // Parse TLV structure — look for NDEF Message TLV (0x03)
    int ndefStart = -1;
    int ndefLength = 0;

    // Scan pages 3-6 starting after Capability Container (first 4 bytes)
    for (int i = 4; i < 12; i++) {
        uint8_t tlvType = pages3to6[i];

        if (tlvType == 0x00) {
            continue;  // NULL TLV, skip
        } else if (tlvType == 0xFE) {
            break;  // Terminator TLV
        } else if (tlvType == 0x01) {
            // Lock Control TLV — skip
            if (i + 1 < 16) {
                uint8_t lockLen = pages3to6[i + 1];
                i += 1 + lockLen;
            }
        } else if (tlvType == 0x03) {
            // NDEF Message TLV
            if (i + 1 < 16) {
                ndefLength = pages3to6[i + 1];
                ndefStart = i + 2;
                break;
            }
        }
    }

    LOG_NDEF("[NDEF-PARSE] TLV result: ndefStart=%d, ndefLength=%d\n", ndefStart, ndefLength);

    if (ndefStart < 0 || ndefLength <= 0) {
        return "";
    }

    // Build complete NDEF message from both page buffers
    uint8_t ndefMessage[32];
    int msgIdx = 0;

    for (int j = ndefStart; j < 16 && msgIdx < ndefLength; j++) {
        ndefMessage[msgIdx++] = pages3to6[j];
    }
    if (msgIdx < ndefLength) {
        for (int j = 0; j < 16 && msgIdx < ndefLength; j++) {
            ndefMessage[msgIdx++] = pages7to10[j];
        }
    }

    // Parse NDEF record header
    if (ndefLength < 7) {
        return "";
    }

    uint8_t recordHeader = ndefMessage[0];

    // Check TNF=001 (Well-known type)
    if ((recordHeader & 0x07) != 0x01) {
        return "";
    }

    uint8_t typeLength = ndefMessage[1];
    uint8_t payloadLength = ndefMessage[2];

    // Check for Text record (Type='T')
    if (typeLength != 1 || ndefMessage[3] != 'T') {
        return "";
    }

    // Extract text after language code
    uint8_t langCodeLen = ndefMessage[4] & 0x3F;
    int textStart = 5 + langCodeLen;
    int textLength = payloadLength - 1 - langCodeLen;

    if (textLength <= 0 || textStart + textLength > ndefLength) {
        return "";
    }

    String extractedText = "";
    for (int k = 0; k < textLength && (textStart + k) < ndefLength; k++) {
        extractedText += (char)ndefMessage[textStart + k];
    }

    LOG_NDEF("[NDEF-PARSE] Extracted: '%s'\n", extractedText.c_str());
    return extractedText;
}

} // namespace hal
```

**Step 2: Update RFIDReader.h to delegate to NDEFParser**

In `RFIDReader.h`, add `#include "NDEFParser.h"` after the existing includes.

Then replace the body of `extractNDEFTextInternal()` (lines 583-734) to delegate:

```cpp
String RFIDReader::extractNDEFTextInternal() {
    LOG_INFO("[NDEF] Starting NDEF extraction...\n");

    // Read pages 3-6 (16 bytes)
    uint8_t buffer[18];
    uint8_t size = sizeof(buffer);
    if (!readPage(3, buffer, &size)) {
        return "";
    }

    // Read pages 7-10 (16 bytes)
    uint8_t buffer2[18];
    size = sizeof(buffer2);
    delay(5);  // Delay between reads
    if (!readPage(7, buffer2, &size)) {
        return "";
    }

    // Delegate parsing to pure function (testable without hardware)
    return hal::parseNDEFText(buffer, 16, buffer2, 16, _currentUid.sak);
}
```

**Step 3: Verify Arduino CLI compilation**

```bash
cd arduino-cyd-player-scanner/ALNScanner_v5
arduino-cli compile --fqbn esp32:esp32:esp32:PartitionScheme=no_ota,UploadSpeed=921600 .
```

Expected: Compiles successfully.

**Step 4: Write NDEF parser tests with synthetic byte sequences**

Create `arduino-cyd-player-scanner/test/test_ndef/test_ndef.cpp`:

```cpp
#include <unity.h>
#include <Arduino.h>
#include "hal/NDEFParser.h"

void setUp(void) {}
void tearDown(void) {}

// ─── Helper: Build valid NDEF text record ─────────────────────────────
// Constructs raw page bytes for a valid NTAG with text "kaa001"
// NDEF structure: [CC 4 bytes][TLV: 03 len][Record: header typeLen payloadLen 'T' langLen 'en' text]

static void buildValidNDEFPages(uint8_t* pages3to6, uint8_t* pages7to10, const char* text) {
    memset(pages3to6, 0, 16);
    memset(pages7to10, 0, 16);

    int textLen = strlen(text);
    int langLen = 2; // "en"
    int payloadLen = 1 + langLen + textLen; // status byte + lang + text
    int ndefRecordLen = 1 + 1 + 1 + 1 + payloadLen; // header + typeLen + payloadLen + type + payload
    int tlvLen = ndefRecordLen;

    // Capability Container (page 3, 4 bytes)
    pages3to6[0] = 0x01; // NDEF magic
    pages3to6[1] = 0x03; // Version
    pages3to6[2] = 0x00; // Size
    pages3to6[3] = 0x0F; // Access

    // NDEF Message TLV at byte 4
    pages3to6[4] = 0x03; // TLV type: NDEF Message
    pages3to6[5] = (uint8_t)tlvLen; // TLV length

    // NDEF Record starting at byte 6
    int idx = 6;
    pages3to6[idx++] = 0xD1; // MB=1, ME=1, CF=0, SR=1, IL=0, TNF=001 (Well-known)
    pages3to6[idx++] = 0x01; // Type length = 1
    pages3to6[idx++] = (uint8_t)payloadLen; // Payload length
    pages3to6[idx++] = 'T';  // Type = Text

    // Payload: status byte (UTF-8, lang len) + lang code + text
    pages3to6[idx++] = (uint8_t)langLen; // Status byte: UTF-8=0, lang len=2

    // Language code "en"
    pages3to6[idx++] = 'e';
    pages3to6[idx++] = 'n';

    // Text content — may span into pages7to10
    for (int i = 0; i < textLen; i++) {
        if (idx < 16) {
            pages3to6[idx++] = (uint8_t)text[i];
        } else {
            pages7to10[idx - 16] = (uint8_t)text[i];
            idx++;
        }
    }

    // Terminator TLV
    if (idx < 16) {
        pages3to6[idx] = 0xFE;
    } else if (idx - 16 < 16) {
        pages7to10[idx - 16] = 0xFE;
    }
}

// ─── Valid NDEF Parsing ───────────────────────────────────────────────

void test_parse_valid_short_text() {
    uint8_t p1[16], p2[16];
    buildValidNDEFPages(p1, p2, "kaa001");

    String result = hal::parseNDEFText(p1, 16, p2, 16, 0x00);
    TEST_ASSERT_EQUAL_STRING("kaa001", result.c_str());
}

void test_parse_valid_longer_text() {
    uint8_t p1[16], p2[16];
    buildValidNDEFPages(p1, p2, "ale001");

    String result = hal::parseNDEFText(p1, 16, p2, 16, 0x00);
    TEST_ASSERT_EQUAL_STRING("ale001", result.c_str());
}

void test_parse_text_spanning_pages() {
    // Text long enough to span from pages3to6 into pages7to10
    uint8_t p1[16], p2[16];
    buildValidNDEFPages(p1, p2, "longtoken");

    String result = hal::parseNDEFText(p1, 16, p2, 16, 0x00);
    TEST_ASSERT_EQUAL_STRING("longtoken", result.c_str());
}

// ─── SAK Rejection ────────────────────────────────────────────────────

void test_reject_non_ntag_sak() {
    uint8_t p1[16] = {0}, p2[16] = {0};
    // SAK=0x08 = Mifare Classic, not NTAG
    String result = hal::parseNDEFText(p1, 16, p2, 16, 0x08);
    TEST_ASSERT_EQUAL_STRING("", result.c_str());
}

void test_reject_sak_0x20() {
    uint8_t p1[16] = {0}, p2[16] = {0};
    // SAK=0x20 = ISO 14443-4 (DESFire etc)
    String result = hal::parseNDEFText(p1, 16, p2, 16, 0x20);
    TEST_ASSERT_EQUAL_STRING("", result.c_str());
}

// ─── Buffer Validation ────────────────────────────────────────────────

void test_reject_short_buffer() {
    uint8_t p1[8] = {0}, p2[16] = {0};
    String result = hal::parseNDEFText(p1, 8, p2, 16, 0x00);
    TEST_ASSERT_EQUAL_STRING("", result.c_str());
}

// ─── TLV Parsing Edge Cases ──────────────────────────────────────────

void test_no_ndef_tlv_returns_empty() {
    uint8_t p1[16] = {0}, p2[16] = {0};
    // All zeros — no TLV type 0x03
    String result = hal::parseNDEFText(p1, 16, p2, 16, 0x00);
    TEST_ASSERT_EQUAL_STRING("", result.c_str());
}

void test_terminator_before_ndef() {
    uint8_t p1[16] = {0}, p2[16] = {0};
    p1[4] = 0xFE; // Terminator TLV before any NDEF
    String result = hal::parseNDEFText(p1, 16, p2, 16, 0x00);
    TEST_ASSERT_EQUAL_STRING("", result.c_str());
}

void test_lock_control_tlv_skipped() {
    uint8_t p1[16], p2[16];
    memset(p1, 0, 16);
    memset(p2, 0, 16);

    // Lock Control TLV (0x01) at position 4, then NDEF at position 7
    p1[4] = 0x01; // Lock Control TLV
    p1[5] = 0x00; // Length 0

    // NDEF TLV at position 6
    p1[6] = 0x03; // NDEF Message
    p1[7] = 0x07; // Length 7

    // NDEF record: text "ab"
    p1[8] = 0xD1; // Header
    p1[9] = 0x01; // Type length
    p1[10] = 0x04; // Payload length (1 + 1 + 2 = 4)
    p1[11] = 'T';  // Type
    p1[12] = 0x01; // Lang len = 1
    p1[13] = 'e';  // Lang
    p1[14] = 'a';  // Text
    p1[15] = 'b';  // Text

    String result = hal::parseNDEFText(p1, 16, p2, 16, 0x00);
    TEST_ASSERT_EQUAL_STRING("ab", result.c_str());
}

// ─── NDEF Record Parsing Edge Cases ──────────────────────────────────

void test_wrong_tnf_returns_empty() {
    uint8_t p1[16], p2[16];
    memset(p1, 0, 16);
    memset(p2, 0, 16);

    p1[4] = 0x03; // NDEF TLV
    p1[5] = 0x07; // Length
    p1[6] = 0xD4; // Header with TNF=100 (External), not 001
    p1[7] = 0x01;
    p1[8] = 0x04;
    p1[9] = 'T';
    p1[10] = 0x01;
    p1[11] = 'e';
    p1[12] = 'a';
    p1[13] = 'b';

    String result = hal::parseNDEFText(p1, 16, p2, 16, 0x00);
    TEST_ASSERT_EQUAL_STRING("", result.c_str());
}

void test_wrong_type_not_T_returns_empty() {
    uint8_t p1[16], p2[16];
    memset(p1, 0, 16);
    memset(p2, 0, 16);

    p1[4] = 0x03;
    p1[5] = 0x07;
    p1[6] = 0xD1; // TNF=001 OK
    p1[7] = 0x01;
    p1[8] = 0x04;
    p1[9] = 'U';  // URI type, not Text
    p1[10] = 0x01;
    p1[11] = 'e';
    p1[12] = 'a';
    p1[13] = 'b';

    String result = hal::parseNDEFText(p1, 16, p2, 16, 0x00);
    TEST_ASSERT_EQUAL_STRING("", result.c_str());
}

void test_ndef_message_too_short() {
    uint8_t p1[16], p2[16];
    memset(p1, 0, 16);
    memset(p2, 0, 16);

    p1[4] = 0x03;
    p1[5] = 0x03; // Only 3 bytes — too short for a valid record (minimum 7)

    String result = hal::parseNDEFText(p1, 16, p2, 16, 0x00);
    TEST_ASSERT_EQUAL_STRING("", result.c_str());
}

int main(int argc, char** argv) {
    UNITY_BEGIN();

    // Valid parsing
    RUN_TEST(test_parse_valid_short_text);
    RUN_TEST(test_parse_valid_longer_text);
    RUN_TEST(test_parse_text_spanning_pages);

    // SAK rejection
    RUN_TEST(test_reject_non_ntag_sak);
    RUN_TEST(test_reject_sak_0x20);

    // Buffer validation
    RUN_TEST(test_reject_short_buffer);

    // TLV edge cases
    RUN_TEST(test_no_ndef_tlv_returns_empty);
    RUN_TEST(test_terminator_before_ndef);
    RUN_TEST(test_lock_control_tlv_skipped);

    // Record parsing edge cases
    RUN_TEST(test_wrong_tnf_returns_empty);
    RUN_TEST(test_wrong_type_not_T_returns_empty);
    RUN_TEST(test_ndef_message_too_short);

    return UNITY_END();
}
```

**Step 5: Run NDEF parser tests**

```bash
cd arduino-cyd-player-scanner
pio test -e native -f test_ndef
```

Expected: 12 tests PASS.

**Step 6: Run all ESP32 tests**

```bash
pio test -e native
```

Expected: 5 suites (smoke, config, token, payload, ndef), 81 total tests, all PASS.

**Step 7: Commit**

```bash
cd arduino-cyd-player-scanner
git add ALNScanner_v5/hal/NDEFParser.h ALNScanner_v5/hal/RFIDReader.h test/test_ndef/test_ndef.cpp
git commit -m "refactor: extract NDEFParser.h from RFIDReader for testability

Extracts pure NDEF text parsing (TLV scan, record header, text extraction)
into hal::parseNDEFText() with no hardware dependencies. RFIDReader delegates
to it after reading raw pages from SPI. Adds 12 tests with synthetic byte
sequences covering valid NDEF, SAK rejection, TLV edge cases, and record
parsing failures. Future: add real captured sequences from NDEF_DEBUG sessions."
```

Then parent ref:
```bash
cd ..
git add arduino-cyd-player-scanner
git commit -m "chore: update arduino-cyd-player-scanner ref (NDEFParser extraction + tests)"
```

---

### Task 13b: Phase 3 documentation updates

**Files:**
- Modify: `backend/CLAUDE.md`
- Modify: `arduino-cyd-player-scanner/CLAUDE.md`
- Modify: `CLAUDE.md` (root)

**Step 1: Update backend CLAUDE.md**

In the Testing section, add after the Coverage Ratchet subsection:

```markdown
**Contract Request Validation:**

`tests/helpers/contract-validator.js` now validates both REQUEST and RESPONSE schemas:
- `validateHTTPRequest(body, path, method)` — validates request body against OpenAPI requestBody schema
- `validateHTTPResponse(response, path, method, status)` — validates response body against OpenAPI response schema
- `getHTTPRequestSchema(path, method)` — extracts request body JSON Schema
- Scanner contract tests in `tests/contract/scanner/request-schema-validation.test.js` validate ESP32 and PWA payload formats against the spec

**Coverage ratchet enforcement:** `test:all` and `test:ci` now run `jest --coverage` + `coverage:check` before integration tests. Coverage regressions fail the build.
```

**Step 2: Update ESP32 CLAUDE.md**

In the Testing section, update "What's tested" and add NDEF section:

Add to the "What's tested" list:
```markdown
- `hal/NDEFParser.h`: `parseNDEFText()` (TLV parsing, NDEF record extraction, SAK validation, page-spanning text)
```

Add after the Testing section:

```markdown
### NDEF Diagnostic Logging

Uncomment `#define NDEF_DEBUG` in `config.h` to enable production-safe NDEF byte logging.
Outputs raw page bytes, TLV parse results, and extraction outcomes via Serial TX.
Serial TX remains active even when RFID uses GPIO 3 (only RX is killed).

Use during game sessions to capture byte sequences for test fixtures:
1. Uncomment `#define NDEF_DEBUG` in `config.h`
2. Compile and upload
3. Monitor Serial output during scans: `arduino-cli monitor -p /dev/ttyUSB0 -c baudrate=115200`
4. Copy `[NDEF-DIAG]` lines for failing scans
5. Re-comment `#define NDEF_DEBUG` after capture
```

**Step 3: Update root CLAUDE.md**

In the Contract-First Architecture section, add:

```markdown
**Scanner contract validation:** `backend/tests/contract/scanner/request-schema-validation.test.js` validates ESP32 and PWA scanner payloads against OpenAPI request schemas using AJV. Runs in parent repo (monorepo-relative paths to openapi.yaml). Catches drift between scanner payload construction and backend expectations.
```

**Step 4: Commit**

```bash
cd backend
git add CLAUDE.md
git commit -m "docs: document contract request validation and coverage enforcement"

cd ../arduino-cyd-player-scanner
git add CLAUDE.md
git commit -m "docs: document NDEFParser tests and NDEF_DEBUG diagnostic logging"

cd ..
git add CLAUDE.md backend arduino-cyd-player-scanner
git commit -m "docs: update root CLAUDE.md with scanner contract validation pattern"
```

---

### Phase 3 Completion Checklist

After all tasks (9, 9b, 10, 11, 12, 13, 13b):
1. Run full verification:
   ```bash
   # Backend (uses coverage now)
   cd backend && npm run test:all

   # ESP32 tests (now 5 suites including NDEF)
   cd ../arduino-cyd-player-scanner && pio test -e native

   # PWA scanner tests
   cd ../aln-memory-scanner && npm test

   # ALNScanner (verify nothing broke)
   cd ../ALNScanner && npm test
   ```
2. Run code review via `superpowers:requesting-code-review`
3. Investigate ALL findings — fix before proceeding
4. Commit any fixes
5. Push submodules, verify CI if applicable
6. Update parent submodule refs and push

---

## Phase 4: Test Quality and Organization (fully detailed)

> **Expanded:** 2026-04-01 using `superpowers:writing-plans` skill.

**Context:** Phases 1-3 built test infrastructure and contracts. Phase 4 fills coverage gaps in backend models/services and reorganizes ALNScanner test files for maintainability. No new infrastructure — pure test authoring and file organization.

**Existing test landscape (what's already covered):**
- `adminEvents-envControl.test.js` — environment control commands (35 describe blocks)
- `broadcasts.test.js` + `phase1-broadcasts.test.js` + `phase2-broadcasts.test.js` + `broadcasts-environment.test.js` — 93 describe blocks across 4 files
- 5 `MonitoringDisplay-*.test.js` files — 83 describe blocks (well-structured, in `tests/unit/admin/`)
- 3 `domEventBindings-*.test.js` files — split by concern (admin, spotify, safeAction)
- `adminModule.test.js` — in `tests/unit/utils/` (wrong location), tests SessionManager only

**What's NOT covered (zero tests):**
- `adminEvents.js` core `handleGmCommand` + `handleTransactionSubmit` (env control tested separately)
- `heartbeatMonitorService.js` — full class
- `models/teamScore.js` — full class (18 methods)
- `models/deviceConnection.js` — full class (20 methods)
- `models/videoQueueItem.js` — full class (14 methods)
- `ALNScanner/src/admin/DisplayController.js` — 4 command methods
- `ALNScanner/src/admin/AdminOperations.js` — 6 command methods

**Scope revision from original plan:** Task 15 (broadcasts.js) dropped — 93 existing describe blocks provide strong coverage. Task 17 (ALNScanner reorg) simplified to move `adminModule.test.js` to correct location and rename; file consolidation deferred (YAGNI — 5 MonitoringDisplay files and 3 domEventBindings files are already well-organized by concern).

---

### Task 14: Backend unit tests for adminEvents.js

**Files:**
- Create: `backend/tests/unit/websocket/adminEvents.test.js`

**Context:** `adminEvents.js` exports two functions: `handleGmCommand(socket, data, io)` and `handleTransactionSubmit(socket, data, _io)`. The env control test file (`adminEvents-envControl.test.js`) exists but tests only environment commands via commandExecutor. This task tests the core routing, auth checks, envelope unwrapping, and error paths.

**Key patterns from reading the source:**
- `handleGmCommand` checks `!socket.deviceId || socket.deviceType !== 'gm'` for auth (compound: both must be valid)
- It unwraps AsyncAPI envelope: `data.data || data` for action/payload
- `system:reset` is handled directly (with mutex), everything else goes to `executeCommand()`
- Ack format is `{action, success, message}` via `emitWrapped(socket, 'gm:command:ack', ...)`
- `handleTransactionSubmit` requires `data.data` envelope (strict), enriches with socket.deviceId/deviceType
- Validates via `gmTransactionSchema`, checks session exists + active, calls `processScan()`

**Step 1: Create the test file**

Create `backend/tests/unit/websocket/adminEvents.test.js`:

```javascript
/**
 * adminEvents.js — Core command routing and transaction submission tests.
 *
 * Tests handleGmCommand (auth, routing, ack format, system:reset mutex)
 * and handleTransactionSubmit (envelope, session state, scoring).
 * Environment commands tested separately in adminEvents-envControl.test.js.
 */

jest.mock('../../../src/utils/logger');
jest.mock('../../../src/services/commandExecutor');
jest.mock('../../../src/services/systemReset');
jest.mock('../../../src/services/sessionService');
jest.mock('../../../src/services/transactionService');
jest.mock('../../../src/services/offlineQueueService');
jest.mock('../../../src/services/videoQueueService');
jest.mock('../../../src/services/displayControlService');
jest.mock('../../../src/services/vlcMprisService');
jest.mock('../../../src/services/bluetoothService');
jest.mock('../../../src/services/audioRoutingService');
jest.mock('../../../src/services/lightingService');
jest.mock('../../../src/services/gameClockService');
jest.mock('../../../src/services/cueEngineService');
jest.mock('../../../src/services/soundService');
jest.mock('../../../src/websocket/eventWrapper', () => ({
  emitWrapped: jest.fn()
}));

const { handleGmCommand, handleTransactionSubmit } = require('../../../src/websocket/adminEvents');
const { executeCommand } = require('../../../src/services/commandExecutor');
const { performSystemReset } = require('../../../src/services/systemReset');
const sessionService = require('../../../src/services/sessionService');
const transactionService = require('../../../src/services/transactionService');
const offlineQueueService = require('../../../src/services/offlineQueueService');
const { emitWrapped } = require('../../../src/websocket/eventWrapper');

describe('adminEvents.js', () => {
  let mockSocket;
  let mockIo;

  beforeEach(() => {
    jest.clearAllMocks();
    mockSocket = {
      id: 'socket-1',
      deviceId: 'gm-001',
      deviceType: 'gm',
    };
    mockIo = { to: jest.fn().mockReturnThis(), emit: jest.fn() };
    executeCommand.mockResolvedValue({ success: true, message: 'OK' });
    performSystemReset.mockResolvedValue(undefined);
    offlineQueueService.isOffline = false;
  });

  describe('handleGmCommand', () => {
    test('rejects unauthenticated socket', async () => {
      mockSocket.deviceType = null;
      mockSocket.deviceId = null;

      await handleGmCommand(mockSocket, { data: { action: 'session:start' } }, mockIo);

      expect(emitWrapped).toHaveBeenCalledWith(mockSocket, 'error', expect.objectContaining({
        code: 'AUTH_REQUIRED'
      }));
    });

    test('routes action to executeCommand', async () => {
      await handleGmCommand(mockSocket, {
        data: { action: 'session:start', payload: {} }
      }, mockIo);

      expect(executeCommand).toHaveBeenCalledWith(expect.objectContaining({
        action: 'session:start',
        source: 'gm',
        deviceId: 'gm-001'
      }));
    });

    test('sends ack with action, success, message', async () => {
      executeCommand.mockResolvedValue({ success: true, message: 'Session started' });

      await handleGmCommand(mockSocket, {
        data: { action: 'session:start', payload: {} }
      }, mockIo);

      expect(emitWrapped).toHaveBeenCalledWith(mockSocket, 'gm:command:ack', {
        action: 'session:start',
        success: true,
        message: 'Session started'
      });
    });

    test('sends failure ack on executeCommand error', async () => {
      executeCommand.mockRejectedValue(new Error('Invalid state'));

      await handleGmCommand(mockSocket, {
        data: { action: 'session:pause', payload: {} }
      }, mockIo);

      expect(emitWrapped).toHaveBeenCalledWith(mockSocket, 'gm:command:ack', {
        action: 'session:pause',
        success: false,
        message: 'Invalid state'
      });
    });

    test('handles system:reset directly (not via executeCommand)', async () => {
      await handleGmCommand(mockSocket, {
        data: { action: 'system:reset', payload: {} }
      }, mockIo);

      expect(performSystemReset).toHaveBeenCalled();
      expect(executeCommand).not.toHaveBeenCalled();
      expect(emitWrapped).toHaveBeenCalledWith(mockSocket, 'gm:command:ack', expect.objectContaining({
        action: 'system:reset',
        success: true
      }));
    });

    test('system:reset mutex prevents concurrent resets', async () => {
      // First reset hangs (never resolves)
      let resolveFirst;
      performSystemReset.mockImplementation(() => new Promise(r => { resolveFirst = r; }));

      const first = handleGmCommand(mockSocket, {
        data: { action: 'system:reset', payload: {} }
      }, mockIo);

      // Second reset should fail immediately
      await handleGmCommand(mockSocket, {
        data: { action: 'system:reset', payload: {} }
      }, mockIo);

      expect(emitWrapped).toHaveBeenCalledWith(mockSocket, 'gm:command:ack', expect.objectContaining({
        action: 'system:reset',
        success: false,
        message: expect.stringContaining('already in progress')
      }));

      // Clean up first reset
      resolveFirst();
      await first;
    });

    test('unwraps AsyncAPI envelope (data.data)', async () => {
      await handleGmCommand(mockSocket, {
        event: 'gm:command',
        data: { action: 'cue:fire', payload: { cueId: 'intro' } },
        timestamp: '2026-04-01T00:00:00Z'
      }, mockIo);

      expect(executeCommand).toHaveBeenCalledWith(expect.objectContaining({
        action: 'cue:fire',
        payload: { cueId: 'intro' }
      }));
    });

    test('handles flat data (no envelope) for backwards compatibility', async () => {
      await handleGmCommand(mockSocket, {
        action: 'spotify:play',
        payload: {}
      }, mockIo);

      expect(executeCommand).toHaveBeenCalledWith(expect.objectContaining({
        action: 'spotify:play'
      }));
    });
  });

  describe('handleTransactionSubmit', () => {
    beforeEach(() => {
      sessionService.getCurrentSession.mockReturnValue({
        id: 'session-1', status: 'active', teams: ['Team1']
      });
      transactionService.processScan.mockResolvedValue({
        status: 'processed',
        transactionId: 'tx-1',
        transaction: { id: 'tx-1', tokenId: 'tok1', teamId: 'Team1' },
        points: 50000,
        message: 'Token processed'
      });
    });

    test('rejects socket without deviceId', async () => {
      mockSocket.deviceId = null;

      await handleTransactionSubmit(mockSocket, { data: { tokenId: 'tok1', teamId: 'Team1', mode: 'blackmarket' } }, mockIo);

      expect(emitWrapped).toHaveBeenCalledWith(mockSocket, 'error', expect.objectContaining({
        code: 'AUTH_REQUIRED'
      }));
    });

    test('rejects missing envelope (no data.data)', async () => {
      await handleTransactionSubmit(mockSocket, { tokenId: 'tok1', mode: 'blackmarket' }, mockIo);

      expect(emitWrapped).toHaveBeenCalledWith(mockSocket, 'error', expect.objectContaining({
        code: 'VALIDATION_ERROR',
        message: expect.stringContaining('envelope')
      }));
    });

    test('enriches transaction with socket deviceId and deviceType', async () => {
      await handleTransactionSubmit(mockSocket, {
        data: { tokenId: 'tok1', teamId: 'Team1' }
      }, mockIo);

      expect(transactionService.processScan).toHaveBeenCalledWith(expect.objectContaining({
        deviceId: 'gm-001',
        deviceType: 'gm'
      }));
    });

    test('rejects when no session exists (SESSION_NOT_FOUND)', async () => {
      sessionService.getCurrentSession.mockReturnValue(null);

      await handleTransactionSubmit(mockSocket, {
        data: { tokenId: 'tok1', teamId: 'Team1' }
      }, mockIo);

      expect(emitWrapped).toHaveBeenCalledWith(mockSocket, 'error', expect.objectContaining({
        code: 'SESSION_NOT_FOUND'
      }));
    });

    test('rejects when session is paused (SESSION_PAUSED)', async () => {
      sessionService.getCurrentSession.mockReturnValue({ id: 's1', status: 'paused' });

      await handleTransactionSubmit(mockSocket, {
        data: { tokenId: 'tok1', teamId: 'Team1' }
      }, mockIo);

      expect(emitWrapped).toHaveBeenCalledWith(mockSocket, 'transaction:result', expect.objectContaining({
        error: 'SESSION_PAUSED'
      }));
    });

    test('rejects when session is in setup (SESSION_NOT_ACTIVE)', async () => {
      sessionService.getCurrentSession.mockReturnValue({ id: 's1', status: 'setup' });

      await handleTransactionSubmit(mockSocket, {
        data: { tokenId: 'tok1', teamId: 'Team1' }
      }, mockIo);

      expect(emitWrapped).toHaveBeenCalledWith(mockSocket, 'transaction:result', expect.objectContaining({
        error: 'SESSION_NOT_ACTIVE'
      }));
    });

    test('queues transaction when system is offline', async () => {
      offlineQueueService.isOffline = true;
      offlineQueueService.enqueueGmTransaction = jest.fn().mockReturnValue({
        transactionId: 'queued-1'
      });

      await handleTransactionSubmit(mockSocket, {
        data: { tokenId: 'tok1', teamId: 'Team1' }
      }, mockIo);

      expect(offlineQueueService.enqueueGmTransaction).toHaveBeenCalled();
      expect(emitWrapped).toHaveBeenCalledWith(mockSocket, 'transaction:result', expect.objectContaining({
        status: 'queued'
      }));
    });

    test('returns contract-compliant result on success', async () => {
      await handleTransactionSubmit(mockSocket, {
        data: { tokenId: 'tok1', teamId: 'Team1' }
      }, mockIo);

      expect(emitWrapped).toHaveBeenCalledWith(mockSocket, 'transaction:result', expect.objectContaining({
        status: 'processed',
        transactionId: 'tx-1',
        tokenId: 'tok1',
        teamId: 'Team1',
        points: 50000
      }));
    });
  });
});
```

**Step 2: Run new tests**

```bash
cd backend && npx jest tests/unit/websocket/adminEvents.test.js --verbose
```

Expected: All tests PASS.

**Step 3: Run full unit+contract suite**

```bash
cd backend && npm test
```

Expected: No regressions.

**Step 4: Commit**

```bash
cd backend
git add tests/unit/websocket/adminEvents.test.js
git commit -m "test: add unit tests for adminEvents.js core command routing

Tests handleGmCommand (auth, routing, ack format, system:reset mutex,
envelope unwrapping) and handleTransactionSubmit (auth, envelope validation,
session state checks, offline queuing, contract-compliant results).
Environment commands tested separately in adminEvents-envControl.test.js."
```

---

### Task 15: Backend model unit tests (teamScore, deviceConnection, videoQueueItem)

**Files:**
- Create: `backend/tests/unit/models/teamScore.test.js`
- Create: `backend/tests/unit/models/deviceConnection.test.js`
- Create: `backend/tests/unit/models/videoQueueItem.test.js`

**Context:** All three model classes have zero test coverage. They are pure data models with validation, state transitions, and computed properties — ideal unit test targets with no service dependencies.

**Step 1: Create teamScore tests**

Create `backend/tests/unit/models/teamScore.test.js`:

```javascript
const TeamScore = require('../../../src/models/teamScore');

describe('TeamScore', () => {
  describe('constructor', () => {
    test('creates with default values', () => {
      const score = new TeamScore({ teamId: 'team1' });
      expect(score.teamId).toBe('team1');
      expect(score.currentScore).toBe(0);
      expect(score.baseScore).toBe(0);
      expect(score.tokensScanned).toBe(0);
      expect(score.bonusPoints).toBe(0);
      expect(score.completedGroups).toEqual([]);
    });

    test('creates from existing data', () => {
      const score = new TeamScore({ teamId: 'team1', currentScore: 100, bonusPoints: 20 });
      expect(score.currentScore).toBe(100);
      expect(score.bonusPoints).toBe(20);
    });
  });

  describe('scoring operations', () => {
    let score;
    beforeEach(() => { score = new TeamScore({ teamId: 'team1' }); });

    test('addPoints increments baseScore and currentScore', () => {
      score.addPoints(50000);
      expect(score.baseScore).toBe(50000);
      expect(score.currentScore).toBe(50000);
    });

    test('addBonus increments bonusPoints and currentScore', () => {
      score.addPoints(10000);
      score.addBonus(5000);
      expect(score.bonusPoints).toBe(5000);
      expect(score.currentScore).toBe(15000);
    });

    test('adjustScore modifies both currentScore and baseScore', () => {
      score.addPoints(100);
      score.adjustScore(-30, 'gm-001', 'Penalty');
      expect(score.currentScore).toBe(70);
      expect(score.baseScore).toBe(70);
      expect(score.adminAdjustments).toHaveLength(1);
      expect(score.adminAdjustments[0].delta).toBe(-30);
    });

    test('incrementTokensScanned tracks count', () => {
      score.incrementTokensScanned();
      score.incrementTokensScanned();
      expect(score.tokensScanned).toBe(2);
    });

    test('getBaseScore returns currentScore minus bonusPoints', () => {
      score.addPoints(100);
      score.addBonus(30);
      expect(score.getBaseScore()).toBe(100);
    });

    test('getAveragePointsPerToken returns 0 for no tokens', () => {
      expect(score.getAveragePointsPerToken()).toBe(0);
    });

    test('getAveragePointsPerToken computes correctly', () => {
      score.addPoints(300);
      score.tokensScanned = 3;
      expect(score.getAveragePointsPerToken()).toBe(100);
    });
  });

  describe('group completion', () => {
    let score;
    beforeEach(() => { score = new TeamScore({ teamId: 'team1' }); });

    test('completeGroup returns true for new group', () => {
      expect(score.completeGroup('Server Logs')).toBe(true);
      expect(score.completedGroups).toContain('Server Logs');
    });

    test('completeGroup returns false for already completed group', () => {
      score.completeGroup('Server Logs');
      expect(score.completeGroup('Server Logs')).toBe(false);
    });

    test('hasCompletedGroup checks membership', () => {
      score.completeGroup('Server Logs');
      expect(score.hasCompletedGroup('Server Logs')).toBe(true);
      expect(score.hasCompletedGroup('Chat Logs')).toBe(false);
    });
  });

  describe('comparison', () => {
    test('compare returns positive when this > other', () => {
      const a = new TeamScore({ teamId: 'a', currentScore: 100 });
      const b = new TeamScore({ teamId: 'b', currentScore: 50 });
      expect(a.compare(b)).toBe(50);
    });

    test('isWinning returns true when ahead', () => {
      const a = new TeamScore({ teamId: 'a', currentScore: 100 });
      const b = new TeamScore({ teamId: 'b', currentScore: 50 });
      expect(a.isWinning(b)).toBe(true);
    });
  });

  describe('reset', () => {
    test('resets all values to zero', () => {
      const score = new TeamScore({ teamId: 'team1', currentScore: 100, tokensScanned: 5 });
      score.completeGroup('group1');
      score.reset();
      expect(score.currentScore).toBe(0);
      expect(score.tokensScanned).toBe(0);
      expect(score.completedGroups).toEqual([]);
    });
  });

  describe('serialization', () => {
    test('toJSON round-trips via fromJSON', () => {
      const original = new TeamScore({ teamId: 'team1' });
      original.addPoints(50000);
      original.completeGroup('Server Logs');
      const json = original.toJSON();
      const restored = TeamScore.fromJSON(json);
      expect(restored.currentScore).toBe(50000);
      expect(restored.completedGroups).toContain('Server Logs');
    });

    test('createInitial sets all zeros', () => {
      const score = TeamScore.createInitial('team1');
      expect(score.teamId).toBe('team1');
      expect(score.currentScore).toBe(0);
    });
  });
});
```

**Step 2: Create deviceConnection tests**

Create `backend/tests/unit/models/deviceConnection.test.js`:

```javascript
const DeviceConnection = require('../../../src/models/deviceConnection');

describe('DeviceConnection', () => {
  describe('constructor and type checks', () => {
    test('creates with defaults', () => {
      const dc = new DeviceConnection({ id: 'dev1', type: 'gm' });
      expect(dc.id).toBe('dev1');
      expect(dc.type).toBe('gm');
      expect(dc.connectionStatus).toBe('connected');
    });

    test('isGM returns true for gm type', () => {
      const dc = new DeviceConnection({ id: 'dev1', type: 'gm' });
      expect(dc.isGM()).toBe(true);
      expect(dc.isPlayer()).toBe(false);
    });

    test('isPlayer returns true for player type', () => {
      const dc = new DeviceConnection({ id: 'dev1', type: 'player' });
      expect(dc.isPlayer()).toBe(true);
    });
  });

  describe('connection lifecycle', () => {
    let dc;
    beforeEach(() => { dc = new DeviceConnection({ id: 'dev1', type: 'player' }); });

    test('connect sets status and timestamps', () => {
      dc.disconnect();
      dc.connect();
      expect(dc.isConnected()).toBe(true);
      expect(dc.connectionTime).toBeTruthy();
    });

    test('disconnect sets status', () => {
      dc.disconnect();
      expect(dc.isDisconnected()).toBe(true);
    });

    test('reconnect sets reconnecting status', () => {
      dc.reconnect();
      expect(dc.isReconnecting()).toBe(true);
    });
  });

  describe('heartbeat and timeout', () => {
    test('updateHeartbeat refreshes timestamp', () => {
      const dc = new DeviceConnection({ id: 'dev1', type: 'player' });
      const before = dc.lastHeartbeat;
      dc.updateHeartbeat();
      expect(dc.lastHeartbeat).toBeTruthy();
    });

    test('hasTimedOut returns true after timeout period', () => {
      const dc = new DeviceConnection({ id: 'dev1', type: 'player' });
      // Manually set old heartbeat
      dc.lastHeartbeat = new Date(Date.now() - 60000).toISOString();
      expect(dc.hasTimedOut(30000)).toBe(true);
    });

    test('hasTimedOut returns false when recent', () => {
      const dc = new DeviceConnection({ id: 'dev1', type: 'player' });
      dc.updateHeartbeat();
      expect(dc.hasTimedOut(30000)).toBe(false);
    });
  });

  describe('sync state', () => {
    let dc;
    beforeEach(() => { dc = new DeviceConnection({ id: 'dev1', type: 'gm' }); });

    test('syncSuccess resets errors and updates timestamp', () => {
      dc.syncError();
      dc.syncError();
      dc.syncSuccess();
      expect(dc.syncState.syncErrors).toBe(0);
    });

    test('addPendingUpdate increments and needsSync returns true', () => {
      dc.addPendingUpdate();
      expect(dc.needsSync()).toBe(true);
    });

    test('clearPendingUpdates resets count', () => {
      dc.addPendingUpdate();
      dc.addPendingUpdate();
      dc.clearPendingUpdates();
      expect(dc.needsSync()).toBe(false);
    });
  });

  describe('serialization', () => {
    test('toJSON round-trips via fromJSON', () => {
      const original = new DeviceConnection({ id: 'dev1', type: 'gm', name: 'GM Station' });
      const json = original.toJSON();
      const restored = DeviceConnection.fromJSON(json);
      expect(restored.id).toBe('dev1');
      expect(restored.name).toBe('GM Station');
    });

    test('fromIdentify creates from WebSocket identify data', () => {
      const dc = DeviceConnection.fromIdentify(
        { deviceId: 'gm-001', deviceType: 'gm', name: 'Main GM' },
        '192.168.1.100'
      );
      expect(dc.id).toBe('gm-001');
      expect(dc.type).toBe('gm');
      expect(dc.ipAddress).toBe('192.168.1.100');
    });
  });
});
```

**Step 3: Create videoQueueItem tests**

Create `backend/tests/unit/models/videoQueueItem.test.js`:

```javascript
const VideoQueueItem = require('../../../src/models/videoQueueItem');

describe('VideoQueueItem', () => {
  describe('constructor', () => {
    test('creates with pending status', () => {
      const item = new VideoQueueItem({
        tokenId: 'tok1',
        videoPath: '/videos/tok1.mp4',
        requestedBy: 'player-001'
      });
      expect(item.isPending()).toBe(true);
      expect(item.tokenId).toBe('tok1');
    });

    test('auto-generates id if not provided', () => {
      const item = new VideoQueueItem({ tokenId: 'tok1', videoPath: '/v.mp4', requestedBy: 'p1' });
      expect(item.id).toBeTruthy();
    });
  });

  describe('playback lifecycle', () => {
    let item;
    beforeEach(() => {
      item = new VideoQueueItem({
        tokenId: 'tok1',
        videoPath: '/videos/tok1.mp4',
        requestedBy: 'player-001'
      });
    });

    test('startPlayback transitions pending → playing', () => {
      item.startPlayback();
      expect(item.isPlaying()).toBe(true);
      expect(item.playbackStart).toBeTruthy();
    });

    test('startPlayback throws if not pending', () => {
      item.startPlayback();
      expect(() => item.startPlayback()).toThrow();
    });

    test('completePlayback transitions playing → completed', () => {
      item.startPlayback();
      item.completePlayback();
      expect(item.isCompleted()).toBe(true);
      expect(item.playbackEnd).toBeTruthy();
    });

    test('completePlayback throws if not playing', () => {
      expect(() => item.completePlayback()).toThrow();
    });

    test('failPlayback sets error and failed status', () => {
      item.startPlayback();
      item.failPlayback('VLC crashed');
      expect(item.hasFailed()).toBe(true);
      expect(item.error).toBe('VLC crashed');
    });

    test('failPlayback works from pending state', () => {
      item.failPlayback('File not found');
      expect(item.hasFailed()).toBe(true);
    });
  });

  describe('timing calculations', () => {
    test('getPlaybackDuration returns seconds for completed item', () => {
      const item = new VideoQueueItem({
        tokenId: 'tok1', videoPath: '/v.mp4', requestedBy: 'p1'
      });
      item.startPlayback();
      // Simulate 2 seconds of playback
      item.playbackStart = new Date(Date.now() - 2000).toISOString();
      item.completePlayback();
      const duration = item.getPlaybackDuration();
      expect(duration).toBeGreaterThanOrEqual(1);
    });

    test('getPlaybackDuration returns null if not completed', () => {
      const item = new VideoQueueItem({
        tokenId: 'tok1', videoPath: '/v.mp4', requestedBy: 'p1'
      });
      expect(item.getPlaybackDuration()).toBeNull();
    });

    test('shouldTimeout returns true for long-running playback', () => {
      const item = new VideoQueueItem({
        tokenId: 'tok1', videoPath: '/v.mp4', requestedBy: 'p1'
      });
      item.startPlayback();
      item.playbackStart = new Date(Date.now() - 400000).toISOString();
      expect(item.shouldTimeout(300)).toBe(true);
    });

    test('shouldTimeout returns false for recent playback', () => {
      const item = new VideoQueueItem({
        tokenId: 'tok1', videoPath: '/v.mp4', requestedBy: 'p1'
      });
      item.startPlayback();
      expect(item.shouldTimeout(300)).toBe(false);
    });
  });

  describe('serialization', () => {
    test('toJSON round-trips via fromJSON', () => {
      const original = new VideoQueueItem({
        tokenId: 'tok1', videoPath: '/v.mp4', requestedBy: 'p1'
      });
      original.startPlayback();
      const json = original.toJSON();
      const restored = VideoQueueItem.fromJSON(json);
      expect(restored.tokenId).toBe('tok1');
      expect(restored.status).toBe('playing');
    });
  });
});
```

**Step 4: Run all new model tests**

```bash
cd backend && npx jest tests/unit/models/ --verbose
```

Expected: All tests PASS.

**Step 5: Run full suite**

```bash
cd backend && npm test
```

Expected: No regressions.

**Step 6: Commit**

```bash
cd backend
git add tests/unit/models/
git commit -m "test: add unit tests for TeamScore, DeviceConnection, VideoQueueItem models

TeamScore: scoring operations, group completion, comparison, reset, serialization.
DeviceConnection: lifecycle, heartbeat timeout, sync state, serialization.
VideoQueueItem: playback lifecycle, timing calculations, serialization."
```

---

### Task 16: Backend unit tests for heartbeatMonitorService

**Files:**
- Create: `backend/tests/unit/services/heartbeatMonitorService.test.js`

**Context:** `HeartbeatMonitorService` is a singleton that runs a 15-second interval checking HTTP-based devices (player, esp32) for 30-second timeout. It requires: `init(io)` for Socket.io ref, `start()` to begin checking, `stop()` to clear interval, `reset()` for test cleanup. The `checkDeviceHeartbeats()` method iterates session devices and calls `disconnectDevice()` for timed-out ones.

**Step 1: Create the test file**

Create `backend/tests/unit/services/heartbeatMonitorService.test.js`:

```javascript
jest.mock('../../../src/utils/logger');
jest.mock('../../../src/services/sessionService');
jest.mock('../../../src/websocket/deviceHelpers');

const heartbeatMonitorService = require('../../../src/services/heartbeatMonitorService');
const sessionService = require('../../../src/services/sessionService');
const { disconnectDevice } = require('../../../src/websocket/deviceHelpers');

describe('HeartbeatMonitorService', () => {
  let mockIo;

  beforeEach(() => {
    jest.useFakeTimers();
    mockIo = { to: jest.fn().mockReturnThis(), emit: jest.fn() };
    heartbeatMonitorService.reset();
    jest.clearAllMocks();
  });

  afterEach(() => {
    heartbeatMonitorService.reset();
    jest.useRealTimers();
  });

  describe('init', () => {
    test('stores io reference', () => {
      heartbeatMonitorService.init(mockIo);
      expect(heartbeatMonitorService.io).toBe(mockIo);
    });

    test('throws if io is null', () => {
      expect(() => heartbeatMonitorService.init(null)).toThrow();
    });
  });

  describe('start/stop', () => {
    beforeEach(() => {
      heartbeatMonitorService.init(mockIo);
    });

    test('start begins interval checking', () => {
      sessionService.getCurrentSession.mockReturnValue(null);
      heartbeatMonitorService.start();

      // Advance past check interval (15s)
      jest.advanceTimersByTime(15000);

      // Should have attempted to check (even if no session)
      expect(sessionService.getCurrentSession).toHaveBeenCalled();
    });

    test('stop clears interval', () => {
      heartbeatMonitorService.start();
      heartbeatMonitorService.stop();

      jest.clearAllMocks();
      jest.advanceTimersByTime(30000);

      // No checks after stop
      expect(sessionService.getCurrentSession).not.toHaveBeenCalled();
    });

    test('duplicate start is guarded', () => {
      heartbeatMonitorService.start();
      heartbeatMonitorService.start(); // Should not throw or double-start
    });
  });

  describe('checkDeviceHeartbeats', () => {
    beforeEach(() => {
      heartbeatMonitorService.init(mockIo);
    });

    test('skips when no session exists', async () => {
      sessionService.getCurrentSession.mockReturnValue(null);
      await heartbeatMonitorService.checkDeviceHeartbeats();
      expect(disconnectDevice).not.toHaveBeenCalled();
    });

    test('disconnects timed-out player devices', async () => {
      const oldHeartbeat = new Date(Date.now() - 60000).toISOString();
      const session = {
        connectedDevices: [{
          id: 'player-1',
          type: 'player',
          connectionStatus: 'connected',
          connectionTime: oldHeartbeat,
          lastHeartbeat: oldHeartbeat,
          syncState: { lastSyncTime: oldHeartbeat, pendingUpdates: 0, syncErrors: 0 }
        }]
      };
      sessionService.getCurrentSession.mockReturnValue(session);

      await heartbeatMonitorService.checkDeviceHeartbeats();

      expect(disconnectDevice).toHaveBeenCalled();
    });

    test('skips GM devices (WebSocket-based, not HTTP heartbeat)', async () => {
      const oldHeartbeat = new Date(Date.now() - 60000).toISOString();
      const session = {
        connectedDevices: [{
          id: 'gm-1',
          type: 'gm',
          connectionStatus: 'connected',
          connectionTime: oldHeartbeat,
          lastHeartbeat: oldHeartbeat,
          syncState: { lastSyncTime: oldHeartbeat, pendingUpdates: 0, syncErrors: 0 }
        }]
      };
      sessionService.getCurrentSession.mockReturnValue(session);

      await heartbeatMonitorService.checkDeviceHeartbeats();

      expect(disconnectDevice).not.toHaveBeenCalled();
    });

    test('skips already disconnected devices', async () => {
      const oldHeartbeat = new Date(Date.now() - 60000).toISOString();
      const session = {
        connectedDevices: [{
          id: 'player-1',
          type: 'player',
          connectionStatus: 'disconnected',
          connectionTime: oldHeartbeat,
          lastHeartbeat: oldHeartbeat,
          syncState: { lastSyncTime: oldHeartbeat, pendingUpdates: 0, syncErrors: 0 }
        }]
      };
      sessionService.getCurrentSession.mockReturnValue(session);

      await heartbeatMonitorService.checkDeviceHeartbeats();

      expect(disconnectDevice).not.toHaveBeenCalled();
    });
  });
});
```

**Step 2: Run tests**

```bash
cd backend && npx jest tests/unit/services/heartbeatMonitorService.test.js --verbose
```

Expected: All PASS.

**Step 3: Commit**

```bash
cd backend
git add tests/unit/services/heartbeatMonitorService.test.js
git commit -m "test: add unit tests for heartbeatMonitorService

Tests init/start/stop lifecycle, interval-based checking, device timeout
detection (skips GM and disconnected devices), and reset for cleanup."
```

---

### Task 17: ALNScanner test file reorganization

**Files:**
- Move: `ALNScanner/tests/unit/utils/adminModule.test.js` → `ALNScanner/tests/unit/admin/adminModule.test.js`

**Context:** The original plan proposed aggressive consolidation (5 MonitoringDisplay files → 1, 3 domEventBindings files → 1). After reviewing the actual files, this is YAGNI:
- The 5 MonitoringDisplay files are organized by behavior domain (environment, phase1, phase2, phase3, showcontrol) — this is good organization, not fragmentation
- The 3 domEventBindings files are split by concern (admin, spotify, safeAction) — also reasonable
- The only actual misplacement is `adminModule.test.js` sitting in `tests/unit/utils/` when it tests admin modules

**Step 1: Move adminModule.test.js to correct directory**

```bash
cd ALNScanner
mv tests/unit/utils/adminModule.test.js tests/unit/admin/adminModule.test.js
```

**Step 2: Verify imports still resolve**

Read the moved file's imports and verify they work from the new location. The imports use relative paths like `../../../src/admin/SessionManager` — moving from `tests/unit/utils/` to `tests/unit/admin/` keeps the same depth, so imports should work unchanged.

**Step 3: Run all ALNScanner tests**

```bash
cd ALNScanner && npm test
```

Expected: 1102/1102 pass. If any fail, check for relative import path issues.

**Step 4: Commit inside submodule**

```bash
cd ALNScanner
git add tests/unit/utils/adminModule.test.js tests/unit/admin/adminModule.test.js
git commit -m "refactor: move adminModule.test.js to tests/unit/admin/ (correct location)"
```

**Step 5: Update parent ref**

```bash
cd ..
git add ALNScanner
git commit -m "chore: update ALNScanner ref (test file reorganization)"
```

---

### Task 18: ALNScanner coverage gaps (DisplayController + AdminOperations)

**Files:**
- Create: `ALNScanner/tests/unit/admin/DisplayController.test.js`
- Create: `ALNScanner/tests/unit/admin/AdminOperations.test.js`

**Context:** Both classes follow the same pattern: constructor takes `connection` (OrchestratorClient EventTarget), methods call the imported `sendCommand(connection, action, payload)` function from `src/admin/utils/CommandSender.js`. Tests mock `CommandSender.js` at module level (before imports) — matching the established pattern in `AudioController.test.js`.

**Step 1: Create DisplayController tests**

Create `ALNScanner/tests/unit/admin/DisplayController.test.js`:

```javascript
import { describe, it, expect, beforeEach, jest } from '@jest/globals';

// Mock CommandSender - must be before import
jest.mock('../../../src/admin/utils/CommandSender.js', () => ({
  sendCommand: jest.fn().mockResolvedValue({ success: true })
}));

import { DisplayController } from '../../../src/admin/DisplayController.js';
import { sendCommand } from '../../../src/admin/utils/CommandSender.js';

describe('DisplayController', () => {
  let controller;
  let mockConnection;

  beforeEach(() => {
    jest.clearAllMocks();
    mockConnection = {
      send: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn()
    };
    controller = new DisplayController(mockConnection);
  });

  describe('setIdleLoop', () => {
    it('sends display:idle-loop command via CommandSender', async () => {
      await controller.setIdleLoop();
      expect(sendCommand).toHaveBeenCalledWith(
        mockConnection,
        'display:idle-loop',
        expect.any(Object)
      );
    });

    it('returns result from sendCommand', async () => {
      sendCommand.mockResolvedValue({ success: true, mode: 'IDLE_LOOP' });
      const result = await controller.setIdleLoop();
      expect(result.success).toBe(true);
    });
  });

  describe('setScoreboard', () => {
    it('sends display:scoreboard command', async () => {
      await controller.setScoreboard();
      expect(sendCommand).toHaveBeenCalledWith(
        mockConnection,
        'display:scoreboard',
        expect.any(Object)
      );
    });
  });

  describe('returnToVideo', () => {
    it('sends display:return-to-video command', async () => {
      await controller.returnToVideo();
      expect(sendCommand).toHaveBeenCalledWith(
        mockConnection,
        'display:return-to-video',
        expect.any(Object)
      );
    });
  });

  describe('getDisplayStatus', () => {
    it('sends display:status command', async () => {
      await controller.getDisplayStatus();
      expect(sendCommand).toHaveBeenCalledWith(
        mockConnection,
        'display:status',
        expect.any(Object)
      );
    });
  });

  describe('destroy', () => {
    it('does not throw', () => {
      expect(() => controller.destroy()).not.toThrow();
    });
  });
});
```

**Step 2: Create AdminOperations tests**

Create `ALNScanner/tests/unit/admin/AdminOperations.test.js`:

```javascript
import { describe, it, expect, beforeEach, jest } from '@jest/globals';

// Mock CommandSender - must be before import
jest.mock('../../../src/admin/utils/CommandSender.js', () => ({
  sendCommand: jest.fn().mockResolvedValue({ success: true, message: 'OK' })
}));

import { AdminOperations } from '../../../src/admin/AdminOperations.js';
import { sendCommand } from '../../../src/admin/utils/CommandSender.js';

describe('AdminOperations', () => {
  let ops;
  let mockConnection;

  beforeEach(() => {
    jest.clearAllMocks();
    mockConnection = {
      send: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn()
    };
    ops = new AdminOperations(mockConnection);
  });

  describe('restartSystem', () => {
    it('sends system:restart command', async () => {
      await ops.restartSystem();
      expect(sendCommand).toHaveBeenCalledWith(
        mockConnection,
        'system:restart',
        expect.any(Object)
      );
    });
  });

  describe('clearData', () => {
    it('sends system:clear command', async () => {
      await ops.clearData();
      expect(sendCommand).toHaveBeenCalledWith(
        mockConnection,
        'system:clear',
        expect.any(Object)
      );
    });
  });

  describe('resetScores', () => {
    it('sends score:reset command', async () => {
      await ops.resetScores();
      expect(sendCommand).toHaveBeenCalledWith(
        mockConnection,
        'score:reset',
        expect.any(Object)
      );
    });
  });

  describe('adjustScore', () => {
    it('sends score:adjust with teamId, delta, reason', async () => {
      await ops.adjustScore('Team1', -50000, 'Penalty');
      expect(sendCommand).toHaveBeenCalledWith(
        mockConnection,
        'score:adjust',
        expect.objectContaining({
          teamId: 'Team1',
          delta: -50000,
          reason: 'Penalty'
        })
      );
    });

    it('uses default reason when not provided', async () => {
      await ops.adjustScore('Team1', 10000);
      expect(sendCommand).toHaveBeenCalledWith(
        mockConnection,
        'score:adjust',
        expect.objectContaining({
          reason: expect.any(String)
        })
      );
    });
  });

  describe('deleteTransaction', () => {
    it('sends transaction:delete with transactionId', async () => {
      await ops.deleteTransaction('tx-123');
      expect(sendCommand).toHaveBeenCalledWith(
        mockConnection,
        'transaction:delete',
        expect.objectContaining({ transactionId: 'tx-123' })
      );
    });
  });

  describe('checkService', () => {
    it('sends service:check with serviceId', async () => {
      await ops.checkService('vlc');
      expect(sendCommand).toHaveBeenCalledWith(
        mockConnection,
        'service:check',
        expect.objectContaining({ serviceId: 'vlc' })
      );
    });
  });

  describe('destroy', () => {
    it('does not throw', () => {
      expect(() => ops.destroy()).not.toThrow();
    });
  });
});
```

**Step 3: Run new tests**

```bash
cd ALNScanner && npx jest tests/unit/admin/DisplayController.test.js tests/unit/admin/AdminOperations.test.js --verbose
```

Expected: All PASS. If imports fail, verify the exact export style (named vs default) by reading the source files.

**Step 4: Run full ALNScanner suite**

```bash
cd ALNScanner && npm test
```

Expected: 1102+ tests pass (existing + new).

**Step 5: Commit inside submodule**

```bash
cd ALNScanner
git add tests/unit/admin/DisplayController.test.js tests/unit/admin/AdminOperations.test.js
git commit -m "test: add unit tests for DisplayController and AdminOperations

DisplayController: all 4 display mode commands + destroy.
AdminOperations: system restart, score reset/adjust, transaction delete,
service check, destroy. Both use sendCommand mock pattern."
```

**Step 6: Update parent ref**

```bash
cd ..
git add ALNScanner
git commit -m "chore: update ALNScanner ref (DisplayController + AdminOperations tests)"
```

---

### Task 18b: Phase 4 documentation updates

**Files:**
- Modify: `backend/CLAUDE.md`
- Modify: `ALNScanner/CLAUDE.md`
- Modify: `CLAUDE.md` (root)

**Step 1: Update backend CLAUDE.md**

In the Testing section, add to the test layer descriptions or test coverage notes:

```markdown
**Model unit tests:** `tests/unit/models/` covers TeamScore (scoring, groups, comparison), DeviceConnection (lifecycle, heartbeat, sync), VideoQueueItem (playback state machine, timing).

**Service unit tests:** `tests/unit/services/heartbeatMonitorService.test.js` covers init/start/stop, interval checking, device timeout detection.

**WebSocket unit tests:** `tests/unit/websocket/adminEvents.test.js` covers core gm:command routing (auth, ack format, system:reset mutex, envelope unwrapping) and transaction submission (session state validation, offline queuing). Environment commands tested separately in `adminEvents-envControl.test.js`.
```

**Step 2: Update root CLAUDE.md test baselines**

Update the test baselines comment in memory (not in CLAUDE.md — test counts there are derived from running tests).

**Step 3: Commit**

```bash
cd backend
git add CLAUDE.md
git commit -m "docs: document Phase 4 test additions (models, heartbeat, adminEvents)"

cd ..
git add CLAUDE.md backend ALNScanner
git commit -m "docs: Phase 4 documentation updates"
```

---

### Phase 4 Completion Checklist

After all tasks (14, 15, 16, 17, 18, 18b):
1. Run full verification:
   ```bash
   # Backend
   cd backend && npm test && npm run test:integration

   # ALNScanner
   cd ../ALNScanner && npm test

   # ESP32 (should be unaffected)
   cd ../arduino-cyd-player-scanner && pio test -e native

   # PWA scanner (should be unaffected)
   cd ../aln-memory-scanner && npm test
   ```
2. Run code review via `superpowers:requesting-code-review`
3. Investigate ALL findings — fix before proceeding
4. Commit any fixes
5. Push ALNScanner submodule
6. Update parent submodule refs

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
