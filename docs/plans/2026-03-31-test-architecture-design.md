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
| Shared contracts | Move openapi.yaml to ALN-TokenData | HTTP API contract is cross-cutting; WebSocket (asyncapi) stays in backend (GM Scanner only) |
| Contract fixtures | Parse openapi.yaml directly, no generated intermediaries | Single source of truth, zero duplication |
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
| **ESP32 Scanner** | PlatformIO Unity (pure C++ logic) | Shared fixtures via ALN-TokenData | -- | -- |
| **PWA Player Scanner** | Jest (extracted logic + orchestratorIntegration) | Shared fixtures via ALN-TokenData | -- | -- |
| **config-tool** | node:test (existing) | -- | -- | -- |

### Backend Layers (post-merge)

- **Unit** (~55 files): Isolated service/module tests with mocks. Parallel execution (4 workers), 10s timeout.
- **Contract** (~18 files): HTTP/WebSocket schema validation against OpenAPI/AsyncAPI specs. Stateless, parallel.
- **Integration** (~35 files, includes former functional): Multi-service orchestration with real WebSocket. Sequential (1 worker), 30s timeout.
- **E2E** (~20 files): Playwright browser tests against live orchestrator. Sequential, 60s timeout.

## Shared Contract Infrastructure

### Location

```
ALN-TokenData/
+-- tokens.json                    # existing
+-- scoring-config.json            # existing
+-- contracts/
|   +-- openapi.yaml               # HTTP API contract (moved from backend/contracts/)
|   +-- README.md                  # field semantics, update procedures
```

`asyncapi.yaml` stays in `backend/contracts/` — WebSocket is only used by backend + GM Scanner.

### Consumption Pattern

- **Backend contract tests**: validate route handler responses against openapi.yaml schemas
- **ESP32 unit tests**: validate `OrchestratorService::sendScan()` payload construction against openapi.yaml request schema
- **PWA scanner unit tests**: validate `orchestratorIntegration.js` request construction against openapi.yaml request schema
- **Contract drift check**: CI step that verifies all consumers agree with the spec

### Update Procedure

When the HTTP API changes:
1. Update `openapi.yaml` in ALN-TokenData
2. Commit inside the submodule
3. Update submodule refs in consuming repos
4. Contract tests in each consumer validate against the updated spec automatically

No generation step, no duplication. The spec IS the fixture.

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

```json
{
  "src/services/transactionService.js": {
    "branches": 85, "lines": 90, "functions": 90
  },
  "src/services/bluetoothService.js": {
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
tests/unit/admin/MonitoringDisplay-phase2.test.js
tests/unit/admin/MonitoringDisplay-phase3.test.js
tests/unit/admin/MonitoringDisplay-environment.test.js
tests/unit/utils/adminModule.test.js           # tests SessionManager + VideoController
tests/unit/utils/domEventBindings.test.js
tests/unit/utils/domEventBindings-spotify.test.js
tests/unit/utils/domEventBindings-safeAction.test.js
```

Target (mirrors source paths):
```
tests/unit/admin/MonitoringDisplay.test.js     # consolidated from 4 files
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
+-- test_fixtures/                 # NEW: Captured byte sequences, contract data
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

Tests import shared `ALN-TokenData/contracts/openapi.yaml` and verify:
- `sendScan()` builds payloads matching the POST /api/scan request schema
- `uploadQueueBatch()` builds payloads matching POST /api/scan/batch schema
- Queue JSONL entries contain all required fields

## PWA Player Scanner Testing

### Logic Extraction

Extract from `MemoryScanner` class in `index.html` into `js/scannerCore.js`:
- `normalizeTokenId()` — token ID cleaning
- `handleScan()` / `processToken()` — scan decision logic
- Offline detection logic

### Test Targets

| File | What to Test |
|------|-------------|
| `js/orchestratorIntegration.js` (330 lines, 100% pure) | Request construction, offline queueing, batch upload, health polling, mode detection |
| `data/shared/aln-tools.js` (236 lines, 85% pure) | NFC utilities, token loading, URL parsing |
| `js/scannerCore.js` (new, extracted) | Token normalization, scan handling, offline detection |

### Test Runner

Jest with jsdom (matches ALNScanner pattern). Minimal config — no build system, no Vite.

### Contract Validation

Tests verify request construction matches `ALN-TokenData/contracts/openapi.yaml`:
- Single scan payload format (POST /api/scan)
- Batch payload format (POST /api/scan/batch)
- Health check URL format (GET /health)

## Verification Checkpoints

### CLAUDE.md Addition (root level)

All implementation work must pass through these checkpoints before being considered complete.
This is not optional — "the change is small" is not a reason to skip checkpoints.

**Quick Check** (after any code change):
Run unit + contract tests for the changed module.

**Integration Check** (after feature or refactor complete):
Backend integration tests validate multi-service coordination.

**Full Verification** (before work is considered "done"):
All of the above, PLUS end-to-end tests. E2E is mandatory. Features that pass
unit tests but break E2E are not done. If E2E fails and the failure is pre-existing
and unrelated to your changes, document it explicitly.

Each component CLAUDE.md references the root verification checkpoints rather than
duplicating the rules.

## CI Pipeline

### Verification Checkpoints (Local — Primary Gate)

| Checkpoint | When | What Runs | Duration |
|------------|------|-----------|----------|
| Quick check | After any code change | Unit + contract for changed module | ~30s |
| Integration check | After feature/refactor complete | Backend integration tests | ~5 min |
| Full verification | Before work is "done" | All above + E2E | ~15 min |

### Per-Submodule CI (GitHub Actions — Secondary)

| Repo | Jobs | Duration |
|------|------|----------|
| ALNScanner | Unit tests, build verification, coverage ratchet | ~2 min |
| aln-memory-scanner | Unit tests | ~30s |
| arduino-cyd-player-scanner | PlatformIO unit tests | ~1 min |
| ALN-TokenData | Contract schema validation | ~15s |

### Parent Repo CI (GitHub Actions — Integration Gate)

| Job | What | Duration |
|-----|------|----------|
| Backend unit + contract | `npm test` | ~30s |
| Backend integration | `npm run test:integration` | ~5 min |
| Coverage ratchet check | Verify no file regressed | ~10s |
| Contract drift check | Scanner tests vs openapi.yaml | ~15s |

## Implementation Roadmap

### Phase 1: Foundation (unblocks everything else)
1. Move `openapi.yaml` to `ALN-TokenData/contracts/`
2. Create coverage ratchet script for backend and ALNScanner
3. Merge functional tests into integration (relocate 3 backend test files)
4. Set ALNScanner coverage thresholds to current actuals (unblocks CI)

### Phase 2: Scanner testing infrastructure
5. PlatformIO migration for ESP32 (platformio.ini, test/ directory, verify build)
6. ESP32 pure logic unit tests (config, token ID, JSON payloads, queue serialization)
7. PWA scanner logic extraction (normalizeTokenId, scan handling → js/scannerCore.js)
8. PWA scanner unit tests (orchestratorIntegration.js, aln-tools.js, scannerCore.js)

### Phase 3: Contract and coverage hardening
9. Shared contract tests — backend, ESP32, PWA all validate against openapi.yaml
10. Backend scanner API gap tests (session states, malformed input, batch failures)
11. Coverage ratchet enforcement — integrate into local test scripts, baseline all modules
12. Instrument `RFIDReader.h` — byte-level logging for NDEF investigation, capture sequences
13. NDEF byte-level tests — parser regression tests from captured sequences

### Phase 4: Test quality and organization
14. Backend shared mock factories (tests/helpers/mocks/)
15. Backend unit tests for adminEvents.js and broadcasts.js
16. Backend coverage gap tests (heartbeatMonitorService, models)
17. ALNScanner test file reorganization (mirror source paths)
18. ALNScanner coverage gaps (DisplayController, CommandSender)

### Phase 5: CI and documentation
19. Per-submodule CI workflows (update ALNScanner, new for others)
20. Parent repo CI workflow (backend tests + coverage ratchet + contract drift)
21. CLAUDE.md verification checkpoint documentation
22. ESP32 hardware investigation (unreliable detection + NDEF fallback diagnosis)
