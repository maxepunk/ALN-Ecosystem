# Code Simplification Audit — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Use **code-simplifier:code-simplifier** subagents for parallel batches within each phase. Verify tests pass at each checkpoint before proceeding.

**Goal:** Remove dead code, consolidate duplicates, align contracts with implementation, and clean up stale artifacts across all 41 production files touched by the Service Health Architecture plan.

**Architecture:** Five phases of increasing risk. Phases 1-2 are pure dead code removal (zero behavioral change). Phase 3 consolidates duplicated patterns via DRY extraction. Phase 4 aligns API contracts and routes with current implementation. Phase 5 polishes stale comments and minor inconsistencies. Within each phase, independent tasks are grouped into parallel batches for code-simplifier agents.

**Tech Stack:** Node.js (backend), ES6 modules (ALNScanner/Vite), Jest (both), Playwright (E2E)

**Test Baselines (verified 2026-02-27):** Backend unit+contract: 1303 tests, 68 suites. Integration: 255 tests, 30 suites. ALNScanner: 1007 tests, 56 suites. E2E: 122 passed, 28 skipped.

---

## Phase 1: Backend Dead Code Purge

**Risk:** Zero. All removals are confirmed-dead code with zero external callers.

**Execution:** Dispatch 3 parallel code-simplifier agents (Tasks 1, 2, 3). After all complete, run test checkpoint.

---

### Task 1: Purge stateService Deprecated Methods

**Context:** `stateService.js` was the old state-persistence layer. After the Session-derived architecture, 14 methods became dead wrappers that log deprecation warnings and do nothing. All confirmed zero external callers (only internal self-references remain). This is the single highest-value dead code removal.

**Files:**
- Modify: `backend/src/services/stateService.js`
- Modify: `backend/tests/unit/services/stateService.test.js`

**What to remove from `stateService.js`:**

1. **Dead methods (remove entirely — function body + JSDoc):**
   - `setCurrentState()` — deprecated no-op
   - `createDefaultState()` — deprecated, creates hardcoded GameState with fake teams
   - `createStateFromSession()` — deprecated wrapper
   - `syncFromSession()` — deprecated wrapper
   - `createStateDelta()` — deprecated, only consumer of `previousState`
   - `saveState()` — deprecated no-op
   - `startSyncInterval()` — deprecated no-op, called from `init()`
   - `stopSyncInterval()` — deprecated no-op, called from `startSyncInterval()` and `reset()`
   - `updateScores()` — deprecated wrapper around `updateState()`
   - `updateRecentTransactions()` — deprecated wrapper around `updateState()`
   - `isVideoPlaying()` — delegates to GameState, zero callers
   - `getRemainingVideoTime()` — delegates to GameState, zero callers
   - `getTeamScore()` — delegates to GameState, zero callers
   - `getWinningTeam()` — delegates to GameState, zero callers

2. **Dead properties (remove from constructor + reset()):**
   - `this.previousState` — only read by dead `createStateDelta()`
   - `this.syncInterval` — only managed by dead `startSyncInterval()`/`stopSyncInterval()`

3. **Dead internal references:**
   - Remove `this.startSyncInterval()` call from `init()`
   - Remove any internal event listener bindings that call dead methods (e.g., if `init()` binds `score:updated` → `updateScores`, remove that binding)
   - Remove `this.stopSyncInterval()` call from `reset()`

4. **Dead init() cleanup code (lines ~45-49):**
   - The one-time migration that loads `gameState:current` from persistence and deletes it. This was a one-time migration that has long since completed. Remove it.

5. **Fix `updateState()` misleading signature:**
   - `updateState(updates)` accepts an `updates` parameter but ignores it entirely (computes state from session). Remove the parameter from the method signature. Check if any caller passes arguments — if so, update call sites to pass nothing.

**What to remove from `stateService.test.js`:**
- Remove all test suites that exercise the dead methods listed above
- Keep tests for: `init()`, `getCurrentState()`, `updateState()`, `emitStateUpdate()`, `reset()`, and any event emission tests

**Step 1:** Read `stateService.js` and identify all internal bindings/references to dead methods
**Step 2:** Remove dead methods, properties, and internal references from `stateService.js`
**Step 3:** Remove corresponding test suites from `stateService.test.js`
**Step 4:** Run `cd backend && npx jest tests/unit/services/stateService.test.js --verbose`
**Step 5:** Run `cd backend && npx jest --silent` (full suite — ensure nothing else depended on removed methods)

---

### Task 2: Purge videoQueueService + vlcService Dead Code

**Context:** `videoQueueService.js` has a dead 48-line method, dead timer references, and an unused variable. `vlcService.js` has a dead method and duplicated cleanup logic.

**Files:**
- Modify: `backend/src/services/videoQueueService.js`
- Modify: `backend/src/services/vlcService.js`
- Modify: `backend/tests/unit/services/videoQueueService.test.js` (if dead method has tests)
- Modify: `backend/tests/unit/services/vlcService.test.js` (if dead method has tests)

**videoQueueService.js removals:**

1. **`waitForVlcState()` method (~48 lines):** Never called. Superseded by `waitForVlcLoaded()`. Remove the entire method. Remove any tests that cover it.

2. **Dead timer cleanup in `reset()`:** `this.fallbackTimer` and `this.monitoringDelayTimer` are cleared in `reset()` but never assigned anywhere in the service. Remove the cleanup lines for these non-existent timers. Keep `this.playbackTimer` cleanup (that timer IS used).

3. **Unused `vlcResponse` variable:** In the method that calls `vlcService.playVideo()`, the return value is assigned to `vlcResponse` but never read. Remove the variable — call `await vlcService.playVideo(videoPath)` without assigning.

**vlcService.js removals:**

4. **`addToPlaylist()` method:** Never called anywhere. Remove the entire method. Remove any tests that cover it.

5. **`reset()` duplicates `stopHealthCheck()`:** Lines in `reset()` that manually clear `this.healthCheckInterval` should be replaced with a call to `this.stopHealthCheck()`.

6. **`resetForTests` export wrapper:** `module.exports.resetForTests = () => module.exports.reset()` is a trivial wrapper. Replace with `module.exports.resetForTests = module.exports.reset` (direct reference) or remove entirely if tests can call `.reset()` directly. Check test usage first.

**Steps:**
**Step 1:** Remove dead code from `videoQueueService.js` (items 1-3)
**Step 2:** Remove dead code from `vlcService.js` (items 4-6)
**Step 3:** Update test files to remove tests for dead methods
**Step 4:** Run `cd backend && npx jest tests/unit/services/videoQueueService.test.js tests/unit/services/vlcService.test.js --verbose`
**Step 5:** Run `cd backend && npx jest --silent` (full suite)

---

### Task 3: Purge Websocket Layer Dead Code

**Context:** `broadcasts.js` has deprecated event listeners. `deviceTracking.js` exports a dead function. `server.js` has a duplicate of that function. `app.js` has an unused import.

**Files:**
- Modify: `backend/src/websocket/broadcasts.js`
- Modify: `backend/src/websocket/deviceTracking.js`
- Modify: `backend/src/app.js`
- Modify: `backend/tests/unit/websocket/broadcasts.test.js` (if deprecated listeners have tests)

**broadcasts.js:**

1. **Remove `state:update` broadcast listener:** The `addTrackedListener(stateService, 'state:updated', ...)` block that broadcasts `state:update` to the GM room. Verified: `state:update` is NOT in ALNScanner's `orchestratorClient.js` messageTypes array — no client listens to this event. The AsyncAPI contract says it is "eliminated."

2. **Remove `state:sync` broadcast listener:** The `addTrackedListener(stateService, 'state:sync', ...)` block that broadcasts `state:sync`. Same verification — no client listens.

3. **Remove stale comment** about `team:created` listener removal (if present).

**deviceTracking.js:**

4. **Remove dead `handleSyncRequest` export:** This function is exported but never imported by any other file. `server.js` has its own inline copy of the same logic (lines ~80-99). Remove the function and its export. Keep other exports in the file.

**app.js:**

5. **Remove unused `ValidationError` import:** Line `const { ValidationError } = require('./utils/validators')` — `ValidationError` is never referenced in `app.js`.

**Steps:**
**Step 1:** Remove items 1-5 above
**Step 2:** Remove corresponding test assertions for deprecated broadcast listeners
**Step 3:** Run `cd backend && npx jest tests/unit/websocket/ --verbose`
**Step 4:** Run `cd backend && npx jest --silent` (full suite)

---

### Phase 1 Checkpoint

```bash
cd backend && npx jest --silent
cd backend && npx jest --config jest.integration.config.js --silent
```

**Expected:** Same pass counts as baseline (1303 unit+contract, 255 integration). Commit after passing.

**Commit message:** `refactor: purge dead code from stateService, videoQueueService, vlcService, broadcasts`

---

## Phase 2: ALNScanner Dead Code Purge

**Risk:** Zero. All removals are confirmed-dead HTML elements, CSS rules, and JS references to removed DOM elements.

**Execution:** Dispatch 2 parallel code-simplifier agents (Tasks 4+5 together, Task 6 separate). After all complete, run test checkpoint.

---

### Task 4: Purge Dead CSS

**Context:** `environment.css` has ~99 lines of dead CSS from prior UI designs that were replaced during Phase 4.

**Files:**
- Modify: `ALNScanner/src/styles/components/environment.css`

**Remove these dead CSS rule groups:**

1. **`.cue-held-banner` and all children (~59 lines):** `.cue-held-banner`, `.cue-held-banner__info`, `.cue-held-banner__icon`, `.cue-held-banner__text`, `.cue-held-banner__actions`, `@keyframes held-slide-in`. These were the old CueRenderer held item UI, replaced by HeldItemsRenderer which uses different class names (`held-item`, `held-items`).

2. **`.audio-route-row`, `.audio-route-label`, `.audio-route-select` (~40 lines):** Never used. EnvironmentRenderer uses `.audio-control-item` and `.form-select` instead.

3. **`.scene-tile__icon` and `.scene-tile__label`:** Never generated by any renderer. EnvironmentRenderer creates `<button class="scene-tile">` with text content only.

4. **`.section-badge--connected` and `.section-badge--error`:** Never applied by any JS. The elements with class `section-badge` exist in HTML but no JS adds these modifier classes.

**Steps:**
**Step 1:** Remove dead CSS rules (items 1-4)
**Step 2:** Run `cd ALNScanner && npm test -- --silent`
**Step 3:** Visually verify no breakage by checking that the remaining CSS rules are all referenced by renderers (grep for class names in `src/`)

---

### Task 5: Purge Dead HTML + QUnit Infrastructure

**Context:** `index.html` has 5 orphaned DOM IDs that no JS references, stale migration comments, and a QUnit test framework that loads on every page but has zero tests.

**Files:**
- Modify: `ALNScanner/index.html`

**Remove these dead DOM elements:**

1. **`#bt-unavailable` div:** Never referenced by any JS in `src/`. EnvironmentRenderer handles empty state inline.

2. **`#lighting-no-scenes` div:** Never referenced by any JS. EnvironmentRenderer handles empty scene state inline.

3. **`#ha-connection-status` span:** Inside Lighting section header. Never referenced by any JS. HealthRenderer now handles connection status.

4. **`#video-info` block** (includes `#admin-current-video`, `#admin-queue-length`): Marked "Legacy display info (kept for backwards compatibility)" but hidden by default and never shown by any JS.

5. **QUnit infrastructure (CDN link + script + `#websocket-tests` container):** QUnit CSS link, QUnit JS script, and the entire `#websocket-tests` hidden container with `#qunit` and `#qunit-fixture` divs. Verified: zero QUnit tests exist anywhere in the codebase. Tests use Jest + Playwright.

6. **Stale migration comment blocks:** Three comment blocks documenting Phase 2.2.3, 2.4 migrations and Connection Wizard migration to ES6 modules. These are historical documentation embedded in HTML. Remove.

7. **"Debug Panel (Legacy)" tombstone comment.**

**Steps:**
**Step 1:** Remove items 1-7 from `index.html`
**Step 2:** Run `cd ALNScanner && npm test -- --silent`
**Step 3:** Verify no test references these DOM IDs (grep `src/` for removed IDs to double-check)

---

### Task 6: Purge Dead JS References

**Context:** EnvironmentRenderer references a removed DOM element. MonitoringDisplay has dead properties. CueRenderer and domEventBindings have tombstone comments.

**Files:**
- Modify: `ALNScanner/src/ui/renderers/EnvironmentRenderer.js`
- Modify: `ALNScanner/src/admin/MonitoringDisplay.js`
- Modify: `ALNScanner/src/ui/renderers/CueRenderer.js`
- Modify: `ALNScanner/src/utils/domEventBindings.js`

**EnvironmentRenderer.js:**

1. **Remove `this.lightingNotConnected` property** from constructor. This references `document.getElementById('lighting-not-connected')` which was removed from `index.html` in Phase 4 — always `null`.

2. **Remove all guards/usages** of `this.lightingNotConnected` (two locations where it checks and hides the element — both are dead branches).

3. **Remove 24-line stream-of-consciousness comment** in `renderAudio()` (the "Let's check if UnifiedDataManager stores availableSinks" block). Replace with a 1-line comment summarizing what actually happens.

**MonitoringDisplay.js:**

4. **Remove `_currentIdleMode` property** from constructor and its write in `_handleDisplayMode()`. This value is written but never read.

5. **Remove `sound:status` no-op case** from the event handler switch. It explicitly does nothing and has done nothing since Phase 1.

6. **Trim `updateAllDisplays()` comment blocks.** Sections 1, 3, 4, 5, 6 are entirely comments describing what other code does. Condense to 1-line comments per section.

7. **Update "Phase 4 DM migration candidates" comment** — Phase 4 is complete. Either remove the comment or update it to say what the current status is.

8. **Clarify "replaced by HealthRenderer" comment** near `updateSystemDisplay()` call — the comment says "replaced" but the code still calls the method. Either remove the call or fix the comment to explain why both exist.

**CueRenderer.js:**

9. **Remove tombstone comment** `// renderHeldItem() removed in Phase 4 -- replaced by HeldItemsRenderer`. Git history records this.

**domEventBindings.js:**

10. **Remove tombstone comment** `// lightingRetry removed -- Phase 4 HealthRenderer handles service health`. Git history records this.

**Steps:**
**Step 1:** Make all changes (items 1-10)
**Step 2:** Run `cd ALNScanner && npm test -- --verbose`
**Step 3:** Run `cd ALNScanner && npm test -- --silent` (full suite)

---

### Phase 2 Checkpoint

```bash
cd ALNScanner && npm test -- --silent
```

**Expected:** Same pass count as baseline (1007 tests, 56 suites). Commit after passing.

**Commit message:** `refactor: purge dead CSS, HTML, and JS from ALNScanner`

---

## Phase 3: DRY Extractions

**Risk:** Low. Replacing duplicate implementations with shared code. No behavioral change, but each extraction touches multiple files.

**Execution:** Tasks 7 and 8 can run in parallel (different codebases). Task 9 depends on nothing.

---

### Task 7: Extract Shared `_escapeHtml` Utility (ALNScanner)

**Context:** `_escapeHtml()` is copy-pasted identically across 6 files: HealthRenderer, HeldItemsRenderer, CueRenderer, EnvironmentRenderer, SpotifyRenderer, MonitoringDisplay. Extract to a shared utility module.

**Files:**
- Create: `ALNScanner/src/utils/escapeHtml.js`
- Create: `ALNScanner/tests/unit/utils/escapeHtml.test.js`
- Modify: `ALNScanner/src/ui/renderers/HealthRenderer.js` — remove `_escapeHtml`, import shared
- Modify: `ALNScanner/src/ui/renderers/HeldItemsRenderer.js` — same
- Modify: `ALNScanner/src/ui/renderers/CueRenderer.js` — same
- Modify: `ALNScanner/src/ui/renderers/EnvironmentRenderer.js` — same
- Modify: `ALNScanner/src/ui/renderers/SpotifyRenderer.js` — same
- Modify: `ALNScanner/src/admin/MonitoringDisplay.js` — same

**Step 1: Write the test**

```javascript
// ALNScanner/tests/unit/utils/escapeHtml.test.js
import { escapeHtml } from '../../../src/utils/escapeHtml.js';

describe('escapeHtml', () => {
  it('escapes ampersands', () => {
    expect(escapeHtml('a&b')).toBe('a&amp;b');
  });

  it('escapes angle brackets', () => {
    expect(escapeHtml('<script>')).toBe('&lt;script&gt;');
  });

  it('escapes double quotes', () => {
    expect(escapeHtml('"hello"')).toBe('&quot;hello&quot;');
  });

  it('escapes single quotes', () => {
    expect(escapeHtml("it's")).toBe("it&#039;s");
  });

  it('handles null/undefined gracefully', () => {
    expect(escapeHtml(null)).toBe('');
    expect(escapeHtml(undefined)).toBe('');
    expect(escapeHtml('')).toBe('');
  });

  it('returns non-string values as empty string', () => {
    expect(escapeHtml(42)).toBe('');
    expect(escapeHtml({})).toBe('');
  });
});
```

**Step 2:** Run test, verify it fails: `cd ALNScanner && npx jest tests/unit/utils/escapeHtml.test.js`

**Step 3: Create the shared utility**

```javascript
// ALNScanner/src/utils/escapeHtml.js
/**
 * Escape HTML special characters to prevent XSS.
 * @param {*} str - Value to escape (non-strings return '')
 * @returns {string} Escaped HTML string
 */
export function escapeHtml(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
```

**Step 4:** Run test, verify it passes: `cd ALNScanner && npx jest tests/unit/utils/escapeHtml.test.js`

**Step 5:** In each of the 6 files, add `import { escapeHtml } from '../utils/escapeHtml.js';` (adjust relative path per file location) and remove the local `_escapeHtml()` method. Replace all internal calls from `this._escapeHtml(x)` to `escapeHtml(x)`.

**Step 6:** Run full suite: `cd ALNScanner && npm test -- --silent`

---

### Task 8: Consolidate commandExecutor `require()` Calls

**Context:** `commandExecutor.js` has redundant inline `require()` calls. `videoQueueService` is re-required 4 times in `held:*` cases despite being imported at the top of the file. `spotifyService` is required 5 times inline with no circular dependency. Only `cueEngineService` has a documented reason for lazy loading (circular dependency).

**Files:**
- Modify: `backend/src/services/commandExecutor.js`

**Step 1:** Add `const spotifyService = require('./spotifyService');` to the top-level imports (near other service imports).

**Step 2:** Remove all inline `const spotifyService = require('./spotifyService')` from inside the Spotify case blocks.

**Step 3:** Remove all inline `require('./videoQueueService')` from inside the `held:release`, `held:discard`, `held:release-all`, `held:discard-all` case blocks — `videoQueueService` is already imported at the top of the file.

**Step 4:** Add a comment near the `cueEngineService` lazy require explaining WHY it is lazy: `// Lazy require: circular dependency (commandExecutor ↔ cueEngineService)`

**Step 5:** While here, fix the inconsistent `cueId` validation: `cue:fire`, `cue:enable`, `cue:disable` should validate `payload.cueId` the same way `cue:stop`/`cue:pause`/`cue:resume` do (throw if missing).

**Step 6:** Run `cd backend && npx jest tests/unit/services/commandExecutor.test.js --verbose`
**Step 7:** Run `cd backend && npx jest --silent`

---

### Task 9: Consolidate Backend Service Patterns

**Context:** Several minor DRY/consistency fixes across backend services that don't warrant individual tasks.

**Files:**
- Modify: `backend/src/services/spotifyService.js`
- Modify: `backend/src/services/bluetoothService.js`
- Modify: `backend/src/services/soundService.js`
- Modify: `backend/src/services/cueEngineService.js`

**spotifyService.js — Consolidate discover helpers:**

1. `_discoverDbusDest()` and `_discoverSpotifydDest()` follow the exact same pattern: check cache TTL → call `_findDbusDest()` → update cache on success → clear on failure. Extract a shared `_discoverDest(cacheField, cacheTimeField, pattern, label)` helper and have both methods delegate to it.

**bluetoothService.js — Delegate init to checkHealth:**

2. `init()` and `checkHealth()` both call `this.isAvailable()` and report to registry with near-identical messages. Refactor `init()` to call `await this.checkHealth()` and add its own `logger.info` line.

3. Remove duplicate JSDoc blocks on `stopScan()` (two consecutive JSDoc comments). Keep the more detailed one.

4. Remove duplicate JSDoc blocks on `pairDevice()` (two consecutive JSDoc comments). Merge useful info into one.

**soundService.js — Delegate init to checkHealth:**

5. Same pattern as bluetoothService. Refactor `init()` to call `await this.checkHealth()` and add logging.

**cueEngineService.js — Remove dead data from held records:**

6. `_holdCue()` stores `commands` and `timeline` on the held record, but `releaseCue()` never reads them (re-fires by `cueId` from `this.cues`). Remove the dead fields from the held record.

**Steps:**
**Step 1:** Make all 6 changes
**Step 2:** Run affected tests: `cd backend && npx jest tests/unit/services/spotifyService.test.js tests/unit/services/bluetoothService.test.js tests/unit/services/soundService.test.js tests/unit/services/cueEngineService.test.js --verbose`
**Step 3:** Run `cd backend && npx jest --silent`

---

### Phase 3 Checkpoint

```bash
cd backend && npx jest --silent
cd backend && npx jest --config jest.integration.config.js --silent
cd ALNScanner && npm test -- --silent
```

**Expected:** Same pass counts as baseline. Commit after passing.

**Commit message:** `refactor: DRY extraction — shared escapeHtml, consolidated requires and service patterns`

---

## Phase 4: Contract & Route Alignment

**Risk:** Medium. Changes API response shape and contract definitions. The `GET /api/state` endpoint is used for debug/recovery (not by scanners in normal operation), but contract changes could affect tooling that reads the specs.

**Execution:** Sequential — Task 10 first (changes implementation), Task 11 second (aligns contracts).

---

### Task 10: Rewrite stateRoutes to Use buildSyncFullPayload

**Context:** `GET /api/state` manually constructs a state snapshot that diverges from `sync:full` in 7 missing fields (`playerScans`, `environment`, `gameClock`, `cueEngine`, `spotify`, `heldItems`, `videoStatus` shape). It also has 3 stale TODO comments for problems already solved in `syncHelpers.js`. Rewriting to delegate to `buildSyncFullPayload()` eliminates the divergence and ~40 lines of duplicate state assembly.

**Files:**
- Modify: `backend/src/routes/stateRoutes.js`
- Modify: `backend/tests/contract/http/state.test.js` (update expected response shape)

**Step 1:** Read `stateRoutes.js` current implementation and `syncHelpers.js` `buildSyncFullPayload()` to understand both shapes.

**Step 2:** Rewrite the `GET /api/state` handler to call `await buildSyncFullPayload()` and return the result, keeping any route-specific additions (like `session` wrapping) but removing the manual state construction.

**Step 3:** Update `state.test.js` contract test to expect the new response shape (matching `sync:full` structure).

**Step 4:** Run `cd backend && npx jest tests/contract/http/state.test.js --verbose`
**Step 5:** Run `cd backend && npx jest --silent`

---

### Task 11: Update AsyncAPI + OpenAPI Contracts

**Context:** Several WebSocket events are broadcast in code but missing from the AsyncAPI contract. The OpenAPI `GameState` schema is missing Phase 1-4 fields. The `/api/scan` 202 response schema doesn't match implementation.

**Files:**
- Modify: `backend/contracts/asyncapi.yaml`
- Modify: `backend/contracts/openapi.yaml`
- Modify: `backend/src/utils/validators.js` (minor fix)

**asyncapi.yaml:**

1. **Add missing event definitions:**
   - `video:progress` — payload: `{tokenId, progress, position, duration}`
   - `video:queue:update` — payload: `{items, length}`
   - `audio:sinks` — payload: `{action: 'added'|'removed', sink: {...}}`

2. **Remove or explicitly deprecate `state:update` and `state:sync`:** The contract description already says "eliminated" but the channel definitions may still exist. Make it unambiguous.

**openapi.yaml:**

3. **Update `GameState` schema** to include Phase 1-4 fields now served by `GET /api/state` (after Task 10 rewrites it to use `buildSyncFullPayload`):
   - `playerScans` (array)
   - `environment` (object with bluetooth, audio, lighting)
   - `gameClock` (object)
   - `cueEngine` (object)
   - `spotify` (object)
   - `heldItems` (array)

4. **Fix `/api/scan` 202 response schema:** Replace `queuePosition` with `transactionId` and `queued` to match actual implementation.

**validators.js:**

5. **Fix `sessionUpdateSchema` status enum:** Remove `'completed'` and `'archived'` — these are not valid session statuses. Valid statuses are: `['setup', 'active', 'paused', 'ended']`.

**Steps:**
**Step 1:** Make contract changes (items 1-5)
**Step 2:** Run `cd backend && npx jest tests/contract/ --verbose`
**Step 3:** Run `cd backend && npx jest --silent`

---

### Phase 4 Checkpoint

```bash
cd backend && npx jest --silent
cd backend && npx jest --config jest.integration.config.js --silent
```

**Expected:** Same pass counts as baseline (contract tests may need updates to match new shapes). Commit after passing.

**Commit message:** `refactor: align stateRoutes with sync:full, update API contracts`

---

## Phase 5: Polish & Consistency

**Risk:** Minimal. Stale comments, minor naming fixes, style consistency. All optional — skip if time-constrained.

**Execution:** Dispatch 2 parallel code-simplifier agents (Tasks 12 and 13).

---

### Task 12: Backend Polish

**Files:**
- Modify: `backend/src/services/audioRoutingService.js`
- Modify: `backend/src/services/lightingService.js`
- Modify: `backend/src/services/cueEngineService.js`
- Modify: `backend/src/services/systemReset.js`
- Modify: `backend/src/server.js`
- Modify: `backend/src/websocket/broadcasts.js`
- Modify: `backend/src/websocket/syncHelpers.js`
- Modify: `backend/src/routes/scanRoutes.js`

**Changes:**

1. **audioRoutingService.js:** Remove stale "Phase 0: only video" comments (3 locations). Remove thinking-out-loud comments in `_generateSinkLabel()` (~4 lines). Initialize `_combineSinkModuleId` in constructor (consistency with all other properties).

2. **lightingService.js:** Fix `getScenes()` condition — `!registry.isHealthy('lighting') && !config.lighting.homeAssistantToken` should likely be `||` (fall through to fallback when EITHER condition is true, not only when BOTH are). Verify by reading the catch block fallback behavior. If intent is truly `&&`, add a comment explaining why.

3. **cueEngineService.js:** Replace Phase labels in section comments ("Phase 1", "Phase 2") with descriptive names that explain what the sections do (e.g., "Held cue system", "Compound cue execution"). Remove `async` from `pauseCue()` and `resumeCue()` if they contain no `await` (check first — if they call async methods via `.then()` rather than `await`, keep `async`).

4. **systemReset.js:** Move inline `require('fs').promises` and `require('path')` to top-level imports for consistency.

5. **server.js:** Fix comment that references deprecated `score:updated` event — update to reflect current event architecture.

6. **broadcasts.js:** Extract `(videoQueueService.queue || []).length` pattern (used 8 times) into a local helper `const getQueueLength = () => (videoQueueService.queue || []).length;`.

7. **syncHelpers.js:** Update file header comment to list all call sites (currently only lists 2 of 4+).

8. **scanRoutes.js:** Remove 3 redundant null checks on `token` after 404 guard already returned. Fix stale comment referencing specific line numbers in tokenService.js — use function name instead.

**Steps:**
**Step 1:** Make all changes
**Step 2:** Run `cd backend && npx jest --silent`

---

### Task 13: ALNScanner Polish

**Files:**
- Modify: `ALNScanner/src/core/unifiedDataManager.js`
- Modify: `ALNScanner/src/network/orchestratorClient.js`
- Modify: `ALNScanner/src/admin/MonitoringDisplay.js`

**Changes:**

1. **unifiedDataManager.js:** Fix `foundedDevices` → `discoveredDevices` typo. This is consistently misspelled across `unifiedDataManager.js` and `EnvironmentRenderer.js`. Search for all occurrences and rename. Also update `EnvironmentRenderer.js` if it references `foundedDevices`.

2. **orchestratorClient.js:** Fix misleading "Phase 4.2" comment on `display:mode` entry in messageTypes (this event predates Phase 4). Remove or fix stale phase comments.

3. **MonitoringDisplay.js:** Clarify the `updateSystemDisplay()` comment. Currently says "replaced by HealthRenderer (Phase 4)" but then immediately calls the old method. Either: (a) remove the call if HealthRenderer fully replaces it, or (b) update the comment to explain why both coexist (e.g., "HealthRenderer handles the dashboard; this dot shows simple connection state").

**Steps:**
**Step 1:** Make all changes
**Step 2:** Run `cd ALNScanner && npm test -- --silent`

---

### Phase 5 Checkpoint

```bash
cd backend && npx jest --silent
cd backend && npx jest --config jest.integration.config.js --silent
cd ALNScanner && npm test -- --silent
```

**Expected:** Same pass counts as baseline. Commit after passing.

**Commit message:** `refactor: polish stale comments, fix naming, minor consistency`

---

## Final Verification

After all 5 phases, run the full E2E suite to verify no integration-level regressions:

```bash
cd backend && npx playwright test --reporter=list
```

**Expected:** 122 passed, 28 skipped, 0 failed.

---

## Findings Deferred (Not in This Plan)

These findings were identified in the audit but are deferred because they involve behavioral changes, design decisions, or cross-cutting refactors that go beyond simplification:

| Finding | Reason Deferred |
|---------|-----------------|
| `SpotifyRenderer.renderDucking()` ordering dependency | Requires design decision on where to embed the ducking indicator |
| `lightingService._loadFallbackScenes()` loads test fixtures | Needs decision on what the production fallback should be |
| `checkService()` misplaced on SpotifyController | Requires creating a new controller class — scope creep |
| `app.js` (ALNScanner) admin action method duplication (7x) | Large refactor, needs its own plan |
| `unifiedDataManager.getSessionStats()` bug (`this.app` never set) | Needs investigation of intended behavior |
| `orchestratorClient.js` duplicate `socket:connected` dispatch | Needs analysis of reconnection flow impact |
| `unifiedDataManager.resetForNewSession()` breaks strategy encapsulation | Design refactor, not simplification |
| Held items sync is O(n) renders on reconnect | Performance optimization, not simplification |
| `gameState.js` video methods may be vestigial | Needs broader analysis of GameState consumers |
| `stateService.updateState()` ignores its `updates` parameter | Part of larger stateService architecture cleanup |
| `stateService.emitStateUpdate()` debounce may replay stale state | Requires careful analysis of race conditions |
| EnvironmentRenderer + SessionRenderer 4-space vs 2-space indentation | Style-only change across large files |
| EnvironmentRenderer + SessionRenderer lack constructor injection | Testability improvement, not simplification |
| domEventBindings 6 identical cue switch cases | Refactor, needs own task |
| scanRoutes batch endpoint doesn't persist player scans | Behavioral change, needs product decision |
