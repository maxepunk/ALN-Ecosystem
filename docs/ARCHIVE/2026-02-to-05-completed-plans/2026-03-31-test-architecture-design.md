# Test Architecture Design

**Date:** 2026-03-31
**Status:** Approved design, ready for implementation planning
**Goal:** Robust, optimally designed test baseline to support ongoing production code simplification and prevent regressions

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Primary goal | Regression safety + optimal architecture | Future refactoring needs confidence, not just coverage numbers |
| Untested modules | Include all | ESP32 is primary player interface, PWA is fallback — both mission-critical |
| CI location | Per-submodule + parent repo | Fast feedback on submodule push, integration gate on parent |
| Backend test layers | 4 (merge functional → integration) | Functional tests overlap with integration; contract stays separate |
| Coverage thresholds | Per-file ratchet | Global thresholds punish one bad file; ratchet enforces monotonic improvement per file |
| ESP32 testing | PlatformIO migration + native unit tests | Enables C++ unit testing of pure logic; required to diagnose active RFID bugs |
| PWA scanner testing | Extract pure logic, then test (full modularization later) | Light refactor for high testability gain without introducing build system |
| Shared contracts | Keep openapi.yaml in backend, reference via monorepo-relative paths | Avoids 5-commit submodule cascade per API change; contract validation in parent repo CI |
| Mock strategy | Shared mock factories in tests/helpers/mocks/ | Solves "30 files to update" problem (stateService removal touched 30+ files) |
| ALNScanner test organization | Reorganize to mirror source paths | One test file per source file; eliminate phase-split naming artifacts |
| WebSocket handler testing | Unit tests for complex handlers, integration for simple ones | adminEvents.js/broadcasts.js have branching logic; deviceHelpers.js is thin glue |
| E2E enforcement | Mandatory verification checkpoints, not optional nightly | Agent forgets E2E exists; must be part of definition of done |

## Test Taxonomy

Each module gets test layers tailored to its complexity and role:

| Module | Unit | Contract | Integration | E2E |
|--------|------|----------|-------------|-----|
| **Backend** | Jest (isolated, mocked) | Jest (OpenAPI/AsyncAPI validation) | Jest (multi-service, real WebSocket) | Playwright (browser, live server) |
| **ALNScanner** | Jest + jsdom (isolated) | -- | Jest (storage strategies) | Playwright (standalone + full-stack) |
| **ESP32 Scanner** | PlatformIO Unity (pure C++ logic) | Via parent repo CI (monorepo-relative path to openapi.yaml) | -- | -- |
| **PWA Player Scanner** | Jest (extracted logic + orchestratorIntegration) | Via parent repo CI (monorepo-relative path to openapi.yaml) | -- | -- |
| **config-tool** | node:test (existing, expand coverage) | -- | -- | -- |

### Backend Layers (post-merge)

- **Unit** (~55 files): Isolated service/module tests with mocks. Parallel execution (4 workers), 10s timeout.
- **Contract** (~18 files): HTTP/WebSocket schema validation against OpenAPI/AsyncAPI specs. Stateless, parallel.
- **Integration** (~35 files, includes former functional): Multi-service orchestration with real WebSocket. Sequential (1 worker), 30s timeout.
- **E2E** (20 files): Playwright browser tests against live orchestrator. Sequential (workers=1), 60s timeout.

## Shared Contract Infrastructure

### Location

`openapi.yaml` stays in `backend/contracts/` (source of truth). `asyncapi.yaml` also stays in `backend/contracts/` (WebSocket is only used by backend + GM Scanner).

Other modules reference the spec via monorepo-relative paths:

```
ALN-Ecosystem/
+-- backend/contracts/openapi.yaml      # source of truth, stays here
+-- ALNScanner/                         # ../../backend/contracts/openapi.yaml
+-- aln-memory-scanner/                 # ../backend/contracts/openapi.yaml
+-- arduino-cyd-player-scanner/         # ../backend/contracts/openapi.yaml
```

### Consumption Pattern

- **Backend contract tests**: validate route handler responses against openapi.yaml schemas (direct local reference)
- **ESP32 contract tests**: validate payload construction against request schema (via extraction script — YAML parsing impractical in C++)
- **PWA scanner contract tests**: validate request construction against openapi.yaml (monorepo-relative path)
- **Contract drift check**: parent repo CI runs all contract tests with all paths available

### Update Procedure

When the HTTP API changes:
1. Update `openapi.yaml` in `backend/contracts/`
2. Backend contract tests validate automatically (same repo)
3. Parent repo CI validates scanner contract tests against updated spec
4. No submodule commits needed — zero cascade

### ESP32 Contract Extraction

PlatformIO native tests run on the host but parsing YAML in C++ is impractical. A small script extracts request schema fields from `openapi.yaml` into a C-compatible header or JSON fixture in `test_fixtures/`. This script runs as a pre-test step (not committed — always derived from current spec).

### CI Boundary

Contract validation for scanners runs only in parent repo CI (where all monorepo paths are available). Per-submodule CI runs unit tests and build verification only — no contract checks. This matches the tiered CI design: submodule CI = fast feedback, parent CI = integration validation.

## Coverage Strategy: Per-File Ratchet

### Mechanism

A script reads current coverage and generates a Jest threshold config where each file's threshold is its current coverage rounded down to nearest 5%.

### Workflow

1. Run tests with coverage: `npm test -- --coverage --json`
2. Script reads `coverage/coverage-final.json`
3. For each source file, extract branch/line/function percentages
4. Round down to nearest 5% (breathing room for minor refactors)
5. Write to `.coverage-thresholds.json` (committed to repo)
6. Jest config loads this file into `coverageThreshold`

### Example output

**CRITICAL**: Jest `coverageThreshold` keys must use `./` prefix (relative to rootDir) or they silently fail to match:

```json
{
  "./src/services/transactionService.js": {
    "branches": 85, "lines": 90, "functions": 90
  },
  "./src/services/bluetoothService.js": {
    "branches": 60, "lines": 70, "functions": 65
  }
}
```

### Commands

- `npm run coverage:check` — verify no file dropped below its threshold
- `npm run coverage:ratchet` — regenerate thresholds from current data (commit the result)

### Applies to

Backend and ALNScanner (both use Jest). ESP32 uses PlatformIO's coverage tooling. PWA scanner gets its first ratchet once tests exist.

## Backend Test Improvements

### Shared Mock Factories

**Location:** `backend/tests/helpers/mocks/`

One factory per service, returning a properly-shaped mock. Tests import and customize.

```
tests/helpers/mocks/
+-- sessionService.js        # createMockSessionService()
+-- transactionService.js    # createMockTransactionService()
+-- videoQueueService.js     # createMockVideoQueueService()
+-- bluetoothService.js      # createMockBluetoothService()
+-- audioRoutingService.js   # createMockAudioRoutingService()
+-- lightingService.js       # createMockLightingService()
+-- ...
```

**Benefits:**
- Service API changes update one factory, not 30+ test files
- Consistent mock shapes across all tests
- Mock shape stays aligned with real service API

### Functional Test Merge

The 3 backend functional test files require different handling:

| File | Action | Reason |
|------|--------|--------|
| `fr-transaction-processing.test.js` | Move to `tests/integration/` | Uses integration test server, tests backend transaction flow — clean merge |
| `fr-admin-panel.test.js` | Evaluate — imports ALNScanner `SessionModeManager` | Cross-module dependency; may need refactoring to remove ALNScanner import |
| `fr-deployment-modes.test.js` | Move to ALNScanner `tests/` | Tests GM Scanner behavior (imports SessionModeManager, Settings) — belongs in ALNScanner |

After migration, delete `tests/functional/` directory.

### WebSocket Handler Unit Tests

Add isolated unit tests for complex handlers:

| Handler | Why unit test | What to test |
|---------|--------------|-------------|
| `adminEvents.js` | Command routing, error handling, service dispatch | Each gm:command action path, error propagation, ack format |
| `broadcasts.js` | Event listener setup, service:state debounce, sync:full assembly | Listener registration, event forwarding, payload completeness |

Simple handlers (`deviceHelpers.js`, `deviceTracking.js`, `eventWrapper.js`, `listenerRegistry.js`) are adequately covered by integration tests.

### Coverage Gap Priorities

High-risk files to add tests for during refactoring:

| File | Risk | Current Coverage |
|------|------|-----------------|
| `adminEvents.js` | Command routing — every admin action flows through here | Integration only |
| `broadcasts.js` | Event forwarding — silent failures break all real-time state | Integration only |
| `heartbeatMonitorService.js` | Player device timeout — no unit test at all | Integration only |
| `models/teamScore.js` | Scoring model — used by transactionService | Implicit only |
| `models/deviceConnection.js` | Device tracking model | Implicit only |
| `models/videoQueueItem.js` | Video queue model | Implicit only |

### Backend Scanner API Gap Tests

Specific scenarios to add to contract/integration tests:

- Scan when session is paused/ended/setup (not just active)
- Malformed JSON in request body
- Empty string for required fields
- Invalid deviceType values (spoofing prevention)
- Batch partial failure modes
- Rapid session state transitions during scan

## ALNScanner Test Improvements

### File Reorganization

Current (phase-split, inconsistent):
```
tests/unit/admin/MonitoringDisplay.test.js
tests/unit/admin/MonitoringDisplay-environment.test.js
tests/unit/admin/MonitoringDisplay-phase1.test.js
tests/unit/admin/MonitoringDisplay-phase2.test.js
tests/unit/admin/MonitoringDisplay-phase3.test.js
tests/unit/admin/MonitoringDisplay-showcontrol.test.js
tests/unit/utils/adminModule.test.js               # tests SessionManager + VideoController
tests/unit/utils/domEventBindings-admin.test.js
tests/unit/utils/domEventBindings-spotify.test.js
tests/unit/utils/domEventBindings-safeAction.test.js
```

Target (mirrors source paths):
```
tests/unit/admin/MonitoringDisplay.test.js     # consolidated from 6 files
tests/unit/admin/SessionManager.test.js        # extracted from adminModule
tests/unit/admin/VideoController.test.js       # extracted from adminModule
tests/unit/admin/AdminOperations.test.js       # new
tests/unit/admin/DisplayController.test.js     # new (currently zero coverage)
tests/unit/admin/utils/CommandSender.test.js   # new (currently zero coverage)
tests/unit/utils/domEventBindings.test.js      # consolidated from 3 files
```

### Coverage Gaps to Fill

| File | Risk | Current Coverage |
|------|------|-----------------|
| `admin/DisplayController.js` | HDMI mode toggling — no test at all | Zero |
| `admin/utils/CommandSender.js` | All admin commands flow through here | Zero |
| `admin/AdminOperations.js` | Service health checks | Indirect only |
| `main.js` | Entry point, wiring | E2E only |

## ESP32 PlatformIO Migration

### Prerequisites

- Install PlatformIO on Pi: `pip install platformio` (or via installer script)
- Install Arduino mock library (e.g., `ArduinoFake` or custom fakes) for native test environment
- Create Arduino mock headers for hardware dependencies (`<WiFi.h>`, `<SD.h>`, `<HTTPClient.h>`, `<ArduinoJson.h>`, FreeRTOS primitives) before writing unit tests

### Project Structure Changes

```
arduino-cyd-player-scanner/
+-- platformio.ini                 # NEW: PlatformIO project config
+-- ALNScanner_v5/                 # EXISTING: Arduino sketch (unchanged)
+-- test/                          # NEW: Unity test framework
|   +-- test_config/               # Config validation tests
|   +-- test_token/                # Token ID parsing tests
|   +-- test_queue/                # Offline queue serialization tests
|   +-- test_payload/              # HTTP JSON payload construction tests
|   +-- test_ndef/                 # NDEF byte-level parsing tests (Phase 3)
+-- test_fixtures/                 # NEW: Captured byte sequences, extracted contract data
+-- mock/                          # NEW: Arduino/FreeRTOS mock headers for native testing
```

### What Gets Unit Tested

| File | Testable Functions | Why It Matters |
|------|-------------------|----------------|
| `models/Config.h` | `validate()`, protocol auto-upgrade | Bad config = scanner can't connect |
| `models/Token.h` | `cleanTokenId()`, path construction | Wrong normalization = token not found |
| `services/OrchestratorService.h` | JSON payload construction, queue JSONL serialization | Wrong payload = backend rejects; bad queue = lost scans |
| `services/ConfigService.h` | KEY=VALUE parsing, comment handling | Bad parse = wrong WiFi/URL |
| `services/TokenService.h` | Token lookup, ID matching | Failed lookup = blank screen |
| `models/ConnectionState.h` | State transitions | Wrong state = scans to dead connection |

**Note:** All source is header-only (`.h` files) that `#include` Arduino/WiFi/SD/FreeRTOS headers. The mock infrastructure (task in Phase 2) must provide stubs for these dependencies before unit tests can compile in the native environment.

### RFID Investigation (Phase 3)

Two active bugs to diagnose:
1. **Unreliable scan detection** — player taps, device doesn't respond, works on retry
2. **NDEF fallback to hex** — reader returns raw UID hex instead of programmed token ID

Approach:
1. Instrument `RFIDReader.h` with byte-level logging (raw SPI data + card detection events)
2. Capture good and bad scan byte sequences during real game sessions
3. Build NDEF parser unit tests from captured sequences
4. Diagnose and fix — captured bad sequences become regression tests

Requires separating "read bytes from SPI" from "parse NDEF from bytes" in `RFIDReader.h`.

### Contract Validation

A pre-test extraction script reads `../../backend/contracts/openapi.yaml` and writes request schema fields into `test_fixtures/` (JSON or C header). Native tests validate that:
- `sendScan()` builds payloads matching the POST /api/scan request schema
- `uploadQueueBatch()` builds payloads matching POST /api/scan/batch schema
- Queue JSONL entries contain all required fields

Contract validation only runs in parent repo CI (where monorepo paths are available).

## PWA Player Scanner Testing

### Logic Extraction

Extract from `MemoryScanner` class in `index.html` into `js/scannerCore.js`:
- `normalizeTokenId()` — token ID cleaning (NOTE: currently calls `this.showError()` and `navigator.vibrate()` — must refactor to return error codes instead of calling DOM methods)
- `handleScan()` / `processToken()` — scan decision logic
- Offline detection logic

### Test Targets

| File | What to Test |
|------|-------------|
| `js/orchestratorIntegration.js` (330 lines, 100% pure) | Request construction, offline queueing, batch upload, health polling, mode detection |
| `js/scannerCore.js` (new, extracted) | Token normalization, scan handling, offline detection |

### Test Runner

Jest with jsdom (matches ALNScanner pattern). Minimal config — no build system, no Vite.

### Contract Validation

Tests verify request construction matches `backend/contracts/openapi.yaml` (monorepo-relative path):
- Single scan payload format (POST /api/scan)
- Batch payload format (POST /api/scan/batch)
- Health check URL format (GET /health)

Contract validation only runs in parent repo CI.

## Verification Checkpoints

### CLAUDE.md Addition (root level)

All implementation work must pass through these checkpoints before being considered complete.
This is not optional — "the change is small" is not a reason to skip checkpoints.

**Quick Check** (after any code change):
Run unit + contract tests for the changed module.

**Integration Check** (after feature or refactor complete):
Backend integration tests validate multi-service coordination.

**Full Verification** (before work is considered "done"):
All of the above, PLUS end-to-end tests:
- If ALNScanner source changed: rebuild dist first (`cd ALNScanner && npm run build`) — backend E2E symlinks to `ALNScanner/dist`, stale builds test stale code
- Backend E2E: `cd backend && npm run test:e2e`
- ALNScanner E2E: `cd ALNScanner && npm run test:e2e`

E2E is mandatory. Features that pass unit tests but break E2E are not done. If E2E fails and the failure is pre-existing and unrelated to your changes, document it explicitly.

Each component CLAUDE.md references the root verification checkpoints rather than duplicating the rules.

## CI Pipeline

### Verification Checkpoints (Local — Primary Gate)

| Checkpoint | When | What Runs | Duration |
|------------|------|-----------|----------|
| Quick check | After any code change | Unit + contract for changed module | ~30s |
| Integration check | After feature/refactor complete | Backend integration tests | ~5 min |
| Full verification | Before work is "done" | All above + ALNScanner dist rebuild + E2E (workers=1) | ~15 min |

### Per-Submodule CI (GitHub Actions — Fast Feedback)

Unit tests and build verification only. No contract validation (monorepo paths unavailable).

| Repo | Jobs | Duration | Notes |
|------|------|----------|-------|
| ALNScanner | Unit tests, build verification, coverage ratchet | ~2 min | Update existing workflow |
| aln-memory-scanner | Unit tests | ~30s | New workflow |
| arduino-cyd-player-scanner | PlatformIO unit tests | ~1 min | New workflow; needs `platformio/run-platformio` action |
| ALN-TokenData | Schema validation (openapi.yaml is valid YAML, examples parse) | ~15s | New workflow |

### Parent Repo CI (GitHub Actions — Integration Gate)

| Job | What | Duration |
|-----|------|----------|
| Backend unit + contract | `npm test` | ~30s |
| Backend integration | `npm run test:integration` | ~5 min |
| Coverage ratchet check | Verify no file regressed | ~10s |
| Contract drift check | Scanner contract tests vs backend openapi.yaml (all paths available) | ~15s |

## Implementation Roadmap

### Phase 1: Foundation (unblocks everything else)
1. Create coverage ratchet script for backend and ALNScanner
2. Set ALNScanner coverage thresholds to current actuals (unblocks CI)
3. Merge functional tests into integration (evaluate 3 files — see Functional Test Merge section)
4. Create shared mock factories for backend (tests/helpers/mocks/) — moved earlier to reduce duplication in subsequent phases

### Phase 2: Scanner testing infrastructure
5. Install PlatformIO on Pi; create Arduino mock headers for native test environment
6. PlatformIO migration for ESP32 (platformio.ini, test/ directory, verify build)
7. ESP32 pure logic unit tests (config, token ID, JSON payloads, queue serialization)
8. PWA scanner logic extraction (normalizeTokenId, scan handling → js/scannerCore.js; refactor DOM side effects to return error codes)
9. PWA scanner unit tests (orchestratorIntegration.js, scannerCore.js)

### Phase 3: Contract and coverage hardening
10. Contract tests — backend, ESP32, PWA all validate against backend/contracts/openapi.yaml (ESP32 via extraction script)
11. Backend scanner API gap tests (session states, malformed input, batch failures)
12. Coverage ratchet enforcement — integrate into local test scripts, baseline all modules
13. Instrument `RFIDReader.h` — byte-level logging for NDEF investigation, capture sequences
14. NDEF byte-level tests — parser regression tests from captured sequences

### Phase 4: Test quality and organization
15. Backend unit tests for adminEvents.js and broadcasts.js
16. Backend coverage gap tests (heartbeatMonitorService, models)
17. ALNScanner test file reorganization (mirror source paths, consolidate phase-split files)
18. ALNScanner coverage gaps (DisplayController, CommandSender)

### Phase 5: CI and documentation
19. Per-submodule CI workflows (update ALNScanner, new for aln-memory-scanner, arduino-cyd-player-scanner, ALN-TokenData)
20. Parent repo CI workflow (backend tests + coverage ratchet + contract drift)
21. CLAUDE.md verification checkpoint documentation (root + component references)
22. ESP32 hardware investigation (unreliable detection + NDEF fallback diagnosis using Phase 3 instrumentation)
