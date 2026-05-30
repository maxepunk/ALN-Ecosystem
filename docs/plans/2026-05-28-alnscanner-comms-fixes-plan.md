# ALNScanner Communication-Layer Fixes — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Remediate the 65 verified findings from the GM Scanner communication review (`docs/plans/2026-05-28-alnscanner-comms-review.md`) — eliminating the reconnect-churn and lost-scan failure modes and the contract/test drift that let them ship — via strict TDD.

**Architecture:** Five phases, ordered so that fixing a few *roots* collapses their downstream issues. Phase 0 lands a test safety net first (so the rest is genuine TDD and the phantom-mocks that defended the bugs are dismantled). Phases 1–2 fix the two CRITICAL/HIGH root clusters (reconnect/lifecycle; transaction durability). Phase 3 makes failures operator-visible. Phase 4 closes contract drift and the remaining medium/low hardening. Every task is RED → GREEN → COMMIT.

**Tech Stack:** GM Scanner = ES6 modules + Vite + Jest (jsdom). Backend orchestrator = Node + Jest, with AsyncAPI (`backend/contracts/asyncapi.yaml`) and OpenAPI (`backend/contracts/openapi.yaml`) as the contract source of truth. Socket.io transport. **Contract-first:** any change crossing the wire updates the contract + backend (with a backend test) BEFORE the scanner consumer.

---

## Before you start

- **Work on a branch or worktree — not `main`.** e.g. `git checkout -b fix/alnscanner-comms` (or a dedicated worktree). Commit after every task.
- **The TDD loop for every task (do not batch):** write the failing test → run it and confirm the exact FAIL message → minimal implementation → run and confirm PASS → `git commit`.
- **Run commands** (verified by the drafting agents):
  - GM Scanner unit test: `cd ALNScanner && npx jest <path> -t "<name>"`
  - Backend unit/contract test: `cd backend && npx jest <path> -t "<name>"`
  - Per-component coverage ratchet (pre-merge): `npm run coverage:check`
- **Per-finding source of truth:** the review doc `docs/plans/2026-05-28-alnscanner-comms-review.md` — grep the finding ID (e.g. `RL-1`, `TQ-2`) for the full description, evidence, and rationale.
- **Re-verify file:line references before editing.** This plan was drafted against the current tree, but line numbers drift; open the file and confirm the anchor before applying an edit.
- **Service-worker / build tasks:** rebuild `dist/` (`cd ALNScanner && npm run build`) — `backend/public/gm-scanner` is a symlink to `ALNScanner/dist`, and E2E tests serve stale code otherwise.

## Phase overview

| Phase | Theme | Tasks | Why it's here |
|------:|-------|:----:|---------------|
| **0** | Test safety net & phantom-mock teardown | 5 | makes TDD real; dismantles the tests that *defended* the bugs |
| **1** | Reconnect & lifecycle resilience | 14 | the two CRITICAL/HIGH churn roots (RL-1, RL-2, SW-1) |
| **2** | Transaction durability | 10 | the lost-scan CRITICAL (TQ-1/TQ-2) + the `error` consumer |
| **3** | Operator-visible error surfacing | 3 | makes Phases 1–2 observable during a show |
| **4** | Contract drift & remaining hardening | 35 | closes the long tail (NFC, auth/HTTP, renderers, contracts) |

Phase 1 = **P1a** (reconnect logic, 7) + **P1b** (lifecycle + service worker, 4) + **P1c** (connect-time HTTP, 3).
Phase 4 = **P4a** (contract drift, 10) + **P4b** (NFC, 5) + **P4c** (auth/HTTP, 8) + **P4d** (renderers/state, 12).

## Sequencing & cross-phase dependencies (read before reordering)

1. **Phase 0 lands first.** Three of its tests deliberately START RED and turn green as later phases land — commit them red (or as `it.failing`) per each task's Step 5:
   - **P0.2** (GmCommand action-enum) ↔ goes green when **P4d** deletes the dead `system:restart`/`system:clear` (AC-1/CC-6).
   - **P0.4** (forwarding-list vs AsyncAPI subscribe set) ↔ goes green after **P0.3** export + a contract reconciliation (add `BatchAck`/`PlayerScan` to the subscribe `oneOf`, or prune client orphans; decide `scoreboard:page` direction).
   - **P0.5** (`dist/sw.js` exists) ↔ goes green when **P1b** makes the build emit a real service worker (SW-1).
2. **Pull P4b.1 forward into Phase 1.** P1b's "abort the NFC scan when hidden" (NFC-3) depends on the `AbortController` introduced by **P4b.1** (NFC-1). Do **P4b.1 before P1b's NFC-3 task**.
3. **Contract-first, in separate commits.** Tasks editing `asyncapi.yaml` / `openapi.yaml` (**P2.1** status enum, **P4a.3** SyncFull schema, **P4a.5** SyncRequest, **P4a.7** device `connectionStatus`) precede their scanner consumers. P0, P2, and P4a all touch `asyncapi.yaml` — land each contract edit as its own commit to keep merges clean. P4a and P4d both touch `EnvironmentRenderer.js` and `app.js` — coordinate edit order.
4. **Phase 2 before P3.3.** P3's `AUTH_*` routing (AUTH-7) rides on the `error`-event consumer added in Phase 2 (CC-4/WS-3).

## The dependency-collapse principle (why the order matters)

Do **not** reorder to "knock out the easy lows first." Each phase's roots dissolve their downstream mediums/lows, so doing the roots first deletes work:

- **Phase 1 roots** — RL-1 (auto-reconnect on transport drops), RL-2 (page-lifecycle / BFCache), SW-1 (ship the service worker) — **dissolve** RL-3, RL-5, AUTH-1, RL-6, RL-7, SW-2, SW-3, HTTP-1, HTTP-5, NFC-3 (they're the same churn seen from other angles, or downstream consequences).
- **Phase 2 roots** — TQ-1 (persist-before-emit), TQ-2 (clear only on definitive result), + the `error` consumer — **dissolve** TQ-3, TQ-4, TQ-6, TQ-7.
- **Phase 0** **dismantles** the "phantom-mock" pattern (AC-4, CC-5, SR-1, WS-2, SW-4) — tests that mocked the wrong contract shape and passed against it, which is *how* the two criticals shipped under a green suite.

## Open decisions to confirm during execution

- **CC-8b / P4a.6–8:** confirm via a live `GET /api/state` (with a connected GM) whether `devices[].connectionStatus` is present. Code inspection says it's omitted (the `syncHelpers` device `.map()` doesn't call `DeviceConnection.toJSON()`); if a running orchestrator proves otherwise, skip P4a.7/.8.
- **NFC-5 / P4b:** confirm the production NFC tag encoding before deleting the URL-record branch. If URL tags are in use, switch to token-segment extraction instead of deletion.
- **CC-3 / P4a.5:** `sync:request` currently has no envelope and no payload; the plan documents it as-is and **defers** migrating the client to the envelope (that needs a server-handler change and risks breaking live admin refresh). Decide separately.
- **HTTP-8 / P4c.8:** `GET /api/videos` does **not** exist in the contract or backend — resolved as a docs fix, not an implementation, unless a video-picker feature is built (which would be its own contract-first effort).

---

# Phase 0 — Test Safety Net & Phantom-Mock Teardown

**Land this first.** These tasks build the regression guard the rest of the plan relies on and tear down the tests that actively certified the bugs. Three assertions (P0.2 action-enum, P0.4 forwarding-vs-contract, P0.5 `dist/sw.js`) intentionally **start RED** and are turned green by later phases — that's the safety net working. P0.3 (export `MESSAGE_TYPES`) must precede P0.4.

### Task P0.1: Tear down the AdminOperations phantom-mock so it can no longer cement contract-violating action names (AC-4)

The `AdminOperations` unit test mocks `sendCommand` to unconditionally resolve `{success:true}`, then asserts that `restartSystem()` emits `'system:restart'` and `clearData()` emits `'system:clear'`. Those two action strings are NOT in the AsyncAPI `GmCommand` enum (verified: the enum has 57 actions; `system:restart`/`system:clear` are absent — the contract-defined action is `system:reset`). The backend `commandExecutor` returns "Unknown action" for both. The phantom mock makes the test pass while production is broken, actively locking in the bad names. This task removes the two phantom assertions so the conformance test in P0.2 becomes the single source of truth for action-string validity. The methods themselves stay (they have zero callers — deletion is deferred to the AC-1/CC-6 fix in a later phase) but they are no longer asserted by an always-success mock.

**Files:**
- Test (Modify): `/home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/ALNScanner/tests/unit/admin/AdminOperations.test.js:25-45` (the `restartSystem` and `clearData` describe blocks, lines 25-45)

Real current code being removed (verified at `tests/unit/admin/AdminOperations.test.js:25-45`):

```javascript
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
```

**Step 1 — Write the failing test:** This is a removal-of-bad-assertion task, so the "failing" signal is captured by P0.2's conformance test (which RED-exposes the same two strings). To make the intent explicit and self-documenting here, replace the two phantom describe blocks with a single guard test that asserts these methods do NOT emit a non-contract action. Add this to `tests/unit/admin/AdminOperations.test.js` in place of lines 25-45:

```javascript
  // AC-4: these methods emit action strings that are NOT in the AsyncAPI
  // GmCommand enum (system:restart / system:clear). They have zero callers.
  // We must NOT assert the exact bad string (that cements the contract
  // violation). Instead, assert they are not silently wired to a contract
  // action. Real validity of every controller action is enforced by the
  // action-enum conformance test (gmCommandActionConformance.test.js).
  describe('non-contract emergency methods (AC-4)', () => {
    const CONTRACT_ACTIONS = new Set([
      'session:create', 'session:start', 'session:pause', 'session:resume', 'session:end',
      'score:adjust', 'score:reset', 'transaction:delete', 'system:reset', 'service:check'
    ]);

    it('restartSystem does NOT emit a contract-defined action (it is dead/non-conformant)', async () => {
      await ops.restartSystem();
      const action = sendCommand.mock.calls[0][1];
      expect(CONTRACT_ACTIONS.has(action)).toBe(false);
    });

    it('clearData does NOT emit a contract-defined action (it is dead/non-conformant)', async () => {
      await ops.clearData();
      const action = sendCommand.mock.calls[0][1];
      expect(CONTRACT_ACTIONS.has(action)).toBe(false);
    });
  });
```

**Step 2 — Run it (expect PASS immediately, because this task only removes a false assertion):**
Run: `cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/ALNScanner && npx jest tests/unit/admin/AdminOperations.test.js`
Expected: PASS — `Tests: 8 passed, 8 total` (the two old `system:restart`/`system:clear` assertions are gone; two new guard tests replace them; the other 6 tests — resetScores, adjustScore ×2, deleteTransaction, checkService, destroy — still pass). There is no production code change in this task, so there is no separate RED→GREEN cycle; the RED proof for the bad strings lives in P0.2.

**Step 3 — Minimal implementation:** None. This task is pure test-hygiene (removing the phantom-mock assertions). The actual deletion/rename of `restartSystem`/`clearData` is owned by the later AC-1/CC-6 fix; this task only stops the test from asserting the contract-violating strings.

**Step 4 — Re-run to confirm:**
Run: `cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/ALNScanner && npx jest tests/unit/admin/AdminOperations.test.js`
Expected: PASS — `Tests: 8 passed, 8 total`.

**Step 5 — Commit:**
```bash
cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/ALNScanner
git add tests/unit/admin/AdminOperations.test.js
git commit -m "test(admin): stop phantom-mock from locking in non-contract action names (AC-4)

The AdminOperations test mocked sendCommand to always succeed, then asserted
restartSystem()/clearData() emit 'system:restart'/'system:clear' — strings that
are NOT in the AsyncAPI GmCommand enum (backend returns 'Unknown action').
Replace those assertions with guards that the methods do NOT emit a contract
action. Real action-string validity is now enforced by the conformance test.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task P0.2: Add the GmCommand action-enum conformance test (RED-exposes AC-1/CC-6)

Introduce a contract conformance test that parses the AsyncAPI `GmCommand` action enum and asserts every action string emitted by the admin controllers is a member. This is the safety net that makes any future action-string drift a hard test failure. `js-yaml@3.14.1` is already resolvable from ALNScanner (verified `require('js-yaml')` works and loads `../backend/contracts/asyncapi.yaml` from this cwd). The test scans the controller source files for `sendCommand(this.connection, '<action>', ...)` call sites — the canonical controller dispatch pattern used by `SessionManager`, `CueController`, `MusicController`, `AdminOperations`, etc. **This test will START RED**: it will fail on exactly two actions — `system:restart` and `system:clear` from `AdminOperations.js:29` and `:37` — proving AC-1/CC-6. It stays red until the later-phase fix deletes/renames those methods.

**Files:**
- Test (Create): `/home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/ALNScanner/tests/unit/network/gmCommandActionConformance.test.js`

Context — the real enum source (verified at `backend/contracts/asyncapi.yaml:1453-1513`):

```yaml
              action:
                type: string
                description: Command action type
                enum:
                  - session:create
                  - session:addTeam
                  ...
                  - system:reset
                  ...
                  - service:check
```

Context — the real controller dispatch pattern (verified, e.g. `src/admin/SessionManager.js:31`):

```javascript
  async createSession(name, teams = []) {
    return sendCommand(this.connection, 'session:create', { name, teams });
  }
```

And the two non-conformant call sites (verified `src/admin/AdminOperations.js:28-38`):

```javascript
  async restartSystem() {
    return sendCommand(this.connection, 'system:restart', {});
  }
  async clearData() {
    return sendCommand(this.connection, 'system:clear', {});
  }
```

**Step 1 — Write the failing test.** Create `tests/unit/network/gmCommandActionConformance.test.js`. Note: this test reads files synchronously via `fs`/`path` and parses YAML — it does not need jsdom DOM APIs, but it runs fine under the project's default `testEnvironment: 'jsdom'` (per `jest.config.js:11`), so no per-file environment override is needed. It uses the `@jest/globals` import style matching the sibling `tests/unit/network/orchestratorClient.test.js:8`.

```javascript
/**
 * GmCommand Action-Enum Conformance (AC-1/CC-6/AC-4 safety net)
 *
 * Parses the AsyncAPI GmCommand action enum and asserts every action string
 * emitted by the admin controllers (sendCommand(this.connection, '<action>', ...))
 * is a member. Turns action-string drift into a hard failure.
 *
 * EXPECTED RED until the AC-1/CC-6 fix: AdminOperations.restartSystem()/clearData()
 * emit 'system:restart'/'system:clear' which are NOT in the enum.
 */
import { describe, it, expect } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';

const CONTRACT_PATH = path.resolve(__dirname, '../../../../backend/contracts/asyncapi.yaml');
const ADMIN_DIR = path.resolve(__dirname, '../../../src/admin');

function loadActionEnum() {
  const doc = yaml.load(fs.readFileSync(CONTRACT_PATH, 'utf8'));
  return new Set(
    doc.components.messages.GmCommand.payload.properties.data.properties.action.enum
  );
}

function collectControllerActions() {
  const found = new Map(); // action -> [files]
  const re = /sendCommand\(\s*this\.connection,\s*'([^']+)'/g;
  for (const file of fs.readdirSync(ADMIN_DIR)) {
    if (!file.endsWith('.js')) continue;
    const src = fs.readFileSync(path.join(ADMIN_DIR, file), 'utf8');
    let m;
    while ((m = re.exec(src)) !== null) {
      const action = m[1];
      if (!found.has(action)) found.set(action, []);
      found.get(action).push(file);
    }
  }
  return found;
}

describe('GmCommand action-enum conformance', () => {
  it('every controller-emitted action is a member of the AsyncAPI GmCommand enum', () => {
    const enumSet = loadActionEnum();
    const actions = collectControllerActions();

    expect(actions.size).toBeGreaterThan(0); // sanity: we actually parsed something

    const violations = [];
    for (const [action, files] of actions) {
      if (!enumSet.has(action)) {
        violations.push(`${action} (emitted by ${files.join(', ')})`);
      }
    }

    expect(violations).toEqual([]);
  });

  it('the enum contains the contract-defined system reset action', () => {
    const enumSet = loadActionEnum();
    expect(enumSet.has('system:reset')).toBe(true);
  });
});
```

**Step 2 — Run it (expect FAIL).**
Run: `cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/ALNScanner && npx jest tests/unit/network/gmCommandActionConformance.test.js`
Expected: FAIL on the first test with output similar to:
```
  ● GmCommand action-enum conformance › every controller-emitted action is a member of the AsyncAPI GmCommand enum

    expect(received).toEqual(expected) // deep equality

    - Expected  - 1
    + Received  + 4

    - Array []
    + Array [
    +   "system:clear (emitted by AdminOperations.js)",
    +   "system:restart (emitted by AdminOperations.js)",
    + ]
```
(The second test — `system:reset` is in the enum — PASSES.) This RED is the documented, intentional state: it proves AC-1/CC-6 and must stay red until the later-phase fix in the admin-commands cluster deletes or renames `AdminOperations.restartSystem`/`clearData`.

**Step 3 — Minimal implementation:** NONE in this phase. **Do not** make this test green here — its red state is the contract-violation evidence. The fix (delete the two dead methods or rename to `system:reset` and route through the inline handler) is owned by the admin-commands phase. Document the expected red in the plan's progress tracker.

**Step 4 — Run the full unit suite to confirm the new test integrates without breaking others (and that the only new red is the documented one):**
Run: `cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/ALNScanner && npx jest tests/unit/network/`
Expected: the network suites pass EXCEPT `gmCommandActionConformance.test.js` which fails its first test as in Step 2. No other suite regresses.

**Step 5 — Commit (the failing test is committed intentionally as a tracked red; if the repo CI blocks on red, mark the first `it` with `it.failing(...)` instead and note it):**
```bash
cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/ALNScanner
git add tests/unit/network/gmCommandActionConformance.test.js
git commit -m "test(contract): add GmCommand action-enum conformance test (RED: AC-1/CC-6)

Parses the AsyncAPI GmCommand action enum and asserts every controller-emitted
sendCommand action is a member. Starts RED on system:restart/system:clear
(AdminOperations dead methods, not in enum) — proving AC-1/CC-6. Stays red
until those methods are deleted/renamed in the admin-commands phase.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task P0.3: Export the production messageTypes array from orchestratorClient (WS-2 prep)

The WS-2 forwarding-completeness test in `orchestratorClient.test.js:220-252` builds its OWN local `messageTypes` array (itself incomplete) and asserts only `toHaveBeenCalledTimes(localArray.length)` — a self-referential count that passes regardless of what the production array contains. To make a real cross-check possible, the production array (currently inlined inside `_setupMessageHandlers()` at `orchestratorClient.js:240-262`) must become an exported module-level constant the test can import. This task is a pure, behavior-preserving refactor: extract the array to a named export and reference it from the method. No event is added or removed.

**Files:**
- Modify: `/home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/ALNScanner/src/network/orchestratorClient.js:239-274` (extract the inline `messageTypes` array to a module-level `export const MESSAGE_TYPES`)
- Test (Modify): `/home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/ALNScanner/tests/unit/network/orchestratorClient.test.js:9` (import the new named export) and the "should forward all AsyncAPI message types" test at `:220-252`

Real current code (verified at `src/network/orchestratorClient.js:239-274`):

```javascript
  _setupMessageHandlers() {
    const messageTypes = [
      'sync:full',
      'transaction:result',
      'transaction:new',
      'transaction:deleted',
      'score:adjusted',
      'scores:reset',
      'session:update',
      'session:overtime',
      'device:connected',
      'device:disconnected',
      'group:completed',
      'display:mode',
      'gm:command:ack',
      'offline:queue:processed',
      'batch:ack',
      'error',
      'player:scan',
      'cue:fired',
      'cue:completed',
      'cue:error',
      'service:state',  // Sole push mechanism for service domain state
    ];

    messageTypes.forEach(type => {
      this.socket.on(type, (envelope) => {
        const payload = envelope.data || envelope;
        this.dispatchEvent(new CustomEvent('message:received', {
          detail: { type, payload }
        }));
      });
    });
  }
```

**Step 1 — Write the failing test.** Add a new test to the "message forwarding" describe block in `tests/unit/network/orchestratorClient.test.js` (after the existing test at `:252`) that imports the production constant and registers a handler for every entry, asserting the count matches `MESSAGE_TYPES.length` — this is only meaningful once the constant is exported, so first update the import. Change line 9:

```javascript
import OrchestratorClient, { MESSAGE_TYPES } from '../../../src/network/orchestratorClient.js';
```

Then add inside `describe('message forwarding', ...)`:

```javascript
    it('forwards every event in the exported production MESSAGE_TYPES array', () => {
      const messageHandler = jest.fn();
      client.addEventListener('message:received', messageHandler);

      MESSAGE_TYPES.forEach(type => {
        mockSocket._simulateMessage(type, {
          event: type,
          data: { test: 'data' },
          timestamp: new Date().toISOString()
        });
      });

      expect(messageHandler).toHaveBeenCalledTimes(MESSAGE_TYPES.length);
      // Confirm the production array is non-trivial (guards against an empty export)
      expect(MESSAGE_TYPES.length).toBeGreaterThanOrEqual(20);
    });
```

**Step 2 — Run it (expect FAIL).**
Run: `cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/ALNScanner && npx jest tests/unit/network/orchestratorClient.test.js`
Expected: FAIL — `MESSAGE_TYPES` is `undefined` (not yet exported), so `MESSAGE_TYPES.forEach` throws:
```
TypeError: Cannot read properties of undefined (reading 'forEach')
```

**Step 3 — Minimal implementation.** In `src/network/orchestratorClient.js`, hoist the array to a module-level export and reference it. Replace the inline-array portion of `_setupMessageHandlers()`:

```javascript
  _setupMessageHandlers() {
    MESSAGE_TYPES.forEach(type => {
      this.socket.on(type, (envelope) => {
        // Extract payload from AsyncAPI envelope
        const payload = envelope.data || envelope;
        // Forward as generic message:received event
        this.dispatchEvent(new CustomEvent('message:received', {
          detail: { type, payload }
        }));
      });
    });
  }
```

And add the named export near the top of the file, immediately after the file's doc comment block (above `export class OrchestratorClient`):

```javascript
/**
 * Server→client event names this client forwards as `message:received`.
 * Exported so contract tests can cross-check against the AsyncAPI subscribe set.
 */
export const MESSAGE_TYPES = [
  'sync:full',
  'transaction:result',
  'transaction:new',
  'transaction:deleted',
  'score:adjusted',
  'scores:reset',
  'session:update',
  'session:overtime',
  'device:connected',
  'device:disconnected',
  'group:completed',
  'display:mode',
  'gm:command:ack',
  'offline:queue:processed',
  'batch:ack',
  'error',
  'player:scan',
  'cue:fired',
  'cue:completed',
  'cue:error',
  'service:state', // Sole push mechanism for service domain state
];
```

**Step 4 — Run it (expect PASS).**
Run: `cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/ALNScanner && npx jest tests/unit/network/orchestratorClient.test.js`
Expected: PASS — all existing tests plus the new `forwards every event in the exported production MESSAGE_TYPES array` test pass. (The old self-referential "should forward all AsyncAPI message types" test at `:220-252` still passes; it is replaced by the contract cross-check in P0.4.)

**Step 5 — Commit:**
```bash
cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/ALNScanner
git add src/network/orchestratorClient.js tests/unit/network/orchestratorClient.test.js
git commit -m "refactor(network): export MESSAGE_TYPES from orchestratorClient (WS-2 prep)

Hoist the inlined server->client event list out of _setupMessageHandlers into
a module-level named export so a contract conformance test can cross-check it
against the AsyncAPI subscribe set. Behavior-preserving — no event added/removed.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task P0.4: Rewrite the WS-2 forwarding-completeness test to cross-check MESSAGE_TYPES against the AsyncAPI subscribe set (RED-exposes the contract↔client drift)

Replace the self-referential count test with a real contract conformance assertion: parse the server→client message names from the AsyncAPI `/` channel `subscribe.message.oneOf` and assert they equal the production `MESSAGE_TYPES` set (exported in P0.3). **This test will START RED** because the two sets genuinely diverge today (verified by parsing the contract):
- In `MESSAGE_TYPES` but NOT in the contract subscribe set: `batch:ack`, `player:scan` (both are defined as messages — `BatchAck`, `PlayerScan` — but omitted from the subscribe `oneOf`; this is the internal contract inconsistency noted in CC-7/L-8).
- In the contract subscribe set but NOT in `MESSAGE_TYPES`: `scoreboard:page`.

This drift is exactly what the original WS-2 test could never catch. The reconciliation (add `player:scan`/`batch:ack` to the subscribe `oneOf`, decide whether the client should consume `scoreboard:page`, and prune genuinely-orphan forwards) is owned by the contract-conformance / dead-event phases (CC-7, CC-3). This task only installs the detector and documents the expected red.

**Files:**
- Test (Modify): `/home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/ALNScanner/tests/unit/network/orchestratorClient.test.js:220-252` (replace the old self-referential test with a contract cross-check; keep `MESSAGE_TYPES` import from P0.3)

Real current code being replaced (verified at `tests/unit/network/orchestratorClient.test.js:220-252`):

```javascript
    it('should forward all AsyncAPI message types', () => {
      const messageHandler = jest.fn();
      client.addEventListener('message:received', messageHandler);

      const messageTypes = [
        'sync:full',
        'transaction:result',
        'transaction:new',
        'score:adjusted',
        'session:update',
        'device:connected',
        'device:disconnected',
        'group:completed',
        'gm:command:ack',
        'offline:queue:processed',
        'batch:ack',
        'error',
        'cue:fired',
        'cue:completed',
        'cue:error',
        'service:state',
      ];

      messageTypes.forEach(type => {
        mockSocket._simulateMessage(type, {
          event: type,
          data: { test: 'data' },
          timestamp: new Date().toISOString()
        });
      });

      expect(messageHandler).toHaveBeenCalledTimes(messageTypes.length);
    });
```

**Step 1 — Write the failing test.** Replace the block above with a contract cross-check. It parses the subscribe channel's message names from the AsyncAPI doc. Add the `fs`/`path`/`yaml` imports at the top of the file (next to the existing `@jest/globals` import at `:8`); they are inert in jsdom:

```javascript
import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
```

Then replace the old test with:

```javascript
    it('MESSAGE_TYPES equals the AsyncAPI server->client subscribe set (WS-2)', () => {
      const contractPath = path.resolve(__dirname, '../../../../backend/contracts/asyncapi.yaml');
      const doc = yaml.load(fs.readFileSync(contractPath, 'utf8'));

      const contractEvents = doc.channels['/'].subscribe.message.oneOf
        .map(ref => ref['$ref'].split('/').pop())     // message key, e.g. 'SyncFull'
        .map(key => doc.components.messages[key].name) // event name, e.g. 'sync:full'
        .sort();

      const clientEvents = [...MESSAGE_TYPES].sort();

      expect(clientEvents).toEqual(contractEvents);
    });
```

**Step 2 — Run it (expect FAIL).**
Run: `cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/ALNScanner && npx jest tests/unit/network/orchestratorClient.test.js`
Expected: FAIL on the new test with a diff equivalent to:
```
  ● OrchestratorClient - Dumb Pipe › message forwarding › MESSAGE_TYPES equals the AsyncAPI server->client subscribe set (WS-2)

    - contract has 'scoreboard:page' (not in client MESSAGE_TYPES)
    + client has 'batch:ack' and 'player:scan' (not in contract subscribe oneOf)
```
i.e. `toEqual` fails because the client array contains `batch:ack`, `player:scan` that the contract subscribe set lacks, and the contract contains `scoreboard:page` that the client lacks. This RED is intentional and documents the contract↔client drift (CC-7/CC-3).

**Step 3 — Minimal implementation:** NONE in this phase. **Do not** force the test green by editing the contract or the client array here — the correct reconciliation (decide direction for each of the three divergent events) is owned by the contract-conformance phase, which must update `asyncapi.yaml` (subscribe `oneOf`) and the backend FIRST per the contract-first rule, then the client. Record the expected red in the plan tracker with the three divergent events listed.

**Step 4 — Run the file to confirm only the documented red exists.**
Run: `cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/ALNScanner && npx jest tests/unit/network/orchestratorClient.test.js`
Expected: every test passes EXCEPT `MESSAGE_TYPES equals the AsyncAPI server->client subscribe set (WS-2)` which fails as in Step 2. The P0.3 test `forwards every event in the exported production MESSAGE_TYPES array` still passes.

**Step 5 — Commit (intentional tracked red; if CI blocks on red, wrap the assertion in `it.failing(...)` and note that the contract-conformance phase must flip it back to `it(...)` once reconciled):**
```bash
cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/ALNScanner
git add tests/unit/network/orchestratorClient.test.js
git commit -m "test(network): cross-check MESSAGE_TYPES against AsyncAPI subscribe set (RED: WS-2)

Replace the self-referential toHaveBeenCalledTimes(localArray.length) test with
a real contract conformance assertion: parse the server->client subscribe oneOf
from asyncapi.yaml and assert it equals the exported client MESSAGE_TYPES set.
Starts RED on genuine drift (client has batch:ack/player:scan not in the
subscribe oneOf; contract has scoreboard:page not in the client) — exactly the
dropped-event class WS-2 could never catch. Reconciliation owned by the
contract-conformance phase (contract-first).

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task P0.5: Add a build-artifact test asserting dist/sw.js exists after a production build (RED-exposes SW-1/SW-4)

No test asserts the real service-worker artifact ships; every existing `initializationSteps.test.js` fully mocks `navigator.serviceWorker.register` (`tests/unit/app/initializationSteps.test.js:192,196,200`), which is why the `/gm-scanner/sw.js` 404 shipped undetected (SW-1). Add a build-artifact assertion that runs the production build and checks `dist/sw.js` exists. **This test will START RED**: `sw.js` lives at the submodule root (`ALNScanner/sw.js`), is neither a Rollup `input` (`vite.config.js:20-24` only lists `main: './index.html'`) nor inside `publicDir:'data'` (`vite.config.js:7`), so the build never emits it. The test stays red until the SW-1 fix makes the build emit `sw.js` (e.g., via `vite-plugin-pwa` or by placing/copying it into `publicDir`). The build runs in-test via `child_process.execSync('npm run build:backend')` (the `/gm-scanner/`-based build used in production); it uses a long Jest timeout because a Vite build takes longer than the default 5s.

**Files:**
- Test (Create): `/home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/ALNScanner/tests/unit/build/swArtifact.test.js`

Context — the build config that omits sw.js (verified at `vite.config.js:7,20-24`):

```javascript
  publicDir: 'data', // Static assets (tokens data)
  ...
    rollupOptions: {
      input: {
        main: './index.html'
      }
    }
```

Context — the registration path the build must satisfy (verified at `src/app/initializationSteps.js:103-105`):

```javascript
    // If served from https://IP:3000/gm-scanner/, this resolves to /gm-scanner/sw.js
    const swPath = new URL('sw.js', window.location.href).pathname;
    const registration = await navigatorObj.serviceWorker.register(swPath);
```

NOTE for the implementer: `ALNScanner/dist/` is currently a working checkout of the `data` git submodule (it contains `CLAUDE.md`, `tokens.json`, a `.git` file). Vite's `emptyOutDir: true` will wipe and repopulate `dist/` on build. This test triggers a real `npm run build:backend` and asserts on the build output; do not assume the pre-existing `dist/` contents.

**Step 1 — Write the failing test.** Create `tests/unit/build/swArtifact.test.js`. It does a real build, so set a generous timeout. Run from the ALNScanner root (the test's cwd is the project root under Jest):

```javascript
/**
 * Build-artifact conformance (SW-1/SW-4 safety net)
 *
 * Asserts the production build emits dist/sw.js. The deployed scanner registers
 * `/gm-scanner/sw.js` (initializationSteps.js), so the build MUST emit it.
 *
 * EXPECTED RED until the SW-1 fix: sw.js currently lives at the submodule root
 * and is neither a Rollup input nor inside publicDir:'data', so the build never
 * emits it and /gm-scanner/sw.js 404s on every load.
 */
import { describe, it, expect, beforeAll } from '@jest/globals';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '../../..');          // ALNScanner/
const DIST_SW = path.join(ROOT, 'dist', 'sw.js');

describe('build artifact: service worker', () => {
  beforeAll(() => {
    // Production base path is /gm-scanner/ (served by the orchestrator).
    execSync('npm run build:backend', { cwd: ROOT, stdio: 'inherit' });
  }, 180000);

  it('emits dist/sw.js so /gm-scanner/sw.js resolves at runtime', () => {
    expect(fs.existsSync(DIST_SW)).toBe(true);
  });
});
```

**Step 2 — Run it (expect FAIL).**
Run: `cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/ALNScanner && npx jest tests/unit/build/swArtifact.test.js`
Expected: the build succeeds (stdout shows `vite vX building for production... ✓ built`), then the assertion FAILS:
```
  ● build artifact: service worker › emits dist/sw.js so /gm-scanner/sw.js resolves at runtime

    expect(received).toBe(expected) // Object.is equality

    Expected: true
    Received: false
```
This RED proves SW-1/SW-4: the deployed build ships no service worker.

**Step 3 — Minimal implementation:** NONE in this phase. **Do not** copy `sw.js` into the build here — the SW-1 fix is part of the reconnect/lifecycle cluster and must decide between `vite-plugin-pwa` (auto-generated precache of the real hashed assets) vs. shipping a corrected `sw.js`, because the current `sw.js` precache list is itself stale (SW-2: references unhashed `index.html`, `data/tokens.json`, and `/socket.io-client/socket.io.min.js`, all of which 404 → atomic `cache.addAll()` install rejection). Emitting the broken file would just trade a 404 for a non-activating SW. Record the expected red in the plan tracker.

**Step 4 — Run it again to confirm the red is stable and the build itself is healthy.**
Run: `cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/ALNScanner && npx jest tests/unit/build/swArtifact.test.js`
Expected: same FAIL as Step 2 (build OK, `dist/sw.js` absent). If the build itself errors, that is a separate problem to fix before relying on this test.

**Step 5 — Commit (intentional tracked red; if the unit job must stay green, gate this test out of the default `jest` run — e.g., a separate `test:build` script or CI step — and note that, since a full Vite build inside the standard unit suite also slows `npm test` considerably):**
```bash
cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/ALNScanner
git add tests/unit/build/swArtifact.test.js
git commit -m "test(build): assert dist/sw.js is emitted by production build (RED: SW-1/SW-4)

Runs npm run build:backend and asserts dist/sw.js exists. Starts RED because
sw.js lives at the submodule root and is neither a Rollup input nor inside
publicDir:'data', so the build never emits it and /gm-scanner/sw.js 404s on
every load. Turns the silent build gap into a hard failure. Fix is owned by
the reconnect/lifecycle (SW-1/SW-2) phase.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

# Phase 1 — Reconnect & Lifecycle Resilience

**The churn root.** This phase fixes the two CRITICAL/HIGH defects behind the live-show reload-churn (RL-1 auto-reconnect gate, RL-2 page-lifecycle/BFCache, SW-1 missing service worker) and, by doing so, dissolves the downstream collision/backoff/HTTP-hang findings (RL-3, RL-5, AUTH-1, RL-6, RL-7, SW-2, SW-3, HTTP-1, HTTP-5, NFC-3). Sub-order: **P1a** (reconnect logic) → **P1b** (lifecycle + service worker) → **P1c** (connect-time HTTP). P1a is internally strict-ordered (P1a.2 → P1a.3 → P1a.4). **Prerequisite:** do **P4b.1** (NFC `AbortController`) before **P1b's NFC-3** task.

## Phase 1a — Reconnect logic
### Task P1a.1: Reconnect on all non-client-initiated disconnect reasons (RL-1 / AUTH-2)

The socket is created with `reconnection: false` (`orchestratorClient.js:54`), so reconnect is fully delegated to `ConnectionManager._setupReconnectionHandler` (`connectionManager.js:165-196`). That handler only reconnects when `reason === 'io server disconnect'`. The live-show reasons `'transport close'` (Wi-Fi blip/roam) and `'ping timeout'` (throttled/backgrounded tab) and `'transport error'` fall through and do nothing but flip the header to "Disconnected" — the only recovery is a full page reload. We broaden the gate to reconnect on EVERY reason except the two client-initiated ones (`'io client disconnect'`, `'client namespace disconnect'`). An existing test at `connectionManager.test.js:269-283` asserts a `'transport close'` disconnect only emits `disconnected` and leaves state `disconnected` — that test must be REWRITTEN here because the new behavior (it should now schedule a reconnect) directly contradicts the old assertion.

**Note (contract-first, rule 4):** This whole phase is a CLIENT-ONLY consumer change. The backend already emits the exact handshake reject strings (`socketServer.js:53,58,68,92`) and the AsyncAPI contract already enumerates `AUTH_REQUIRED` / `AUTH_INVALID` / `DEVICE_ID_COLLISION` (`backend/contracts/asyncapi.yaml:2008-2010`) and already documents that auth failures arrive as transport-level `connect_error` (`asyncapi.yaml:36,45`). No contract or backend code/test change is required — nothing new crosses the wire.

**Files:**
- Modify: `ALNScanner/src/network/connectionManager.js:170-192` (`_setupReconnectionHandler` disconnect handler)
- Test: `ALNScanner/tests/unit/network/connectionManager.test.js` (add reconnect-on-transport-close test in the `reconnection handling` describe block, ~line 268)

**Step 1 — Write the failing test.** Add this `it` to the `describe('reconnection handling', ...)` block (after the existing `'should NOT reconnect on client-initiated disconnect'` test at line 257-267). It uses the same `mockClient.addEventListener.mock.calls.find(...)` pattern the sibling tests use to grab the registered disconnect handler:

```javascript
    it('should auto-reconnect on transport close (Wi-Fi blip)', (done) => {
      connectionManager.token = createValidToken();

      jest.spyOn(connectionManager, 'connect').mockImplementation(async () => {
        expect(true).toBe(true); // reconnect was attempted
        done();
      });

      const disconnectHandler = mockClient.addEventListener.mock.calls
        .find(c => c[0] === 'socket:disconnected')[1];

      disconnectHandler({ detail: { reason: 'transport close' } });
    });

    it('should auto-reconnect on ping timeout', (done) => {
      connectionManager.token = createValidToken();

      jest.spyOn(connectionManager, 'connect').mockImplementation(async () => {
        expect(true).toBe(true);
        done();
      });

      const disconnectHandler = mockClient.addEventListener.mock.calls
        .find(c => c[0] === 'socket:disconnected')[1];

      disconnectHandler({ detail: { reason: 'ping timeout' } });
    });
```

The reconnect is scheduled via `setTimeout(..., 1000)`. To avoid relying on a real 1s timer in the failing-then-passing run, replace the existing `setTimeout(...)` reconnect in the handler with an immediately-invoked scheduler in Step 3; until then the test will fail because `connect` is never called.

**Step 2 — Run it, expect FAIL.**

Run: `cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/ALNScanner && npx jest tests/unit/network/connectionManager.test.js -t "transport close"`

Expected: FAIL — `Timeout - Async callback was not invoked within the 5000 ms timeout` (the `done()` is never called because `'transport close'` falls through the `reason === 'io server disconnect'` gate and `connect` is never invoked).

**Step 3 — Minimal implementation.** Replace the gate in `_setupReconnectionHandler` (`connectionManager.js:170-192`). Change the `disconnectHandler` body so it reconnects on everything except the two client-initiated reasons, and run the reconnect synchronously-schedulable (still via `setTimeout` so backoff/retry semantics are unchanged, but the test mocks `connect` so the 1000ms is the only delay):

```javascript
    this.disconnectHandler = (event) => {
      const reason = event.detail?.reason;

      this.state = 'disconnected';
      this.dispatchEvent(new CustomEvent('disconnected', { detail: { reason } }));

      // Client-initiated disconnects are intentional — never auto-reconnect.
      const CLIENT_INITIATED = ['io client disconnect', 'client namespace disconnect'];
      if (CLIENT_INITIATED.includes(reason)) {
        return;
      }

      // Any other reason (transport close, ping timeout, transport error,
      // io server disconnect) is an unexpected drop — auto-reconnect, token permitting.
      if (!this.isTokenValid()) {
        this.dispatchEvent(new CustomEvent('auth:required', {
          detail: { reason: 'token_expired' }
        }));
        return;
      }

      setTimeout(() => {
        this.connect().catch(() => {
          // Retry logic handles failures
        });
      }, this._calculateRetryDelay());
    };
```

Note: the reconnect delay now comes from `_calculateRetryDelay()` (was a hard-coded `1000`). With `retryCount === 0` after a successful connect, P1a.6 makes that base delay 1000ms — so the timing of the existing `'io server disconnect'` reconnect test (P1a.1 leaves it green) is preserved.

**Step 4 — Run it, expect PASS.**

Run: `cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/ALNScanner && npx jest tests/unit/network/connectionManager.test.js -t "reconnect"`

Expected: PASS — both new tests (`transport close`, `ping timeout`) plus the existing `'io server disconnect'` test pass.

Now REWRITE the stale test at `connectionManager.test.js:269-283`. The existing `'should emit disconnected event on disconnect'` test uses `'transport close'` and only asserts the `disconnected` event + state; that is still TRUE under the new behavior (we still emit `disconnected`), but to keep it from accidentally letting a real reconnect timer fire and leak, change its reason to a client-initiated one so it stays a pure "no reconnect, just emit" assertion:

```javascript
    it('should emit disconnected event on disconnect', async () => {
      const disconnectedHandler = jest.fn();
      connectionManager.addEventListener('disconnected', disconnectedHandler);

      // Use a client-initiated reason so no reconnect timer is scheduled.
      const disconnectHandler = mockClient.addEventListener.mock.calls
        .find(c => c[0] === 'socket:disconnected')[1];

      disconnectHandler({ detail: { reason: 'io client disconnect' } });

      expect(disconnectedHandler).toHaveBeenCalledWith(expect.objectContaining({
        detail: { reason: 'io client disconnect' }
      }));
      expect(connectionManager.state).toBe('disconnected');
    });
```

Run: `cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/ALNScanner && npx jest tests/unit/network/connectionManager.test.js`

Expected: PASS — full file green (all `reconnection handling` + `retry logic` + lifecycle tests).

**Step 5 — Commit.**

```bash
cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/ALNScanner
git add src/network/connectionManager.js tests/unit/network/connectionManager.test.js
git commit -m "fix(reconnect): auto-reconnect on all non-client-initiated drops (RL-1/AUTH-2)

Broaden ConnectionManager reconnect gate from only 'io server disconnect'
to every reason except 'io client disconnect'/'client namespace disconnect'.
Transport close (Wi-Fi blip) and ping timeout (backgrounded tab) now self-heal
instead of requiring a full page reload. Rewrite stale test that asserted
transport close does not reconnect.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task P1a.2: Surface connect_error reason from OrchestratorClient onError (RL-3 enabling step)

`OrchestratorClient.connect`'s `onError` (`orchestratorClient.js:78-86`) and the persistent `connect_error` handler (`orchestratorClient.js:226-228`) both dispatch `socket:error` with `detail: { error }`. The backend rejects the handshake with `next(new Error('AUTH_INVALID: ...'))` / `'DEVICE_ID_COLLISION: ...'` / `'AUTH_REQUIRED: ...'` (`socketServer.js:53,58,68,92`), and Socket.io delivers that as a `connect_error` whose `error.message` carries the prefixed string. ConnectionManager (P1a.4) needs the reason to branch, so we first extract a stable `reason` field onto the `socket:error` event detail. This is a pure enrichment — no behavior change yet.

**Files:**
- Modify: `ALNScanner/src/network/orchestratorClient.js:78-86` (`onError` in `connect`), `:226-228` (persistent `connect_error` handler)
- Test: `ALNScanner/tests/unit/network/orchestratorClient.test.js` (extend `connect` describe block, ~line 89)

**Step 1 — Write the failing test.** Add to `describe('connect', ...)` (after the existing `'should emit socket:error event on connection failure'` test at line 89-100). The mock socket's `_simulateError(error)` calls the registered `connect_error` handler with the error object (`orchestratorClient.test.js:492-494`):

```javascript
    it('should expose backend reject reason on socket:error detail', async () => {
      const errorHandler = jest.fn();
      client.addEventListener('socket:error', errorHandler);

      const connectPromise = client.connect('token', { deviceId: 'TEST', deviceType: 'gm' });
      mockSocket._simulateError(new Error('DEVICE_ID_COLLISION: This device ID is already connected from another location'));

      await expect(connectPromise).rejects.toThrow('DEVICE_ID_COLLISION');
      expect(errorHandler).toHaveBeenCalledWith(expect.objectContaining({
        detail: expect.objectContaining({
          reason: 'DEVICE_ID_COLLISION',
          error: expect.any(Error)
        })
      }));
    });
```

**Step 2 — Run it, expect FAIL.**

Run: `cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/ALNScanner && npx jest tests/unit/network/orchestratorClient.test.js -t "expose backend reject reason"`

Expected: FAIL — `Expected: ObjectContaining {"detail": ObjectContaining {"reason": "DEVICE_ID_COLLISION", ...}}` ... `Received: {"detail": {"error": [Error]}}` (the `reason` key is absent; `socket:error` detail currently only has `error`).

**Step 3 — Minimal implementation.** Add a small private parser and include `reason` in both dispatch sites. In `orchestratorClient.js`, add a method (place near `_setupSocketHandlers`):

```javascript
  /**
   * Extract the backend reject reason prefix from a connect_error.
   * Backend rejects with messages like "AUTH_INVALID: ...", "DEVICE_ID_COLLISION: ...".
   * @param {Error} error
   * @returns {string|null} The CONSTANT_CASE prefix, or null if not present
   * @private
   */
  _parseErrorReason(error) {
    const msg = error?.message || '';
    const match = msg.match(/^([A-Z_]+):/);
    return match ? match[1] : null;
  }
```

Then update `onError` in `connect` (`orchestratorClient.js:84`):

```javascript
        this.dispatchEvent(new CustomEvent('socket:error', {
          detail: { error, reason: this._parseErrorReason(error) }
        }));
```

And the persistent handler (`orchestratorClient.js:227`):

```javascript
    this.socket.on('connect_error', (error) => {
      this.dispatchEvent(new CustomEvent('socket:error', {
        detail: { error, reason: this._parseErrorReason(error) }
      }));
    });
```

**Step 4 — Run it, expect PASS.**

Run: `cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/ALNScanner && npx jest tests/unit/network/orchestratorClient.test.js`

Expected: PASS — new test green; the existing `'should emit socket:error event on connection failure'` test still passes (it asserts `detail: { error: expect.any(Error) }` which `objectContaining` does not require here — note that test uses an exact-shape `objectContaining` on the outer event only, so the added `reason: null` for a non-prefixed `'Connection failed'` message does not break it).

**Step 5 — Commit.**

```bash
cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/ALNScanner
git add src/network/orchestratorClient.js tests/unit/network/orchestratorClient.test.js
git commit -m "feat(reconnect): expose backend reject reason on socket:error (RL-3)

Parse the CONSTANT_CASE prefix (AUTH_INVALID/AUTH_REQUIRED/DEVICE_ID_COLLISION)
from connect_error.message and include it as socket:error detail.reason so
ConnectionManager can branch on handshake failure type. Pure enrichment, no
behavior change.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task P1a.3: Add a socket:error consumer in ConnectionManager (RL-3)

Today nothing listens for `socket:error` — `grep socket:error src/` returns only the emit sites in `orchestratorClient.js`. So a `DEVICE_ID_COLLISION` is entirely silent (the post-mortem's "4× device ID already in use"). ConnectionManager already owns the connection lifecycle and emits `auth:required` (consumed by `networkedSession.js:327` → `app.js:149` → connection wizard). We register a `socket:error` listener on the client (alongside the existing `socket:disconnected` listener registered in `_setupReconnectionHandler`) and store the last reject reason for the retry/branch logic in P1a.4. This task just wires the listener and captures the reason; the branching behavior lands in P1a.4.

**Files:**
- Modify: `ALNScanner/src/network/connectionManager.js:84-136` (`connect`, register error listener once), add `_lastErrorReason` field in constructor (`:34`)
- Test: `ALNScanner/tests/unit/network/connectionManager.test.js` (new `describe('connect_error handling', ...)` block, ~after line 361)

**Step 1 — Write the failing test.** The `mockClient` in `beforeEach` (`connectionManager.test.js:22-29`) is a plain object with `addEventListener: jest.fn()`. To simulate the client emitting `socket:error`, grab the registered handler the same way the disconnect tests do. Add a new describe block after `describe('retry logic', ...)` (ends line 361):

```javascript
  describe('connect_error handling', () => {
    beforeEach(async () => {
      global.fetch = jest.fn().mockResolvedValue({ ok: true });
      await connectionManager.connect();
    });

    it('should register a socket:error listener on the client', () => {
      expect(mockClient.addEventListener).toHaveBeenCalledWith(
        'socket:error',
        expect.any(Function)
      );
    });

    it('should capture the reject reason from socket:error', () => {
      const errorHandler = mockClient.addEventListener.mock.calls
        .find(c => c[0] === 'socket:error')[1];

      errorHandler({ detail: { reason: 'DEVICE_ID_COLLISION', error: new Error('x') } });

      expect(connectionManager._lastErrorReason).toBe('DEVICE_ID_COLLISION');
    });
  });
```

**Step 2 — Run it, expect FAIL.**

Run: `cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/ALNScanner && npx jest tests/unit/network/connectionManager.test.js -t "connect_error handling"`

Expected: FAIL — first test: `expect(jest.fn()).toHaveBeenCalledWith('socket:error', ...)` → "Number of calls: ... " with no `socket:error` call (only `socket:disconnected` is registered today). The reason-capture test fails with `expect(undefined).toBe('DEVICE_ID_COLLISION')`.

**Step 3 — Minimal implementation.** In `connectionManager.js` constructor, add the field and handler ref (near line 34-37):

```javascript
    this.retryCount = 0;
    this.maxRetries = config.maxRetries || 5;
    this.retryTimer = null;
    this.disconnectHandler = null;
    this.errorHandler = null;
    this._lastErrorReason = null;
```

Add a setup method and call it from `connect` right after the successful `client.connect` (`connectionManager.js:119`, alongside `_setupReconnectionHandler()`):

```javascript
      // Setup reconnection handler
      this._setupReconnectionHandler();
      this._setupErrorHandler();
```

```javascript
  /**
   * Listen for handshake errors so we can capture the reject reason.
   * @private
   */
  _setupErrorHandler() {
    if (this.errorHandler) {
      this.client.removeEventListener('socket:error', this.errorHandler);
    }
    this.errorHandler = (event) => {
      this._lastErrorReason = event.detail?.reason || null;
    };
    this.client.addEventListener('socket:error', this.errorHandler);
  }
```

Also remove it in `_removeReconnectionHandler` / `disconnect` for symmetry — extend `_removeReconnectionHandler` (`connectionManager.js:202-207`):

```javascript
  _removeReconnectionHandler() {
    if (this.disconnectHandler) {
      this.client.removeEventListener('socket:disconnected', this.disconnectHandler);
      this.disconnectHandler = null;
    }
    if (this.errorHandler) {
      this.client.removeEventListener('socket:error', this.errorHandler);
      this.errorHandler = null;
    }
  }
```

**Step 4 — Run it, expect PASS.**

Run: `cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/ALNScanner && npx jest tests/unit/network/connectionManager.test.js`

Expected: PASS — full file green. The existing `disconnect` describe block's `'should remove client event listeners'` test (line 379-386) still passes (it asserts `socket:disconnected` removal; the added `socket:error` removal is additive).

**Step 5 — Commit.**

```bash
cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/ALNScanner
git add src/network/connectionManager.js tests/unit/network/connectionManager.test.js
git commit -m "feat(reconnect): consume socket:error in ConnectionManager (RL-3)

Register a socket:error listener on the client and capture the backend reject
reason into _lastErrorReason. Collisions are no longer silent — the reason is
now available for the auth/backoff branching in the next task. Tear down the
listener alongside the disconnect handler.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task P1a.4: Branch on reject reason — AUTH_* skips retries + clears token; DEVICE_ID_COLLISION avoids tight retry (AUTH-1)

The `connect` catch block (`connectionManager.js:121-135`) treats EVERY rejection identically: `retryCount++`, schedule backoff, up to `maxRetries`. So an expired token hammers the server for ~15s before re-prompting, and a `DEVICE_ID_COLLISION` is blindly retried on the same deviceId (un-winnable until the server times out the stale socket). Using `_lastErrorReason` captured in P1a.3, we branch:
- `AUTH_INVALID` / `AUTH_REQUIRED` → skip retries entirely, dispatch `auth:required` (reason `auth_failed`), and clear the stale token (set `this.token = null` + remove `aln_auth_token` from localStorage so the wizard re-prompts).
- `DEVICE_ID_COLLISION` → do NOT tight-loop the same id; the jittered backoff from P1a.6 already spaces retries past the server's stale-socket teardown window, so we keep retrying but log the collision (no special skip). The key fix is we no longer count an auth failure against the retry budget.

**Files:**
- Modify: `ALNScanner/src/network/connectionManager.js:121-135` (catch block in `connect`)
- Test: `ALNScanner/tests/unit/network/connectionManager.test.js` (extend `connect_error handling` describe block)

**Step 1 — Write the failing test.** Add to the `describe('connect_error handling', ...)` block from P1a.3. To drive the catch path we make `mockClient.connect` reject AND pre-set `_lastErrorReason` (simulating the `socket:error` having fired during the failed handshake — Socket.io fires `connect_error` before the connect promise rejects):

```javascript
    it('should skip retries and dispatch auth:required on AUTH_INVALID', async () => {
      const authHandler = jest.fn();
      connectionManager.addEventListener('auth:required', authHandler);

      // Simulate handshake rejected for bad token
      mockClient.connect.mockRejectedValueOnce(new Error('AUTH_INVALID: Invalid or expired token'));
      connectionManager._lastErrorReason = 'AUTH_INVALID';
      connectionManager.token = createValidToken(); // token passes local expiry check; server rejected it

      await expect(connectionManager.connect()).rejects.toThrow('AUTH_INVALID');

      expect(authHandler).toHaveBeenCalledWith(expect.objectContaining({
        detail: { reason: 'auth_failed' }
      }));
      expect(connectionManager.retryTimer).toBeNull(); // no retry scheduled
      expect(connectionManager.token).toBeNull();       // stale token cleared
    });

    it('should still schedule a retry on DEVICE_ID_COLLISION', async () => {
      mockClient.connect.mockRejectedValueOnce(new Error('DEVICE_ID_COLLISION: in use'));
      connectionManager._lastErrorReason = 'DEVICE_ID_COLLISION';
      connectionManager.token = createValidToken();

      await expect(connectionManager.connect()).rejects.toThrow('DEVICE_ID_COLLISION');

      expect(connectionManager.retryTimer).not.toBeNull();
      expect(connectionManager.retryCount).toBe(1);
    });
```

**Step 2 — Run it, expect FAIL.**

Run: `cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/ALNScanner && npx jest tests/unit/network/connectionManager.test.js -t "AUTH_INVALID"`

Expected: FAIL — `auth:required` is NOT dispatched (the catch block schedules a retry for `retryCount 1 < maxRetries 5`), so `authHandler` was not called and `connectionManager.token` is still the valid token. Failure message: `expect(jest.fn()).toHaveBeenCalledWith(...)` → "Number of calls: 0".

**Step 3 — Minimal implementation.** Rewrite the catch block in `connect` (`connectionManager.js:121-135`):

```javascript
    } catch (error) {
      this.state = 'disconnected';

      const reason = this._lastErrorReason;
      this._lastErrorReason = null; // consume

      // Auth failures are NOT transient — retrying a known-bad credential
      // just hammers the server. Clear the stale token and re-prompt.
      if (reason === 'AUTH_INVALID' || reason === 'AUTH_REQUIRED') {
        this.token = null;
        try {
          localStorage.removeItem('aln_auth_token');
        } catch { /* localStorage may be unavailable */ }
        this.dispatchEvent(new CustomEvent('auth:required', {
          detail: { reason: 'auth_failed' }
        }));
        throw error;
      }

      // DEVICE_ID_COLLISION and transient transport errors: retry with
      // jittered backoff (which spaces retries past the server's stale-socket
      // teardown window — see RL-5/RL-6).
      this.retryCount++;
      if (this.retryCount < this.maxRetries) {
        this._scheduleRetry();
      } else {
        this.dispatchEvent(new CustomEvent('auth:required', {
          detail: { reason: 'max_retries' }
        }));
      }

      throw error;
    }
```

`localStorage` is available in the jsdom test environment (`testEnvironment: 'jsdom'` in `jest.config.js`), so the `removeItem` call runs without the catch firing.

**Step 4 — Run it, expect PASS.**

Run: `cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/ALNScanner && npx jest tests/unit/network/connectionManager.test.js`

Expected: PASS — both new tests green. The existing `'should emit auth:required after max retries'` (line 328-342) and `'should retry with exponential backoff on connection failure'` (line 291-306) still pass because those rejections have no `_lastErrorReason` set (it's `null`), so they fall through to the retry branch unchanged.

**Step 5 — Commit.**

```bash
cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/ALNScanner
git add src/network/connectionManager.js tests/unit/network/connectionManager.test.js
git commit -m "fix(reconnect): branch on handshake reject reason (AUTH-1/RL-3)

AUTH_INVALID/AUTH_REQUIRED now skip retries, clear the stale token from
localStorage, and dispatch auth:required(reason=auth_failed) to re-prompt —
instead of burning the 5x backoff budget on a known-bad credential.
DEVICE_ID_COLLISION still retries but no longer races the prior socket's
teardown (jittered backoff lands in a later task).

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task P1a.5: Await server-confirmed teardown before re-handshaking (RL-5)

`OrchestratorClient.connect` calls `_cleanup()` (`orchestratorClient.js:50`) which synchronously `disconnect()`s the old socket and immediately opens a new `io()` (`:52`) with the SAME deviceId. There is no wait for the server's disconnect to propagate, so a fast reconnect (e.g. ConnectionManager's reconnect on `transport close` from P1a.1) re-handshakes inside the server's stale-socket teardown window and is rejected as `DEVICE_ID_COLLISION` (`socketServer.js:86-93` matches the still-"connected" prior device). We make `connect` await a short teardown settle: if there is an existing connected socket, perform a graceful `disconnect()` (which already waits for the server `disconnect` event with a 1s fallback, `orchestratorClient.js:175-198`) BEFORE opening the new socket, rather than the fire-and-forget `_cleanup()`.

**Files:**
- Modify: `ALNScanner/src/network/orchestratorClient.js:44-64` (`connect` — replace eager `_cleanup()` with awaited teardown when a live socket exists)
- Test: `ALNScanner/tests/unit/network/orchestratorClient.test.js` (extend `connect` describe block)

**Step 1 — Write the failing test.** The existing `'should cleanup old socket before creating new one'` test (line 114-129) proves a second `connect` cleans up the first. We add a test asserting that when the prior socket is still connected, the new `io()` is NOT created until the prior socket's `disconnect` has been driven. The mock socket's `disconnect` is a `jest.fn()` and `_simulateDisconnect` fires the `disconnect` handler:

```javascript
    it('should await prior socket teardown before opening a new socket (RL-5)', async () => {
      // First connection
      const p1 = client.connect('token', { deviceId: 'TEST', deviceType: 'gm' });
      mockSocket._simulateConnect();
      await p1;
      expect(global.io).toHaveBeenCalledTimes(1);

      // Prior socket is still "connected"
      mockSocket.connected = true;

      // Second connect should gracefully disconnect the prior socket first
      const p2 = client.connect('token', { deviceId: 'TEST', deviceType: 'gm' });

      // The graceful disconnect was requested on the OLD socket...
      expect(mockSocket.disconnect).toHaveBeenCalled();
      // ...but the NEW io() socket must NOT be created until teardown settles.
      expect(global.io).toHaveBeenCalledTimes(1);

      // Drive the server-confirmed disconnect of the old socket
      mockSocket._simulateDisconnect('io client disconnect');

      // Now the new socket is created and we can complete the handshake
      mockSocket._simulateConnect();
      await p2;
      expect(global.io).toHaveBeenCalledTimes(2);
    });
```

(Note: `global.io` returns the same `mockSocket` each call, so `_simulateConnect`/`_simulateDisconnect` drive whichever handlers are currently registered — adequate for asserting the ordering of `io()` creation vs. teardown.)

**Step 2 — Run it, expect FAIL.**

Run: `cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/ALNScanner && npx jest tests/unit/network/orchestratorClient.test.js -t "await prior socket teardown"`

Expected: FAIL — `expect(global.io).toHaveBeenCalledTimes(1)` receives `2`, because the current `connect` calls `_cleanup()` then immediately `io()` (the new socket is created synchronously, before any teardown wait).

**Step 3 — Minimal implementation.** Update the top of `connect` (`orchestratorClient.js:44-64`). Replace the eager `_cleanup()` with an awaited graceful disconnect when a live socket exists:

```javascript
  async connect(token, auth) {
    // If a live socket exists, gracefully tear it down and WAIT for the server
    // to confirm the disconnect before re-handshaking with the same deviceId.
    // Opening a new socket inside the server's stale-socket teardown window
    // triggers a spurious DEVICE_ID_COLLISION (RL-5).
    if (this.socket?.connected) {
      console.warn('OrchestratorClient: live socket present, awaiting teardown before reconnect');
      await this.disconnect(); // resolves on server 'disconnect' (1s fallback), then _cleanup()
    } else {
      this._cleanup();
    }

    this.socket = io(this.config.url, {
```

`disconnect()` already nulls `this.socket` via `_cleanup()` after the `disconnect` event (or the 1s fallback), so the subsequent `this.socket = io(...)` always starts fresh.

**Step 4 — Run it, expect PASS.**

Run: `cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/ALNScanner && npx jest tests/unit/network/orchestratorClient.test.js`

Expected: PASS — new test green. The existing `'should cleanup old socket before creating new one'` test (line 114-129) still passes: in that test the first socket IS connected, so the new path calls `disconnect()` which invokes `mockSocket.disconnect()` and `removeAllListeners()` on the old socket (the assertions check exactly those), then `_simulateConnect()` on the second `connect` resolves it.

**Step 5 — Commit.**

```bash
cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/ALNScanner
git add src/network/orchestratorClient.js tests/unit/network/orchestratorClient.test.js
git commit -m "fix(reconnect): await server-confirmed teardown before re-handshake (RL-5)

connect() now gracefully disconnects a live prior socket and waits for the
server-confirmed 'disconnect' (1s fallback) before opening a new io() with the
same deviceId. Eliminates the reconnect-identify race that produced spurious
DEVICE_ID_COLLISION rejections on fast reloads.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task P1a.6: Fix backoff off-by-one + add jitter (RL-6)

In `connect`'s catch (`connectionManager.js:125`) `this.retryCount++` runs BEFORE `_scheduleRetry()` → `_calculateRetryDelay()` (`:228-233`), which computes `baseDelay * Math.pow(2, this.retryCount)`. So the first retry (after `retryCount` becomes 1) already waits `1000 * 2^1 = 2000ms` — the 1s base is unreachable and the sequence is 2/4/8/16s. Fix: use `2^(retryCount - 1)` so the first retry waits the 1s base, and add ±20% jitter to avoid all stations reconnecting in lockstep (thundering herd) after a shared Wi-Fi blip. The existing exact-delay test (`connectionManager.test.js:308-326`) asserts `[1000,2000,4000,8000,16000,30000,30000]` for `retryCount = 0..6` — under the new formula those exact values now require the test to set `retryCount` to `1..7` (or assert ranges to accommodate jitter). We rewrite that test to assert jittered ranges keyed off the post-increment retryCount semantics.

**Files:**
- Modify: `ALNScanner/src/network/connectionManager.js:228-233` (`_calculateRetryDelay`)
- Test: `ALNScanner/tests/unit/network/connectionManager.test.js:308-326` (rewrite the exact-delay test)

**Step 1 — Write the failing test.** Replace the existing `'should use exponential backoff delays (1s, 2s, 4s, 8s, 16s, 30s max)'` test (line 308-326) with a jitter-aware version. After the fix, `retryCount === 1` (first retry, post-increment) must yield the 1s base ± jitter:

```javascript
    it('should use jittered exponential backoff with 1s base for the first retry', () => {
      // retryCount is the post-increment value: 1 = first retry.
      // base * 2^(retryCount-1), capped at 30s, +/- 20% jitter.
      const cases = [
        { retryCount: 1, center: 1000 },
        { retryCount: 2, center: 2000 },
        { retryCount: 3, center: 4000 },
        { retryCount: 4, center: 8000 },
        { retryCount: 5, center: 16000 },
        { retryCount: 6, center: 30000 }, // capped
        { retryCount: 7, center: 30000 }, // capped
      ];

      for (const { retryCount, center } of cases) {
        connectionManager.retryCount = retryCount;
        const delay = connectionManager._calculateRetryDelay();
        expect(delay).toBeGreaterThanOrEqual(center * 0.8);
        expect(delay).toBeLessThanOrEqual(center * 1.2);
      }
    });
```

**Step 2 — Run it, expect FAIL.**

Run: `cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/ALNScanner && npx jest tests/unit/network/connectionManager.test.js -t "jittered exponential backoff"`

Expected: FAIL — for `retryCount: 1` the current formula returns `1000 * 2^1 = 2000`, which is `> 1000 * 1.2 = 1200`, so `expect(2000).toBeLessThanOrEqual(1200)` fails.

**Step 3 — Minimal implementation.** Rewrite `_calculateRetryDelay` (`connectionManager.js:228-233`):

```javascript
  _calculateRetryDelay() {
    const baseDelay = 1000;  // 1 second
    const maxDelay = 30000;  // 30 seconds
    // retryCount is post-increment (1 = first retry), so 2^(retryCount-1)
    // makes the first retry use the 1s base.
    const exp = Math.max(0, this.retryCount - 1);
    const capped = Math.min(baseDelay * Math.pow(2, exp), maxDelay);
    // +/- 20% jitter to avoid lockstep reconnects across stations.
    const jitter = capped * 0.2 * (Math.random() * 2 - 1);
    return Math.round(capped + jitter);
  }
```

**Step 4 — Run it, expect PASS.**

Run: `cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/ALNScanner && npx jest tests/unit/network/connectionManager.test.js`

Expected: PASS — rewritten test green across all 7 cases. The `'should retry with exponential backoff on connection failure'` test (line 291-306) still passes (it only asserts `retryTimer` is defined and `retryCount === 1`, not the exact delay). Note the P1a.1 reconnect handler now calls `_calculateRetryDelay()` with `retryCount === 0` after a clean connect → `exp = max(0, -1) = 0` → ~1000ms ± jitter, preserving the prior ~1s reconnect timing.

**Step 5 — Commit.**

```bash
cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/ALNScanner
git add src/network/connectionManager.js tests/unit/network/connectionManager.test.js
git commit -m "fix(reconnect): correct backoff off-by-one + add jitter (RL-6)

_calculateRetryDelay now uses 2^(retryCount-1) so the first retry waits the 1s
base (was unreachable; sequence started at 2s). Add +/-20% jitter to avoid all
stations reconnecting in lockstep after a shared Wi-Fi blip.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task P1a.7: Full Phase-1 regression — run the network unit suites + coverage check

Confirm the reconnect cluster changes pass together and did not regress the broader unit suite or the per-file coverage ratchet (`ALNScanner` uses the same `scripts/coverage-ratchet.js` pattern as backend; thresholds in `ALNScanner/.coverage-thresholds.json`). No code change in this task — verification only.

**Files:**
- Verify: `ALNScanner/src/network/connectionManager.js`, `ALNScanner/src/network/orchestratorClient.js`, both test files

**Step 1 — (no new test).** This is the integration checkpoint for the phase.

**Step 2 — Run the two changed suites together, expect PASS.**

Run: `cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/ALNScanner && npx jest tests/unit/network/connectionManager.test.js tests/unit/network/orchestratorClient.test.js`

Expected: PASS — both suites green (all pre-existing tests + the new RL/AUTH tests).

**Step 3 — Run the full unit suite, expect PASS.**

Run: `cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/ALNScanner && npm test`

Expected: PASS — full suite green (baseline ~1155 tests across ~59 suites; the new tests add to that count, nothing removed except the two rewritten assertions).

**Step 4 — Coverage ratchet check, expect PASS.**

Run: `cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/ALNScanner && npm run coverage:check`

Expected: PASS — `No coverage regressions` (the new branches in `connectionManager.js`/`orchestratorClient.js` are all exercised by the tests added in P1a.1-6; if `coverage:check` reports a file ABOVE threshold needing a ratchet bump, run `npm run coverage:ratchet` and stage the updated `.coverage-thresholds.json`).

**Step 5 — Commit (only if the ratchet file changed).**

```bash
cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/ALNScanner
git add .coverage-thresholds.json
git commit -m "chore(reconnect): ratchet coverage thresholds after RL/AUTH reconnect fixes

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

## Phase 1b — Page lifecycle & service worker
### Task P1b.1: Downgrade service-worker registration failure from showError toast to Debug.log (SW-3)

**Context:** `registerServiceWorker()` is awaited unconditionally during init (app.js:102) for both networked and standalone modes. Today, when `/gm-scanner/sw.js` 404s (the pre-fix state) or any non-SSL error occurs, the catch-block `else` branch calls `uiManager.showError(...)`, popping a visible operator toast on every one of the ~28 reloads in a live session. A missing/failed SW should never alarm the GM mid-show — it is a non-critical PWA enhancement. This task is independent of shipping the SW (P1b.2) and lowers the blast radius if registration ever fails again.

**Files:**
- Modify: `ALNScanner/src/app/initializationSteps.js:120-126` (the non-SSL `else` branch of `registerServiceWorker`)
- Test: `ALNScanner/tests/unit/app/initializationSteps.test.js:214-224` (existing `'should show error for non-SSL errors'` test — invert its assertion)

**Step 1 — Write the failing test.** Replace the existing `'should show error for non-SSL errors'` test (initializationSteps.test.js:214-224) so it asserts the operator is NOT alarmed and the failure is logged via Debug instead. `Debug` is already imported at the top of this file and `Debug.clear()` runs in `beforeEach` (line 39).

```javascript
    it('should NOT show an error toast for non-SSL errors (logs to Debug instead)', async () => {
      const genericError = new Error('Generic error');
      mockNavigator.serviceWorker.register.mockRejectedValue(genericError);

      const initialCount = Debug.messages.length;
      const result = await registerServiceWorker(mockNavigator, mockUIManager);

      expect(result).toBe(false);
      // A failed (non-critical) SW registration must never alarm the operator mid-show
      expect(mockUIManager.showError).not.toHaveBeenCalled();
      // ...but it must still be logged for diagnosis
      expect(Debug.messages.length).toBeGreaterThan(initialCount);
    });
```

Also update the "Integration - Full Initialization Flow" expectation at initializationSteps.test.js:583 (`expect(mockUIManager.showError).toHaveBeenCalled();`) if it asserts SW failure surfaces a toast — read that block first; only change it if it relies on the SW-failure-toast behavior (the token-database failure path also calls `showError`, so verify which one it targets before editing).

**Step 2 — Run it (expect FAIL).**
Run: `cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/ALNScanner && npx jest tests/unit/app/initializationSteps.test.js -t "non-SSL errors"`
Expected FAIL: `expect(jest.fn()).not.toHaveBeenCalled()` — `Expected number of calls: 0, Received number of calls: 1` (because production still calls `uiManager.showError(...)`).

**Step 3 — Minimal implementation.** Edit the `else` branch in `initializationSteps.js` (lines 120-126) to log instead of toast:

```javascript
    } else {
      // Non-critical: a missing/failed service worker only disables offline PWA
      // features. NEVER surface this to the operator mid-show (SW-3) — it is noise
      // that erodes trust and can mask real errors.
      Debug.log(`Service Worker registration failed: ${error.message}`, true);
      console.warn('Service Worker registration failed:', error);
      return false;
    }
```

**Step 4 — Run it (expect PASS).**
Run: `cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/ALNScanner && npx jest tests/unit/app/initializationSteps.test.js`
Expected PASS: all tests in the suite pass, including `should NOT show an error toast for non-SSL errors (logs to Debug instead)` and `should handle SSL certificate errors gracefully`.

**Step 5 — Commit.**
```bash
cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/ALNScanner
git add src/app/initializationSteps.js tests/unit/app/initializationSteps.test.js
git commit -m "fix(sw): downgrade SW registration failure from showError toast to Debug.log

A failed (non-critical) service-worker registration must never alarm the
GM operator mid-show. Route non-SSL registration failures to Debug.log +
console.warn instead of uiManager.showError. Addresses SW-3.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task P1b.2: Ship a rewritten, correct service worker to dist/ via a Vite emit plugin (SW-1, SW-2)

**Context:** The deployed build has NO service worker. `sw.js` lives at the ALNScanner submodule root; it is neither a Rollup `input` (vite.config.js:20-24 only lists `main: './index.html'`) nor inside `publicDir` (`data`, vite.config.js:7). So `dist/sw.js` does not exist and `GET /gm-scanner/sw.js` 404s on every load. We CANNOT simply move `sw.js` into `publicDir`: `data/` is the **ALN-TokenData git submodule** (`.gitmodules` → `path = data`), and its contents emit to the dist root (e.g. `dist/tokens.json`, `dist/scoring-config.json` already do). Putting `sw.js` there would pollute the shared token submodule. The current `sw.js` content is also stale (SW-2): it precaches `./index.html` (real entry is a hashed `main-<hash>.js`), `./data/tokens.json` (404s under `/gm-scanner/`), and `/socket.io-client/socket.io.min.js` (index.html actually loads `/socket.io/socket.io.js` — verified at index.html:542); since `cache.addAll()` is atomic, any one 404 makes `install` reject and the SW never activates. So we keep `sw.js` in the ALNScanner repo root, REWRITE it to a runtime-cache + navigation-fallback strategy with no broken precache list, and add a tiny custom Vite plugin to emit it into `dist/` (avoiding `vite-plugin-pwa`, which is NOT in devDependencies — see Decisions).

This task makes P0's `dist/sw.js` artifact test (SW-4) go green.

**Files:**
- Modify: `ALNScanner/sw.js:1-116` (full rewrite — drop broken precache, switch to runtime cache + nav fallback)
- Modify: `ALNScanner/vite.config.js:47-55` (add a small `emitServiceWorker()` plugin to the `plugins` array)
- Test: `ALNScanner/tests/build/sw-artifact.test.js` (Create — build-output assertion; complements P0's SW-4 test)

**Step 1 — Write the failing test.** This is a build-artifact assertion run under jsdom Jest (matches `testMatch: ['**/tests/**/*.test.js']` in jest.config.js). It uses Node `fs`/`child_process` (CommonJS `require` is available under babel-jest). It runs `npm run build` once and asserts the emitted SW exists and is the rewritten version (no stale entries).

```javascript
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..'); // ALNScanner/
const DIST_SW = path.join(ROOT, 'dist', 'sw.js');

describe('service worker build artifact (SW-1/SW-2/SW-4)', () => {
  beforeAll(() => {
    // Build the production bundle once for this suite.
    execSync('npm run build', { cwd: ROOT, stdio: 'inherit' });
  }, 120000);

  it('emits sw.js into dist/', () => {
    expect(fs.existsSync(DIST_SW)).toBe(true);
  });

  it('does NOT precache the stale/non-existent paths (SW-2)', () => {
    const sw = fs.readFileSync(DIST_SW, 'utf8');
    expect(sw).not.toContain('/socket.io-client/socket.io.min.js');
    expect(sw).not.toContain('./data/tokens.json');
  });
});
```

**Step 2 — Run it (expect FAIL).**
Run: `cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/ALNScanner && npx jest tests/build/sw-artifact.test.js`
Expected FAIL: after the build runs, `expect(fs.existsSync(DIST_SW)).toBe(true)` → `Expected: true, Received: false` (dist/sw.js is not emitted today).

**Step 3 — Implementation (two edits).**

(a) Rewrite `ALNScanner/sw.js` to a non-atomic runtime-cache strategy with a navigation fallback and a self-update flow. No precache list (so no atomic-install 404 failure), bump the cache name, keep API/discovery passthrough:

```javascript
/**
 * Service Worker for ALN GM Scanner.
 * Strategy: NO precache list (avoids atomic-install 404s — SW-2). App shell is
 * runtime-cached on first fetch; navigations fall back to the cached shell when
 * offline. API + discovery + socket.io traffic always goes to the network.
 */
const CACHE_NAME = 'aln-gm-scanner-runtime-v1';

self.addEventListener('install', () => {
  // No addAll() — nothing to fail. Activate immediately.
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(
        names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n))
      ))
      .then(() => self.clients.claim())
  );
});

const isBypass = (url) =>
  url.pathname.startsWith('/api/') ||
  url.pathname.startsWith('/socket.io/') ||
  /:(3000|8080)(\/|$)/.test(url.host + url.pathname) ||
  /\b\d+\.\d+\.\d+\.\d+\b/.test(url.host);

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (isBypass(url)) return; // let network handle it

  // Navigations: network-first, fall back to cached shell when offline.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((resp) => {
          const copy = resp.clone();
          caches.open(CACHE_NAME).then((c) => c.put(request, copy));
          return resp;
        })
        .catch(() => caches.match(request).then((c) => c || caches.match('./')))
    );
    return;
  }

  // Static assets: cache-first, populate on miss.
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((resp) => {
        if (resp && resp.status === 200 && resp.type === 'basic') {
          const copy = resp.clone();
          caches.open(CACHE_NAME).then((c) => c.put(request, copy));
        }
        return resp;
      });
    })
  );
});
```

(b) Add an emit plugin to `ALNScanner/vite.config.js`. Add this function above `export default` and register it in the `plugins` array (after `basicSsl()`):

```javascript
import { readFileSync } from 'fs';

// Emit the repo-root sw.js verbatim into dist/sw.js. Kept OUT of publicDir
// because publicDir ('data') is the ALN-TokenData submodule — see plan Decisions.
function emitServiceWorker() {
  return {
    name: 'aln-emit-service-worker',
    apply: 'build',
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'sw.js',
        source: readFileSync('./sw.js', 'utf8')
      });
    }
  };
}
```

Then in the `plugins` array (vite.config.js:47):

```javascript
  plugins: [
    basicSsl(),
    emitServiceWorker(),
    createHtmlPlugin({
      minify: true
    })
  ],
```

**Step 4 — Run it (expect PASS).**
Run: `cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/ALNScanner && npx jest tests/build/sw-artifact.test.js`
Expected PASS: build completes, `emits sw.js into dist/` passes (`dist/sw.js` now exists), and `does NOT precache the stale/non-existent paths (SW-2)` passes. Manually confirm with `ls dist/sw.js`.

**Step 5 — Commit.**
```bash
cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/ALNScanner
git add sw.js vite.config.js tests/build/sw-artifact.test.js
git commit -m "fix(sw): ship a rewritten runtime-cache service worker to dist/

Emit repo-root sw.js into dist/ via a small Vite generateBundle plugin
(publicDir is the ALN-TokenData submodule, so sw.js must NOT live there).
Rewrite sw.js to drop the stale atomic precache list (socket.io-client/
index.html/data tokens 404s) in favor of runtime cache + navigation
fallback with skipWaiting/clients.claim self-update. Fixes SW-1 and SW-2;
makes the dist/sw.js artifact test (SW-4) green.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task P1b.3: Add a page-lifecycle controller that closes the socket on background and reconnects on foreground; remove beforeunload (RL-2)

**Context:** Today the only lifecycle handling is `setupCleanupHandlers(app)` (connectionWizard.js:455-462), which adds a `beforeunload` listener that disconnects the socket. A `beforeunload` listener itself disqualifies the page from Chrome BFCache, and there is NO `visibilitychange`/`pagehide`/`freeze`/`resume` handling anywhere in `src/`. Combined with `reconnection: false` and the open WebSocket (which also blocks BFCache), a backgrounded tab that the OS discards must fully reload — a brand-new socket that loses in-memory state and races the server's stale-socket teardown into `DEVICE_ID_COLLISION`. The fix: on `visibilitychange→hidden` / `pagehide` / `freeze`, proactively close the socket so the page becomes BFCache-eligible **and the server frees the deviceId**; on `visibilitychange→visible` / `pageshow` / `resume`, reconnect via `ConnectionManager.connect()` (which already revalidates token + health and triggers `sync:full` — verified at connectionManager.js:84-136). Replace the `beforeunload` listener (use `pagehide`, which is BFCache-friendly).

The reconnect path is delivered by `app.networkedSession?.getService('connectionManager').connect()`; the socket is closed via `app.networkedSession?.getService('client').disconnect()` (both verified: networkedSession.getService exposes `connectionManager` and `client`; ConnectionManager has `connect()`/`disconnect()`).

**Files:**
- Modify: `ALNScanner/src/ui/connectionWizard.js:451-462` (replace `setupCleanupHandlers` body)
- Test: `ALNScanner/tests/unit/ui/connectionWizard.test.js` (add a `describe('setupCleanupHandlers() — page lifecycle (RL-2)')` block; file already imports from connectionWizard.js and runs under jsdom which fires `document` `visibilitychange` + `window` `pagehide`)

**Step 1 — Write the failing test.** Add to the bottom of connectionWizard.test.js (inside the top-level `describe('ConnectionWizard', ...)` is fine, or a new top-level describe). Import `setupCleanupHandlers` at the top: change line 6 to `import { ConnectionWizard, setupCleanupHandlers } from '../../../src/ui/connectionWizard.js';`. jsdom supports dispatching `visibilitychange` on `document` and `pagehide` on `window`; we stub `document.visibilityState` via `Object.defineProperty`.

```javascript
describe('setupCleanupHandlers() — page lifecycle (RL-2)', () => {
  let lifecycleApp;
  let mockClient;
  let mockConnectionManager;

  const setVisibility = (state) => {
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => state
    });
  };

  beforeEach(() => {
    mockClient = { disconnect: jest.fn().mockResolvedValue(undefined) };
    mockConnectionManager = { connect: jest.fn().mockResolvedValue(undefined) };
    lifecycleApp = {
      networkedSession: {
        getService: jest.fn((name) =>
          name === 'client' ? mockClient
            : name === 'connectionManager' ? mockConnectionManager
            : null)
      }
    };
    setupCleanupHandlers(lifecycleApp);
  });

  it('closes the socket when the page is hidden (BFCache-eligible, frees deviceId)', () => {
    setVisibility('hidden');
    document.dispatchEvent(new Event('visibilitychange'));
    expect(mockClient.disconnect).toHaveBeenCalledTimes(1);
  });

  it('reconnects via ConnectionManager when the page becomes visible again', () => {
    setVisibility('visible');
    document.dispatchEvent(new Event('visibilitychange'));
    expect(mockConnectionManager.connect).toHaveBeenCalledTimes(1);
  });

  it('closes the socket on pagehide (BFCache-friendly replacement for beforeunload)', () => {
    window.dispatchEvent(new Event('pagehide'));
    expect(mockClient.disconnect).toHaveBeenCalledTimes(1);
  });

  it('does nothing when there is no active networked session', () => {
    const standaloneApp = { networkedSession: null };
    setupCleanupHandlers(standaloneApp);
    setVisibility('hidden');
    expect(() => document.dispatchEvent(new Event('visibilitychange'))).not.toThrow();
  });
});
```

**Step 2 — Run it (expect FAIL).**
Run: `cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/ALNScanner && npx jest tests/unit/ui/connectionWizard.test.js -t "page lifecycle"`
Expected FAIL: `closes the socket when the page is hidden` → `Expected number of calls: 1, Received number of calls: 0` (current `setupCleanupHandlers` only wires `beforeunload` and reads `app.networkedSession?.services?.client`, never `getService`, and never handles `visibilitychange`).

**Step 3 — Minimal implementation.** Replace `setupCleanupHandlers` (connectionWizard.js:451-462) with lifecycle handling:

```javascript
/**
 * Page-lifecycle controller (RL-2).
 * On background (visibility→hidden / pagehide / freeze) we proactively close the
 * socket: this makes the page BFCache-eligible AND frees the deviceId server-side,
 * preventing the DEVICE_ID_COLLISION churn that full reloads cause. On foreground
 * (visibility→visible / pageshow / resume) we reconnect via ConnectionManager,
 * which revalidates token + health and triggers sync:full.
 */
export function setupCleanupHandlers(app) {
  const closeSocket = () => {
    const client = app.networkedSession?.getService?.('client');
    if (client) {
      console.log('Page backgrounded - closing socket (BFCache-eligible, frees deviceId)');
      Promise.resolve(client.disconnect()).catch(() => {});
    }
  };

  const reopenSocket = () => {
    const cm = app.networkedSession?.getService?.('connectionManager');
    if (cm) {
      console.log('Page foregrounded - reconnecting');
      Promise.resolve(cm.connect()).catch(() => {}); // connect() revalidates + sync:full
    }
  };

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') closeSocket();
    else reopenSocket();
  });

  // pagehide replaces beforeunload (beforeunload disqualifies BFCache).
  window.addEventListener('pagehide', closeSocket);
  window.addEventListener('freeze', closeSocket);
  window.addEventListener('resume', reopenSocket);
  window.addEventListener('pageshow', (event) => {
    if (event.persisted) reopenSocket(); // restored from BFCache
  });
}
```

**Step 4 — Run it (expect PASS).**
Run: `cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/ALNScanner && npx jest tests/unit/ui/connectionWizard.test.js`
Expected PASS: all existing ConnectionWizard tests plus the 4 new `page lifecycle (RL-2)` tests pass. (Note: `visibilitychange` in jsdom fires on `document`; ensure `setVisibility` was set before dispatch.)

**Step 5 — Commit.**
```bash
cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/ALNScanner
git add src/ui/connectionWizard.js tests/unit/ui/connectionWizard.test.js
git commit -m "fix(net): add page-lifecycle controller; close socket on background, reconnect on foreground

Replace the BFCache-hostile beforeunload listener with visibilitychange/
pagehide/freeze/resume handling. On background, close the socket (BFCache-
eligible + frees the deviceId server-side); on foreground, reconnect via
ConnectionManager.connect() (revalidates token+health, triggers sync:full).
Eliminates the full-reload-on-app-switch churn behind DEVICE_ID_COLLISIONs.
Addresses RL-2.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task P1b.4: Abort the NFC scan when the page is hidden and re-arm on foreground (NFC-3)

**Context:** An always-on `NDEFReader` keeps the radio active while the tab is backgrounded, and the reader is torn down without graceful abort on tab discard. This is the same "never cleaned up when hidden" pattern as RL-2. The fix is to abort the live NFC scan on background and re-arm it on foreground, hooked into the same lifecycle controller from P1b.3. **DEPENDENCY:** this requires the `AbortController`-based `stopScan()`/idempotent `_startNFCScanning()` from finding **NFC-1**, implemented in **Phase P4b**. Before NFC-1 lands, `nfcHandler.stopScan()` only flips a boolean (nfcHandler.js:162-164) and `_startNFCScanning()` (app.js:595-625) creates a fresh `NDEFReader` with no teardown — so re-arming on every foreground would LEAK readers/listeners and risk double-queuing a transaction. Therefore P1b.4 MUST be sequenced AFTER P4b/NFC-1. The hook itself is small: extend the lifecycle controller to call `app.stopScan?.()`-equivalent on hidden and re-arm on visible only when on the scan screen.

The app exposes `app.nfcHandler` (app.js:43) and `_startNFCScanning()` (private, app.js:595). We add a thin public lifecycle entry point on App rather than calling the private method directly.

**Files:**
- Modify: `ALNScanner/src/app/app.js:595-625` (add `pauseNFCForBackground()` / `resumeNFCForForeground()` thin wrappers near `_startNFCScanning`)
- Modify: `ALNScanner/src/ui/connectionWizard.js` (extend `setupCleanupHandlers` `closeSocket`/`reopenSocket` to also pause/resume NFC)
- Test: `ALNScanner/tests/unit/app/app-nfc-errors.test.js` (sibling NFC test in app/ — copy its App-construction + nfcHandler mock style) OR extend the P1b.3 lifecycle describe in connectionWizard.test.js with NFC mocks. Read `app-nfc-errors.test.js` first to copy its `new App({ nfcHandler: ... })` DI setup.

**Step 1 — Write the failing test.** Verify NFC-1 (P4b) has landed first: confirm `nfcHandler.stopScan()` aborts an `AbortController` and `startScan()` is idempotent (grep `AbortController` in `src/utils/nfcHandler.js`). Then add lifecycle NFC tests. Using the App DI pattern from app-nfc-errors.test.js (read it to copy exact imports/mocks), assert background aborts and foreground re-arms:

```javascript
  describe('NFC page-lifecycle teardown (NFC-3)', () => {
    it('pauseNFCForBackground() aborts the active scan', () => {
      const app = new App({ nfcHandler: { stopScan: jest.fn(), startScan: jest.fn() } });
      app.nfcSupported = true;
      app._scanningActive = true;     // on scan screen
      app.pauseNFCForBackground();
      expect(app.nfcHandler.stopScan).toHaveBeenCalledTimes(1);
    });

    it('resumeNFCForForeground() re-arms the scan only when it was active', async () => {
      const app = new App({ nfcHandler: { stopScan: jest.fn(), startScan: jest.fn().mockResolvedValue() } });
      app.nfcSupported = true;
      app._scanningActive = true;
      await app.resumeNFCForForeground();
      expect(app.nfcHandler.startScan).toHaveBeenCalledTimes(1);
    });

    it('resumeNFCForForeground() does NOT re-arm when scanning was not active', async () => {
      const app = new App({ nfcHandler: { stopScan: jest.fn(), startScan: jest.fn().mockResolvedValue() } });
      app.nfcSupported = true;
      app._scanningActive = false;
      await app.resumeNFCForForeground();
      expect(app.nfcHandler.startScan).not.toHaveBeenCalled();
    });
  });
```

(Read app-nfc-errors.test.js to confirm the exact `App` constructor DI shape and any required mock deps — e.g. `debug`, `uiManager` — and mirror them so the App instance constructs cleanly.)

**Step 2 — Run it (expect FAIL).**
Run: `cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/ALNScanner && npx jest tests/unit/app/app-nfc-errors.test.js -t "page-lifecycle teardown"`
Expected FAIL: `TypeError: app.pauseNFCForBackground is not a function` (methods do not exist yet).

**Step 3 — Minimal implementation.** Add a `_scanningActive` flag where scanning starts (set `true` in `_startNFCScanning` after `startScan` resolves; set `false` in the existing `stopScan` caller at app.js:798) and add the two lifecycle wrappers near app.js:595:

```javascript
  /** Abort the live NFC scan when the page is backgrounded (NFC-3). */
  pauseNFCForBackground() {
    if (this.nfcSupported && this._scanningActive) {
      this.nfcHandler.stopScan(); // NFC-1: aborts the AbortController + nulls the reader
    }
  }

  /** Re-arm NFC when the page returns to the foreground, iff it was active (NFC-3). */
  async resumeNFCForForeground() {
    if (this.nfcSupported && this._scanningActive) {
      await this._startNFCScanning(); // NFC-1: idempotent — aborts any prior scan first
    }
  }
```

In `_startNFCScanning` (app.js:618 area, after `startScan` resolves) set `this._scanningActive = true;`. Then extend the P1b.3 lifecycle controller in connectionWizard.js — inside `closeSocket` add `app.pauseNFCForBackground?.();` and inside `reopenSocket` add `app.resumeNFCForForeground?.();`.

**Step 4 — Run it (expect PASS).**
Run: `cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/ALNScanner && npx jest tests/unit/app/app-nfc-errors.test.js`
Expected PASS: all NFC error tests plus the 3 new `NFC page-lifecycle teardown (NFC-3)` tests pass.

**Step 5 — Commit.**
```bash
cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/ALNScanner
git add src/app/app.js src/ui/connectionWizard.js tests/unit/app/app-nfc-errors.test.js
git commit -m "fix(nfc): abort NFC scan on page background, re-arm on foreground (NFC-3)

Hook NFC teardown into the page-lifecycle controller: stop the NDEFReader
(via NFC-1's AbortController) when the tab is hidden so the radio is freed,
and re-arm only when scanning was active on return. Depends on the
AbortController-based stopScan() from NFC-1 (P4b).

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

## Phase 1c — Connect-time HTTP hardening & station numbering
### Task P1c.1: Add a 5s timeout + timeout-specific message to the `/api/admin/auth` POST (HTTP-1)

**Context:** In `ALNScanner/src/ui/connectionWizard.js`, `handleConnectionSubmit()` first does a health-check fetch *with* a timeout, then does the auth POST *without* one. The current auth fetch (lines 321-325) has no `signal`:

```js
// 2. Authenticate
const authResponse = await fetch(`${normalizedUrl}/api/admin/auth`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ password })
});
```

If the backend accepts the TCP connection but stalls (overloaded Pi / half-open socket after a Wi-Fi blip), the `await` never settles and the UI is stuck on "Connecting…" forever. The health-check fetch immediately above already uses `AbortSignal.timeout(3000)` (line 313). This task adds a matching timeout to the auth POST and surfaces a distinct timeout message. This is a scanner-only client change — the request payload/endpoint is unchanged, so no contract update is required.

`AbortSignal.timeout(ms)` aborts with a `DOMException` whose `.name === 'AbortError'` (verified under Node 22 / jsdom in this repo). The single test for this file lives at `tests/unit/ui/connectionWizard.test.js` (jsdom env, `global.fetch = jest.fn()` mock style, `Storage.prototype.getItem/setItem` spies — copy that harness exactly).

**Files:**
- Modify: `ALNScanner/src/ui/connectionWizard.js:321-325` (add `signal` to auth POST)
- Modify: `ALNScanner/src/ui/connectionWizard.js:369-372` (catch block — branch on `AbortError`)
- Test: `ALNScanner/tests/unit/ui/connectionWizard.test.js` (new test inside the existing `describe('handleConnectionSubmit()', …)` block)

**Step 1 — Write the failing test.** Append this test inside the existing `describe('handleConnectionSubmit()', () => { … })` block (it reuses the same `wizard`, `mockApp`, `mockFetch`, and DOM from the file's `beforeEach`):

```js
    test('should show a timeout-specific message when the auth POST aborts', async () => {
      const display = document.getElementById('stationNameDisplay');
      display.textContent = 'GM_Station_1';
      display.dataset.deviceId = 'GM_Station_1';

      document.getElementById('serverUrl').value = 'http://localhost:3000';
      document.getElementById('gmPassword').value = 'admin';

      mockFetch
        .mockResolvedValueOnce({ ok: true }) // health check passes
        .mockRejectedValueOnce(
          Object.assign(new Error('The operation was aborted'), { name: 'AbortError' })
        ); // auth POST times out

      const event = new Event('submit');
      event.preventDefault = jest.fn();

      await wizard.handleConnectionSubmit(event);

      const statusDiv = document.getElementById('connectionStatusMsg');
      expect(statusDiv.textContent).toContain('timed out');
      // must NOT proceed to networked init on a timeout
      expect(mockApp.selectGameMode).not.toHaveBeenCalled();
    });

    test('should pass an AbortSignal to the auth POST', async () => {
      const display = document.getElementById('stationNameDisplay');
      display.textContent = 'GM_Station_1';
      display.dataset.deviceId = 'GM_Station_1';

      document.getElementById('serverUrl').value = 'http://localhost:3000';
      document.getElementById('gmPassword').value = 'admin';

      mockFetch
        .mockResolvedValueOnce({ ok: true }) // health check
        .mockResolvedValueOnce({ ok: true, json: async () => ({ token: 't' }) }); // auth

      const event = new Event('submit');
      event.preventDefault = jest.fn();

      await wizard.handleConnectionSubmit(event);

      // 2nd fetch call is the auth POST; assert it carried a signal
      const authCall = mockFetch.mock.calls.find(([url]) =>
        typeof url === 'string' && url.includes('/api/admin/auth')
      );
      expect(authCall).toBeDefined();
      expect(authCall[1].signal).toBeInstanceOf(AbortSignal);
    });
```

**Step 2 — Run it (expect FAIL).**

Run: `npx jest tests/unit/ui/connectionWizard.test.js -t "handleConnectionSubmit"` (from `ALNScanner/`)

Expected FAIL — two failures:
- `should pass an AbortSignal to the auth POST` → `expect(authCall[1].signal).toBeInstanceOf(AbortSignal)` fails with `Received: undefined` (the auth POST currently has no `signal`).
- `should show a timeout-specific message when the auth POST aborts` → the current generic catch sets `❌ Connection failed: The operation was aborted`, so `expect(...).toContain('timed out')` fails (`Received string: "❌ Connection failed: The operation was aborted"`).

**Step 3 — Minimal implementation.** Edit `ALNScanner/src/ui/connectionWizard.js`. First, add the timeout to the auth POST (lines 321-325):

```js
      // 2. Authenticate
      const authResponse = await fetch(`${normalizedUrl}/api/admin/auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
        signal: AbortSignal.timeout(5000)
      });
```

Then branch on timeout in the existing catch block (lines 369-372):

```js
    } catch (error) {
      if (error.name === 'AbortError') {
        statusDiv.textContent = '❌ Server timed out — check the orchestrator and retry.';
      } else {
        statusDiv.textContent = `❌ Connection failed: ${error.message}`;
      }
      statusDiv.style.color = '#f44336';
    }
```

**Step 4 — Run it (expect PASS).**

Run: `npx jest tests/unit/ui/connectionWizard.test.js -t "handleConnectionSubmit"` (from `ALNScanner/`)

Expected PASS — `Tests: 4 passed` (the 2 pre-existing `handleConnectionSubmit` tests + the 2 new ones). Note: the pre-existing "should read deviceId from display dataset" test still passes because adding a `signal` key does not break its assertions on `settings`/localStorage.

**Step 5 — Commit.**

```bash
cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/ALNScanner
git add src/ui/connectionWizard.js tests/unit/ui/connectionWizard.test.js
git commit -m "fix(gm-scanner): time out the auth POST and surface a timeout message (HTTP-1)

The /api/admin/auth POST had no AbortSignal, so a stalled-but-connected
backend left the wizard stuck on 'Connecting...' forever. Add
AbortSignal.timeout(5000) to match the health-check fetch above it, and
distinguish AbortError ('Server timed out, retry') from generic failure.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task P1c.2: Default a protocol-less typed URL to the page protocol, not hardcoded `http://` (HTTP-5)

**Context:** Two places prepend `http://` to a protocol-less URL, which the browser blocks as mixed content when the scanner is served over HTTPS (typing a bare `10.0.0.5:3000` → `http://10.0.0.5:3000` → blocked → surfaces as a generic "Connection failed"). The discovery scan path already does this correctly (line 69 mirrors `window.location.protocol`). The two offending sites:

`_setupServerUrlHandler()` (lines 166-169):
```js
          let normalizedUrl = url;
          if (!normalizedUrl.match(/^https?:\/\//i)) {
            normalizedUrl = `http://${normalizedUrl}`;
          }
```

`handleConnectionSubmit()` (lines 303-307):
```js
      let normalizedUrl = serverUrl.trim();
      if (!normalizedUrl.match(/^https?:\/\//i)) {
        normalizedUrl = `http://${normalizedUrl}`;
        statusDiv.textContent = `🔧 Using ${normalizedUrl}`;
      }
```

Fix: default the prepended scheme to `window.location.protocol` (e.g. `https://` when the page is HTTPS). Extract a tiny private helper so both sites stay in sync. Scanner-only change; no contract impact.

**jsdom note:** under Jest/jsdom `window.location.protocol` defaults to `'http:'`. To exercise the HTTPS branch the test overrides it via `Object.defineProperty(window, 'location', { value: { protocol: 'https:' }, writable: true })` inside the test and restores it in a local `try/finally` (don't rely on `afterEach` since the file's `afterEach` only does `clearAllMocks`/`restoreAllMocks`).

**Files:**
- Modify: `ALNScanner/src/ui/connectionWizard.js:166-169` (`_setupServerUrlHandler` normalization)
- Modify: `ALNScanner/src/ui/connectionWizard.js:303-307` (`handleConnectionSubmit` normalization)
- Modify: `ALNScanner/src/ui/connectionWizard.js` (add private `_normalizeUrl(url)` helper near `_findNextStationId`)
- Test: `ALNScanner/tests/unit/ui/connectionWizard.test.js` (new `describe('_normalizeUrl()', …)` block)

**Step 1 — Write the failing test.** Add this new top-level `describe` block (sibling to `describe('_findNextStationId()', …)`):

```js
  describe('_normalizeUrl()', () => {
    test('leaves a fully-qualified URL untouched', () => {
      expect(wizard._normalizeUrl('https://10.0.0.5:3000')).toBe('https://10.0.0.5:3000');
      expect(wizard._normalizeUrl('http://10.0.0.5:3000')).toBe('http://10.0.0.5:3000');
    });

    test('prepends the page protocol for a bare host:port (HTTPS page)', () => {
      const original = window.location;
      Object.defineProperty(window, 'location', {
        value: { protocol: 'https:' },
        writable: true,
        configurable: true
      });
      try {
        expect(wizard._normalizeUrl('10.0.0.5:3000')).toBe('https://10.0.0.5:3000');
      } finally {
        Object.defineProperty(window, 'location', {
          value: original,
          writable: true,
          configurable: true
        });
      }
    });
  });
```

**Step 2 — Run it (expect FAIL).**

Run: `npx jest tests/unit/ui/connectionWizard.test.js -t "_normalizeUrl"` (from `ALNScanner/`)

Expected FAIL — `wizard._normalizeUrl is not a function` (`TypeError`), since the helper does not exist yet.

**Step 3 — Minimal implementation.** Edit `ALNScanner/src/ui/connectionWizard.js`. Add the helper (place it right after the `_findNextStationId()` method, before `selectServer()`):

```js
  /**
   * Normalize a typed server URL — prepend the PAGE protocol (not hardcoded
   * http://) so a bare host:port isn't mixed-content-blocked on an HTTPS scanner.
   * @param {string} url
   * @returns {string}
   * @private
   */
  _normalizeUrl(url) {
    const trimmed = url.trim();
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    const protocol = window.location.protocol === 'https:' ? 'https:' : 'http:';
    return `${protocol}//${trimmed}`;
  }
```

Replace the `_setupServerUrlHandler` normalization (lines 166-170) with:

```js
          const normalizedUrl = this._normalizeUrl(url);
          this.assignStationName(normalizedUrl);
```

Replace the `handleConnectionSubmit` normalization (lines 303-307) with:

```js
      // Normalize URL - prepend the page protocol if none specified
      let normalizedUrl = this._normalizeUrl(serverUrl);
      if (normalizedUrl !== serverUrl.trim()) {
        statusDiv.textContent = `🔧 Using ${normalizedUrl}`;
      }
```

**Step 4 — Run it (expect PASS).**

Run: `npx jest tests/unit/ui/connectionWizard.test.js -t "_normalizeUrl"` (from `ALNScanner/`)

Expected PASS — `Tests: 2 passed`. Then run the full file to confirm no regression in the existing `handleConnectionSubmit` tests (they pass `http://localhost:3000`, already fully-qualified, so `_normalizeUrl` returns it unchanged):

Run: `npx jest tests/unit/ui/connectionWizard.test.js` (from `ALNScanner/`)

Expected PASS — all tests in the suite pass.

**Step 5 — Commit.**

```bash
cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/ALNScanner
git add src/ui/connectionWizard.js tests/unit/ui/connectionWizard.test.js
git commit -m "fix(gm-scanner): default protocol-less URL to page protocol (HTTP-5)

Typing a bare IP (10.0.0.5:3000) built http://..., which an HTTPS-served
scanner blocks as mixed content, surfacing only as 'Connection failed'.
Extract _normalizeUrl() that mirrors window.location.protocol (matching
the discovery scan path) and use it at both normalization call sites.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task P1c.3: Block first-time station assignment with a clear error when `/api/state` is unreachable (RL-7)

**Context:** In `assignStationName()` (lines 222-233), when the `/api/state` query fails, the FIRST-TIME fallback reads a per-device `lastStationNum` counter from localStorage and hands out `GM_Station_${stationNum}`:

```js
    } catch (error) {
      // Fallback to localStorage counter on error
      console.warn(`[ConnectionWizard] Failed to query /api/state, using localStorage fallback:`, error.message);

      const stationNum = localStorage.getItem('lastStationNum') || '1';
      const fallbackId = `GM_Station_${stationNum}`;

      if (stationNameDisplay) {
        stationNameDisplay.textContent = fallbackId;
        stationNameDisplay.dataset.deviceId = fallbackId;
      }
    }
```

This counter is not coordinated across stations. Worse, the counter is only advanced on a *successful* submit (lines 346-351 increment `lastStationNum`). So if `/api/state` is unreachable, two different physical stations both fall back to the same number (e.g. `GM_Station_1`), and the second one's WebSocket handshake is immediately rejected as `DEVICE_ID_COLLISION` — silently (per RL-3, there's no `socket:error` listener). The review's recommended fix: **do not hand out a guessable counter ID when `/api/state` is unreachable — block with a clear error so the operator can't submit a colliding ID.**

This task changes ONLY the first-time fallback (the saved-name reuse branch at lines 186-192 is untouched — a returning station already has a server-confirmed unique name in localStorage). It clears the display's `data-device-id` so the empty-deviceId guard in `handleConnectionSubmit` (lines 292-296) blocks submission, and writes an actionable message to `#connectionStatusMsg`. Scanner-only change; no contract impact.

**Files:**
- Modify: `ALNScanner/src/ui/connectionWizard.js:222-233` (replace the localStorage-counter fallback with a hard error)
- Modify: `ALNScanner/src/ui/connectionWizard.js:346-351` (remove the now-dead `lastStationNum` write in `handleConnectionSubmit`)
- Test: `ALNScanner/tests/unit/ui/connectionWizard.test.js` (replace the existing "should fallback to localStorage counter on network error" test; add a guard-on-submit test)

**Step 1 — Write the failing test.** In the `describe('assignStationName()', …)` block, REPLACE the existing test `should fallback to localStorage counter on network error` (lines 126-135) with the two tests below, and DELETE the old test (it asserts the behavior we are removing):

```js
    test('should NOT assign a guessable ID when /api/state is unreachable', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));
      Storage.prototype.getItem.mockReturnValue('5'); // stale counter must be ignored

      await wizard.assignStationName('http://localhost:3000');

      const display = document.getElementById('stationNameDisplay');
      // No colliding fallback ID — display/dataset cleared so submit is blocked
      expect(display.dataset.deviceId).toBe('');
      expect(display.textContent).not.toMatch(/GM_Station_\d+/);

      const statusDiv = document.getElementById('connectionStatusMsg');
      expect(statusDiv.textContent).toContain('reach the orchestrator');
    });

    test('blocks submission when /api/state was unreachable (no deviceId assigned)', async () => {
      // First-time assignment fails → no deviceId on the display
      mockFetch.mockRejectedValueOnce(new Error('Network error'));
      await wizard.assignStationName('http://localhost:3000');

      document.getElementById('serverUrl').value = 'http://localhost:3000';
      document.getElementById('gmPassword').value = 'admin';
      mockFetch.mockClear();

      const event = new Event('submit');
      event.preventDefault = jest.fn();
      await wizard.handleConnectionSubmit(event);

      // No deviceId → submit guard fires, no auth attempt made
      expect(mockFetch).not.toHaveBeenCalled();
      expect(document.getElementById('connectionStatusMsg').textContent)
        .toContain('Please fill in all fields');
    });
```

**Step 2 — Run it (expect FAIL).**

Run: `npx jest tests/unit/ui/connectionWizard.test.js -t "assignStationName"` (from `ALNScanner/`)

Expected FAIL — `should NOT assign a guessable ID when /api/state is unreachable` fails on `expect(display.dataset.deviceId).toBe('')` with `Received: "GM_Station_5"` (the current code still writes the stale counter ID into the dataset).

**Step 3 — Minimal implementation.** Edit `ALNScanner/src/ui/connectionWizard.js`. Replace the `catch` fallback (lines 222-233):

```js
    } catch (error) {
      // RL-7: Do NOT hand out a guessable lastStationNum counter when /api/state
      // is unreachable — an uncoordinated counter can collide with an already-
      // connected station, causing a silent DEVICE_ID_COLLISION at handshake.
      // Block instead: clear the assignment so the submit guard refuses to send.
      console.warn(`[ConnectionWizard] Could not query /api/state for station assignment:`, error.message);

      if (stationNameDisplay) {
        stationNameDisplay.textContent = '⚠️ Cannot assign station — orchestrator unreachable';
        stationNameDisplay.dataset.deviceId = '';
      }
      const statusDiv = document.getElementById('connectionStatusMsg');
      if (statusDiv) {
        statusDiv.textContent = '❌ Could not reach the orchestrator to assign a station number. Check the server URL and try again.';
        statusDiv.style.color = '#f44336';
      }
    }
```

Then remove the now-dead `lastStationNum` write in `handleConnectionSubmit` (lines 346-351) — the counter no longer feeds any fallback, so delete the block:

```js
      // (removed) lastStationNum counter — no longer used; station IDs are
      // assigned only from the server's connected-device list (see assignStationName).
```

**Step 4 — Run it (expect PASS).**

Run: `npx jest tests/unit/ui/connectionWizard.test.js -t "assignStationName"` (from `ALNScanner/`)

Expected PASS — `Tests: 4 passed` (the `should query /api/state…`, `should filter out non-GM…`, and the two new tests; the old counter-fallback test is gone). Then run the full file:

Run: `npx jest tests/unit/ui/connectionWizard.test.js` (from `ALNScanner/`)

Expected PASS — whole suite green (the `handleConnectionSubmit` "should read deviceId from display dataset" test is unaffected — it sets the dataset manually before submitting, and no longer asserts on the removed `lastStationNum` write).

**Step 5 — Commit.**

```bash
cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/ALNScanner
git add src/ui/connectionWizard.js tests/unit/ui/connectionWizard.test.js
git commit -m "fix(gm-scanner): block station assignment when /api/state unreachable (RL-7)

The first-time fallback handed out GM_Station_\${lastStationNum} from an
uncoordinated per-device counter, so two stations could both pick the same
ID and the second got a silent DEVICE_ID_COLLISION at handshake. Replace
the fallback with a hard, operator-visible error that clears the assignment
(submit guard then refuses to send). Remove the now-dead lastStationNum write.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

# Phase 2 — Transaction Durability

**The lost-scan CRITICAL.** A scanned token must never be silently lost or double-counted across the reconnect window. **Contract-first:** P2.1 extends the `transaction:result` status enum (backend + contract + backend test) before any scanner change. Then the `error`-event consumer (CC-4/WS-3) makes rejected transactions fail fast instead of hanging 30s, status-branching (TQ-3/TQ-4) classifies results correctly, TQ-2 keeps transient failures queued, TQ-1 persists-before-emit on the connected path, and TQ-6/TQ-7 reconcile against `sync:full`. Several existing queue-manager tests codify the buggy behavior and are rewritten here.

### Task P2.1: Extend AsyncAPI `transaction:result` status enum to include `queued` and `rejected` (TQ-4, contract-first)

The backend emits two `transaction:result` statuses that are NOT in the contract enum. Verified in `backend/src/websocket/adminEvents.js:175-180` (offline path emits `status: 'queued'`) and `backend/src/services/transactionService.js:138-143` (no-active-session early return emits `status: 'rejected'`). Also note: invalid-token rejections come back as `status: 'error'` (the Transaction model maps `reject()` → `this.status = 'error'`, see `backend/src/models/transaction.js:88`), so `error` is correct as-is. The current contract enum at `backend/contracts/asyncapi.yaml:730` is `[accepted, duplicate, error]` — missing `queued` and `rejected`. This is a pure contract edit; the consumer changes depend on it.

**Files:**
- Modify: `backend/contracts/asyncapi.yaml:730` (status enum under `TransactionResult.payload.properties.data.properties.status`)
- Test: `backend/tests/contract/websocket/transaction-events.test.js` (add a pure-schema enum assertion; no server needed for the enum check)

**Step 1 — Write the failing test.** Append a new `describe` block to `backend/tests/contract/websocket/transaction-events.test.js`. This block loads the YAML directly (mirrors the load pattern in `tests/contract/websocket/phase1-events.test.js:54-60`) and does NOT need the test server, so place it at the very end of the file, outside the existing server-based `describe`:

```js
describe('TransactionResult status enum (contract)', () => {
  const yaml = require('js-yaml');
  const fs = require('fs');
  const path = require('path');

  const asyncapi = yaml.load(
    fs.readFileSync(path.join(__dirname, '../../../contracts/asyncapi.yaml'), 'utf8')
  );
  const statusEnum =
    asyncapi.components.messages.TransactionResult.payload.properties.data.properties.status.enum;

  it('includes every status the backend actually emits', () => {
    // accepted/duplicate: transactionService.createScanResponse
    // error: invalid-token reject() (transaction.js maps reject -> 'error')
    // queued: adminEvents.js offline path
    // rejected: transactionService.processScan no-active-session early return
    expect(statusEnum).toEqual(
      expect.arrayContaining(['accepted', 'duplicate', 'error', 'queued', 'rejected'])
    );
  });
});
```

**Step 2 — Run it (expect FAIL).**
Run: `cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/backend && npx jest tests/contract/websocket/transaction-events.test.js -t "includes every status the backend actually emits"`
Expected FAIL: `Expected: arrayContaining ["accepted", "duplicate", "error", "queued", "rejected"]  Received: ["accepted", "duplicate", "error"]` — the enum is missing `queued` and `rejected`.

**Step 3 — Minimal implementation.** Edit `backend/contracts/asyncapi.yaml:728-732`:

```yaml
              status:
                type: string
                enum: [accepted, duplicate, error, queued, rejected]
                description: Transaction status (accepted/duplicate/error per Decision #10; queued = offline-buffered; rejected = no active session)
                example: "accepted"
```

**Step 4 — Run it (expect PASS).**
Run: `cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/backend && npx jest tests/contract/websocket/transaction-events.test.js -t "includes every status the backend actually emits"`
Expected PASS: `1 passed`. Also run the full file to confirm no regression: `npx jest tests/contract/websocket/transaction-events.test.js` — all existing tests still pass (the schema is now more permissive, so `validateWebSocketEvent(event, 'transaction:result')` still validates).

**Step 5 — Commit.**
```bash
git add backend/contracts/asyncapi.yaml backend/tests/contract/websocket/transaction-events.test.js
git commit -m "fix(contract): add queued/rejected to transaction:result status enum

Backend emits status:'queued' (offline path, adminEvents.js) and
status:'rejected' (no-active-session, transactionService.processScan)
but the AsyncAPI enum only listed [accepted,duplicate,error], so any
schema-validating consumer would reject those real results. Extend the
enum and add a contract test asserting it covers every emitted status.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task P2.2: Add a backend contract test proving the offline path emits `status: 'queued'` (TQ-4 backend behavior lock)

The enum widening in P2.1 is only safe if a test pins the backend's actual `queued` emission so future refactors can't silently change it. We add a server-based contract test driving the real offline path via `offlineQueueService.setOfflineStatus(true)` (verified at `backend/src/services/offlineQueueService.js:286`), then validating the result envelope against the (now-extended) AsyncAPI schema. This reuses the existing harness in `transaction-events.test.js` (`setupIntegrationTestServer`, `connectAndIdentify`, `waitForEvent`, `validateWebSocketEvent`).

**Files:**
- Test: `backend/tests/contract/websocket/transaction-events.test.js` (new `it` inside the existing `describe('transaction:result response', ...)` block at line 67)

**Step 1 — Write the failing test.** Insert after the existing `'should match AsyncAPI schema when transaction accepted'` test (after line 96), inside the same `describe`:

```js
    it('returns status:queued and a valid envelope when system is offline', async () => {
      const offlineQueueService = require('../../../src/services/offlineQueueService');
      offlineQueueService.setOfflineStatus(true);

      try {
        const resultPromise = waitForEvent(socket, 'transaction:result');
        socket.emit('transaction:submit', {
          event: 'transaction:submit',
          data: {
            tokenId: '534e2b03',
            teamId: 'Team Alpha',
            deviceId: 'GM_CONTRACT_TEST',
            deviceType: 'gm',
            mode: 'blackmarket'
          },
          timestamp: new Date().toISOString()
        });

        const event = await resultPromise;
        expect(event.data.status).toBe('queued');
        // Now passes only because P2.1 added 'queued' to the enum:
        validateWebSocketEvent(event, 'transaction:result');
      } finally {
        offlineQueueService.setOfflineStatus(false);
      }
    });
```

**Step 2 — Run it (expect FAIL if P2.1's contract edit were reverted; here it should already PASS given P2.1).** To demonstrate the guard genuinely depends on the enum, temporarily confirm: with the enum reverted to `[accepted, duplicate, error]`, this fails with `WebSocket event validation failed for transaction:result: ... data.status must be equal to one of the allowed values`.
Run: `cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/backend && npx jest tests/contract/websocket/transaction-events.test.js -t "returns status:queued"`
Expected (pre-P2.1 enum) FAIL message: `data/status must be equal to one of the allowed values`.

**Step 3 — Implementation.** No production change — P2.1 already widened the enum. This task only adds the behavior-locking test. (If the test fails because `enum` lacks `queued`, that is the signal P2.1 was not applied.)

**Step 4 — Run it (expect PASS).**
Run: `cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/backend && npx jest tests/contract/websocket/transaction-events.test.js -t "returns status:queued"`
Expected PASS: `1 passed`.

**Step 5 — Commit.**
```bash
git add backend/tests/contract/websocket/transaction-events.test.js
git commit -m "test(contract): lock backend offline transaction:result status=queued

Drives the real offline path via offlineQueueService.setOfflineStatus(true)
and validates the queued result against the extended AsyncAPI schema, so a
future refactor cannot silently drop the queued status or its envelope.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task P2.3: Echo a client correlation id (`clientTxId`) through `transaction:submit` → `transaction:result` (contract + backend)

`replayTransaction` currently matches results by `tokenId+teamId` only (`networkedQueueManager.js:150,175-176`), which aliases across concurrent submissions and re-replays. Before the scanner can match on a correlation id (P2.6), the wire must carry one. We add an OPTIONAL `clientTxId` to `transaction:submit.data` and echo it back on `transaction:result.data`. Optional keeps it backward compatible (old clients that omit it still validate). Backend echoes `scanRequest.clientTxId` in the contract result it sends to the submitter (`adminEvents.js:230-238`). The validator `gmTransactionSchema` (Joi) must allow the field through; verify it does not strip-and-reject unknown keys.

**Files:**
- Modify: `backend/contracts/asyncapi.yaml:665-687` (add `clientTxId` to TransactionSubmit data) and `:727-758` (add `clientTxId` to TransactionResult data)
- Modify: `backend/src/websocket/adminEvents.js:230-238` (include `clientTxId` in `contractResult`)
- Modify: `backend/src/utils/validators.js` (`gmTransactionSchema` — allow optional `clientTxId` string)
- Test: `backend/tests/contract/websocket/transaction-events.test.js` (assert echo)

**Step 1 — Write the failing test.** Add inside `describe('transaction:result response', ...)`:

```js
    it('echoes the client-supplied clientTxId back on the result', async () => {
      const resultPromise = waitForEvent(socket, 'transaction:result');
      socket.emit('transaction:submit', {
        event: 'transaction:submit',
        data: {
          tokenId: '534e2b03',
          teamId: 'Team Alpha',
          deviceId: 'GM_CONTRACT_TEST',
          deviceType: 'gm',
          mode: 'blackmarket',
          clientTxId: 'ctx-abc-123'
        },
        timestamp: new Date().toISOString()
      });

      const event = await resultPromise;
      expect(event.data.clientTxId).toBe('ctx-abc-123');
      validateWebSocketEvent(event, 'transaction:result');
    });
```

**Step 2 — Run it (expect FAIL).**
Run: `cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/backend && npx jest tests/contract/websocket/transaction-events.test.js -t "echoes the client-supplied clientTxId"`
Expected FAIL: `expect(received).toBe(expected) // Expected: "ctx-abc-123"  Received: undefined` — backend does not echo the field yet.

**Step 3 — Minimal implementation (3 edits).**

(a) `backend/contracts/asyncapi.yaml` — add to `TransactionSubmit.payload.properties.data.properties` (after `summary`, around line 687):
```yaml
              clientTxId:
                type: string
                description: Client-generated correlation id, echoed back on transaction:result for replay matching
                example: "ctx-abc-123"
```
And to `TransactionResult.payload.properties.data.properties` (after `error`, around line 758):
```yaml
              clientTxId:
                type: string
                description: Correlation id echoed from the originating transaction:submit (absent for server-originated results)
                example: "ctx-abc-123"
```

(b) `backend/src/websocket/adminEvents.js:230-238` — add the echo to `contractResult`:
```js
    const contractResult = {
      status: result.status,
      transactionId: result.transactionId || result.transaction?.id,
      tokenId: result.transaction?.tokenId || scanRequest.tokenId,
      teamId: result.transaction?.teamId || scanRequest.teamId,
      points: result.points || 0,
      message: result.message,
      error: result.error || null,
      clientTxId: scanRequest.clientTxId  // echo correlation id (TQ-3)
    };
```

(c) `backend/src/utils/validators.js` — in `gmTransactionSchema`, add `clientTxId: Joi.string().optional()` so the field survives validation (Joi strips unknown keys by default — confirm by grepping the schema; if it uses `.unknown(false)` the field MUST be declared).

**Step 4 — Run it (expect PASS).**
Run: `cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/backend && npx jest tests/contract/websocket/transaction-events.test.js -t "echoes the client-supplied clientTxId"`
Expected PASS: `1 passed`. Run the whole file to confirm the existing accepted/new/score tests still pass (they omit `clientTxId`; result `clientTxId` is then `undefined`, which is allowed since the property is optional).

**Step 5 — Commit.**
```bash
git add backend/contracts/asyncapi.yaml backend/src/websocket/adminEvents.js backend/src/utils/validators.js backend/tests/contract/websocket/transaction-events.test.js
git commit -m "feat(contract): echo client correlation id on transaction:result

Add optional clientTxId to transaction:submit, echoed on transaction:result,
so the GM scanner can match replays/results by a unique per-submission id
instead of tokenId+teamId (which aliases across concurrent submissions).
Backward compatible: field is optional in both schemas.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task P2.4: Surface backend `error` events to the operator + add `replayTransaction` fast-fail on matching `error` (CC-4 / WS-3)

The backend `error` event (validation failure, `QUEUE_FULL`, post-connection `AUTH_REQUIRED`) is forwarded by `orchestratorClient.js` but `networkedSession._messageHandler` (`networkedSession.js:194-321`) has NO `case 'error'`, so it is silently dropped (verified: there is no `case 'error':` anywhere in the switch). Separately, a `transaction:submit` that fails schema validation produces an `error` event, NOT a `transaction:result`, so `replayTransaction` (`networkedQueueManager.js:167-186`) matches only `transaction:result` and hangs the full 30s before being dropped (TQ-2). This task does BOTH halves of the fast-fail story for the error path; `transaction:result`-status branching is Task P2.6.

**Files:**
- Modify: `ALNScanner/src/network/networkedSession.js:194-321` (add `case 'error'` in `_messageHandler`)
- Modify: `ALNScanner/src/network/networkedQueueManager.js:167-186` (also handle `type === 'error'` in the replay handler)
- Test: `ALNScanner/tests/unit/network/networkedQueueManager.test.js` (new test in `describe('replayTransaction')`)

**Step 1 — Write the failing test.** Add to `ALNScanner/tests/unit/network/networkedQueueManager.test.js` inside `describe('replayTransaction', ...)` (after line 443):

```js
    it('should reject fast when a backend error matches the submission', async () => {
      const transaction = { tokenId: 'token7', teamId: '007', clientTxId: 'ctx-7' };

      mockClient.addEventListener.mockImplementation((eventType, handler) => {
        setTimeout(() => {
          handler({
            detail: {
              type: 'error',
              payload: {
                code: 'VALIDATION_ERROR',
                message: 'Failed to process transaction',
                clientTxId: 'ctx-7'
              }
            }
          });
        }, 10);
      });

      await expect(queueManager.replayTransaction(transaction))
        .rejects
        .toThrow('Failed to process transaction');
    });
```

Note: this test only resolves quickly if the handler reacts to `type === 'error'`. Without the fix it falls through the `if (type !== 'transaction:result') return;` guard and the promise hangs until the 30s timeout — the test (default 5s jest timeout) FAILS via timeout.

**Step 2 — Run it (expect FAIL).**
Run: `cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/ALNScanner && npx jest tests/unit/network/networkedQueueManager.test.js -t "should reject fast when a backend error matches"`
Expected FAIL: `thrown: "Exceeded timeout of 5000 ms for a test."` (handler ignores the `error` type, promise never settles).

**Step 3 — Minimal implementation (2 edits).**

(a) `ALNScanner/src/network/networkedQueueManager.js` — replace the `handler` body in `replayTransaction` (lines 167-186) so it reacts to BOTH `transaction:result` and a matching `error`. Match on `clientTxId` when present (set by P2.6's queueTransaction), else fall back to `tokenId+teamId`:

```js
      const handler = (event) => {
        const { type, payload } = event.detail;

        // Backend validation/queue-full errors arrive as 'error', NOT transaction:result.
        // Match by correlation id when available so a rejected tx fails fast (no 30s hang).
        if (type === 'error') {
          if (!transaction.clientTxId || payload.clientTxId === transaction.clientTxId) {
            cleanup(timeout, handler);
            const err = new Error(payload.message || 'Transaction failed');
            err.code = payload.code;
            reject(err);
          }
          return;
        }

        if (type !== 'transaction:result') return;

        const matches = transaction.clientTxId
          ? payload.clientTxId === transaction.clientTxId
          : (payload.tokenId === transaction.tokenId && payload.teamId === transaction.teamId);

        if (matches) {
          cleanup(timeout, handler);
          if (payload.status === 'error') {
            reject(new Error(payload.message || 'Transaction failed'));
          } else {
            resolve(payload);
          }
        }
      };
```

(b) `ALNScanner/src/network/networkedSession.js` — add a `case 'error'` to `_messageHandler` (insert before the final `case 'service:state':` around line 316). It surfaces the message to the operator and routes auth codes into the existing auth flow:

```js
        case 'error':
          // Backend error event (AsyncAPI Decision #10: clients MUST display).
          // Validation/QUEUE_FULL/AUTH errors are otherwise silently dropped.
          if (payload?.code === 'AUTH_REQUIRED' || payload?.code === 'AUTH_INVALID') {
            this.dispatchEvent(new CustomEvent('auth:required'));
          }
          this.dispatchEvent(new CustomEvent('backend:error', {
            detail: { code: payload?.code, message: payload?.message }
          }));
          break;
```

(The `backend:error` event is consumed by a UI toast wired in main.js — that wiring is part of the AC-2/M-1 surfacing cluster in another phase; here we ensure the event is no longer dropped and tests assert it dispatches.)

**Step 4 — Run it (expect PASS).**
Run: `cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/ALNScanner && npx jest tests/unit/network/networkedQueueManager.test.js -t "should reject fast when a backend error matches"`
Expected PASS: `1 passed`. Also re-run the full file to confirm the existing `'should reject on error status'` and `'should timeout after 30s'` tests still pass: `npx jest tests/unit/network/networkedQueueManager.test.js`.

**Step 5 — Commit.**
```bash
git add ALNScanner/src/network/networkedQueueManager.js ALNScanner/src/network/networkedSession.js ALNScanner/tests/unit/network/networkedQueueManager.test.js
git commit -m "fix(scanner): consume backend error event; fast-fail rejected replays

networkedSession had no case 'error', so backend validation/QUEUE_FULL/auth
errors were silently dropped (violating AsyncAPI Decision #10). Add a case
that surfaces the error (backend:error event) and routes AUTH_* to the auth
flow. replayTransaction now also rejects on a matching 'error' event instead
of hanging the full 30s timeout before discarding the transaction.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task P2.5: Add a `networkedSession` test asserting a forwarded `error` reaches a visible sink (CC-4 / WS-3 verification)

P2.4 added the `case 'error'` but the lock-in test for the dispatch lives with `networkedSession`. There is no existing `networkedSession.test.js` unit harness for `_messageHandler` in isolation, so we test the handler behavior by constructing the handler the same way the session wires it. Use the same import/jsdom style as `networkedQueueManager.test.js` (`@jest/globals`, jsdom is the ALNScanner default per `jest` config). We test via a minimal fake: drive `_messageHandler` by dispatching `message:received` on a stub client and asserting `backend:error` fires.

**Files:**
- Test: `ALNScanner/tests/unit/network/networkedSession.error.test.js` (new file)

**Step 1 — Write the failing test.** Create `ALNScanner/tests/unit/network/networkedSession.error.test.js`. Because `NetworkedSession._createServices()` constructs real `OrchestratorClient`/`ConnectionManager`, we exercise just the message routing by building the handler closure the session installs. The simplest robust approach: instantiate the session, stub `_createServices` to install a fake client, wire handlers, then dispatch.

```js
import { describe, it, expect, jest } from '@jest/globals';
import NetworkedSession from '../../../src/network/networkedSession.js';

function makeFakeClient() {
  const target = new EventTarget();
  return {
    addEventListener: target.addEventListener.bind(target),
    removeEventListener: target.removeEventListener.bind(target),
    dispatchEvent: target.dispatchEvent.bind(target),
    destroy: jest.fn()
  };
}

describe('NetworkedSession error routing', () => {
  it('dispatches backend:error when a backend error event arrives', () => {
    const dataManager = {};
    const session = new NetworkedSession({ url: 'x', deviceId: 'd' }, dataManager);

    // Install the message handler against a fake client (skip real socket setup)
    session.services = {
      client: makeFakeClient(),
      connectionManager: { addEventListener: jest.fn() }
    };
    session._wireEventHandlers();

    const seen = [];
    session.addEventListener('backend:error', (e) => seen.push(e.detail));

    session.services.client.dispatchEvent(new CustomEvent('message:received', {
      detail: { type: 'error', payload: { code: 'QUEUE_FULL', message: 'Offline queue is full' } }
    }));

    expect(seen).toEqual([{ code: 'QUEUE_FULL', message: 'Offline queue is full' }]);
  });

  it('routes AUTH_REQUIRED error into the auth:required flow', () => {
    const session = new NetworkedSession({ url: 'x', deviceId: 'd' }, {});
    session.services = { client: makeFakeClient(), connectionManager: { addEventListener: jest.fn() } };
    session._wireEventHandlers();

    const authSpy = jest.fn();
    session.addEventListener('auth:required', authSpy);

    session.services.client.dispatchEvent(new CustomEvent('message:received', {
      detail: { type: 'error', payload: { code: 'AUTH_REQUIRED', message: 'Not identified' } }
    }));

    expect(authSpy).toHaveBeenCalledTimes(1);
  });
});
```

Note: `_wireEventHandlers()` references `this.services.connectionManager.addEventListener` and `this.services.client.addEventListener` — both are satisfied by the stubs above. It also reads `this.services.adminController`/`queueManager` only inside the connected/disconnected callbacks (not invoked here), so the partial `services` object is safe.

**Step 2 — Run it (expect FAIL only if P2.4 not applied; here it should PASS).** To prove the test is meaningful, with P2.4's `case 'error'` removed it fails: first test `expect(seen).toEqual([...])  Received: []`.
Run: `cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/ALNScanner && npx jest tests/unit/network/networkedSession.error.test.js`
Expected (without P2.4) FAIL: `Received: []`.

**Step 3 — Implementation.** None beyond P2.4 (this task is the lock-in test). If it fails, P2.4's `case 'error'` is missing or wrong.

**Step 4 — Run it (expect PASS).**
Run: `cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/ALNScanner && npx jest tests/unit/network/networkedSession.error.test.js`
Expected PASS: `2 passed`.

**Step 5 — Commit.**
```bash
git add ALNScanner/tests/unit/network/networkedSession.error.test.js
git commit -m "test(scanner): assert backend error event reaches a visible sink

Locks in networkedSession case 'error': QUEUE_FULL/VALIDATION_ERROR surface
via backend:error, AUTH_REQUIRED routes into auth:required. Prevents
regression to the silent-drop behavior (AsyncAPI Decision #10).

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task P2.6: Branch `syncQueue` replay handling explicitly on result status; generate + return a `clientTxId` (TQ-3)

`syncQueue` (`networkedQueueManager.js:84-122`) currently unconditionally sets `this.tempQueue = []` after the loop and treats every non-`error` status as success. The backend returns `accepted`, `duplicate`, `rejected`, `error`, `queued`. We must branch: `accepted`/`duplicate` → remove (durable result); `rejected`/`error` → permanent failure, surface, remove (do not retry an invalid tx forever); `queued`/timeout/connection-error → KEEP for next reconnect. And generate a per-transaction `clientTxId` (used by P2.4's matcher and P2.7). This task changes the loop to compute a per-entry disposition; the actual "keep timed-out entries" wiring is finalized in P2.7 (TQ-2). Here we (a) add `clientTxId` generation in `queueTransaction` and return it, and (b) make `replayTransaction` resolve with the full result so `syncQueue` can read `result.status`.

**Files:**
- Modify: `ALNScanner/src/network/networkedQueueManager.js:38-61` (`queueTransaction` — generate/return `clientTxId`)
- Modify: `ALNScanner/src/network/networkedQueueManager.js:84-138` (`syncQueue` — status-based disposition)
- Test: `ALNScanner/tests/unit/network/networkedQueueManager.test.js` — REWRITE the buggy `'should clear queue even if some transactions fail'` (lines 197-224) and add status-branch tests

**Step 1 — Write the failing tests.** In `ALNScanner/tests/unit/network/networkedQueueManager.test.js`:

First REWRITE the existing buggy test `'should preserve queue on sync failure'` (lines 266-279) — it currently asserts `expect(queueManager.tempQueue).toHaveLength(0)` with the comment "Queue should be cleared despite failures (per spec)". That codifies the bug. Replace its body so a thrown (transient) replay PRESERVES the entry:

```js
    it('should preserve queue when a replay throws (transient/connection error)', async () => {
      const transactions = [{ tokenId: 'token1', teamId: '001', clientTxId: 'ctx-1' }];
      queueManager.tempQueue = [...transactions];

      jest.spyOn(queueManager, 'replayTransaction').mockRejectedValue(new Error('connection lost'));

      await queueManager.syncQueue();

      // Transient failure: keep for next reconnect (was wrongly cleared before)
      expect(queueManager.tempQueue).toContainEqual(transactions[0]);
    });
```

Then ADD new status-branch tests (after the rewritten one):

```js
    it('should remove accepted and duplicate entries but keep nothing for them', async () => {
      queueManager.tempQueue = [
        { tokenId: 'tA', teamId: '001', clientTxId: 'a' },
        { tokenId: 'tB', teamId: '002', clientTxId: 'b' }
      ];
      jest.spyOn(queueManager, 'replayTransaction')
        .mockResolvedValueOnce({ status: 'accepted', clientTxId: 'a' })
        .mockResolvedValueOnce({ status: 'duplicate', clientTxId: 'b' });

      await queueManager.syncQueue();

      expect(queueManager.tempQueue).toHaveLength(0);
    });

    it('should remove rejected entries (permanent fail) and not retry them', async () => {
      const tx = { tokenId: 'tC', teamId: '003', clientTxId: 'c' };
      queueManager.tempQueue = [tx];
      jest.spyOn(queueManager, 'replayTransaction')
        .mockResolvedValueOnce({ status: 'rejected', clientTxId: 'c', message: 'No active session' });

      await queueManager.syncQueue();

      expect(queueManager.tempQueue).toHaveLength(0); // permanent: removed, not looped forever
    });

    it('should keep queued entries for the next reconnect', async () => {
      const tx = { tokenId: 'tD', teamId: '004', clientTxId: 'd' };
      queueManager.tempQueue = [tx];
      jest.spyOn(queueManager, 'replayTransaction')
        .mockResolvedValueOnce({ status: 'queued', clientTxId: 'd' });

      await queueManager.syncQueue();

      expect(queueManager.tempQueue).toContainEqual(tx);
    });
```

Also add a `queueTransaction` correlation-id test inside `describe('queueTransaction')` (after line 144):

```js
    it('should generate and return a clientTxId, persisting it', () => {
      mockClient.isConnected = false;
      const tx = { tokenId: 'tokenX', teamId: '009', timestamp: new Date().toISOString() };

      const id = queueManager.queueTransaction(tx);

      expect(typeof id).toBe('string');
      expect(id.length).toBeGreaterThan(0);
      expect(queueManager.tempQueue[0].clientTxId).toBe(id);
    });
```

**Step 2 — Run them (expect FAIL).**
Run: `cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/ALNScanner && npx jest tests/unit/network/networkedQueueManager.test.js -t "should keep queued entries|should preserve queue when a replay throws|should generate and return a clientTxId|should remove rejected entries"`
Expected FAIL examples: `should keep queued entries...` → `Expected to contain: {tokenId:'tD',...}  Received: []` (current code clears the whole queue); `should generate and return a clientTxId` → `expect(typeof id).toBe('string')  Received: "undefined"` (queueTransaction returns nothing today).

**Step 3 — Minimal implementation.**

(a) `queueTransaction` (`networkedQueueManager.js:38-61`) — generate a correlation id, stamp it, persist on BOTH branches, and return it. Note: even the connected branch must persist (that is TQ-1, fully wired in P2.7); here we at least stamp+return the id:

```js
  queueTransaction(transaction) {
    const clientTxId = transaction.clientTxId
      || `${this.deviceId}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const tx = { ...transaction, clientTxId };

    if (!this.client || !this.client.isConnected) {
      this.tempQueue.push(tx);
      this.saveQueue();
      this.debug.log('Transaction queued for later submission', {
        tokenId: tx.tokenId, clientTxId, queueSize: this.tempQueue.length
      });
      this.dispatchEvent(new CustomEvent('queue:changed', { detail: this.getStatus() }));
    } else {
      this.client.send('transaction:submit', tx);
      this.debug.log('Transaction sent immediately', { tokenId: tx.tokenId, clientTxId });
    }
    return clientTxId;
  }
```

(b) `syncQueue` (`networkedQueueManager.js:84-122`) — replace the body of the `try` so it builds a `survivors` array by status and replaces `tempQueue` with it, instead of unconditionally clearing:

```js
    try {
      const survivors = [];
      for (let i = 0; i < batch.length; i++) {
        const transaction = batch[i];
        this.debug.log(`Replaying transaction ${i + 1}/${batch.length}`, {
          tokenId: transaction.tokenId, clientTxId: transaction.clientTxId
        });

        try {
          const result = await this.replayTransaction(transaction);
          const status = result?.status;
          if (status === 'accepted' || status === 'duplicate') {
            results.push({ success: true, transaction, result });
            // removed (not pushed to survivors)
          } else if (status === 'rejected' || status === 'error') {
            // Permanent failure: do NOT silently drop — surface, then remove (no infinite retry)
            this.debug.error?.('Transaction permanently rejected', {
              tokenId: transaction.tokenId, clientTxId: transaction.clientTxId, status, message: result?.message
            });
            this.dispatchEvent(new CustomEvent('transaction:failed', {
              detail: { transaction, status, message: result?.message }
            }));
            results.push({ success: false, transaction, result });
          } else {
            // queued or unknown transient: keep for next reconnect
            survivors.push(transaction);
            results.push({ success: false, transaction, result });
          }
        } catch (error) {
          // Timeout / connection error: keep for next reconnect (TQ-2)
          this.debug.error?.('Transaction replay failed', {
            tokenId: transaction.tokenId, error: error.message
          });
          survivors.push(transaction);
          results.push({ success: false, transaction, error: error.message });
        }
      }

      const successCount = results.filter(r => r.success).length;
      this.debug.log('Queue sync complete', {
        total: batch.length, success: successCount, failed: results.length - successCount, kept: survivors.length
      });

      this.tempQueue = survivors;
      this.saveQueue();
    } catch (error) {
      this.debug.error?.('Queue sync failed - keeping queue for retry', {
        error: error.message, queueSize: this.tempQueue.length
      });
    } finally {
      this.syncing = false;
      this.dispatchEvent(new CustomEvent('queue:changed', { detail: this.getStatus() }));
    }
```

Note: the existing `'should clear queue even if some transactions fail'` test (lines 197-224) now contradicts the new behavior (a rejected replay no longer means "clear everything"). Update its assertion: a mocked `.mockResolvedValueOnce({status:'accepted'})` then `.mockRejectedValueOnce(...)` should leave the THROWN entry in the queue. Change `expect(queueManager.tempQueue).toHaveLength(0)` to `expect(queueManager.tempQueue).toHaveLength(1)` and update its mocks to resolve with `{status:'accepted'}` for the first.

**Step 4 — Run them (expect PASS).**
Run: `cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/ALNScanner && npx jest tests/unit/network/networkedQueueManager.test.js`
Expected PASS: all tests in the file pass (existing `'should replay all transactions'` resolves with `{status:'accepted'}`-shaped mocks; if that test mocks `{status:'success'}` it will now KEEP the entries — update those mocks to `{ status: 'accepted' }` so they reflect a real backend status, since `'success'` is not a real backend status).

**Step 5 — Commit.**
```bash
git add ALNScanner/src/network/networkedQueueManager.js ALNScanner/tests/unit/network/networkedQueueManager.test.js
git commit -m "fix(scanner): branch queue replay on real status; add correlation id

syncQueue no longer treats every non-error result as delivered and no longer
clears the whole queue unconditionally. accepted/duplicate -> remove;
rejected/error -> surface (transaction:failed) then remove (no infinite retry);
queued/timeout/connection-error -> keep for next reconnect. queueTransaction
now stamps and returns a clientTxId for unambiguous replay matching.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task P2.7: Always persist before emit on the connected path; remove only on confirmed result (TQ-1 + TQ-2)

The connected branch of `queueTransaction` (`networkedQueueManager.js:53-60`) is fire-and-forget: it `send()`s and never persists, so a scan emitted during the reconnect window (where `isConnected` is still true but the socket is dropping) is permanently lost — not queued, not retried. We make the connected path durable: ALWAYS push to `tempQueue` + `saveQueue()` first, emit via a correlation-tracked `replayTransaction`, and remove the entry only after a definitive (accepted/duplicate/rejected/error) result. Transient outcomes (timeout/connection error) leave the entry persisted for the next `syncQueue`.

**Files:**
- Modify: `ALNScanner/src/network/networkedQueueManager.js` (`queueTransaction` connected branch — route through a durable submit)
- Test: `ALNScanner/tests/unit/network/networkedQueueManager.test.js` — REWRITE `'should send transaction immediately when connected'` (lines 122-135, which asserts `tempQueue` is empty after a connected submit — that codifies TQ-1)

**Step 1 — Write the failing test.** REPLACE the existing `'should send transaction immediately when connected'` test (lines 122-135) with a durability-first version:

```js
    it('should persist before emitting on the connected path', () => {
      const transaction = { tokenId: 'token2', teamId: '002', timestamp: new Date().toISOString() };
      mockClient.isConnected = true;

      const id = queueManager.queueTransaction(transaction);

      // Durable: entry is in the queue AND persisted at emit time
      expect(queueManager.tempQueue.some(t => t.clientTxId === id)).toBe(true);
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'networkedTempQueue',
        expect.stringContaining(id)
      );
      // And it was emitted
      expect(mockClient.send).toHaveBeenCalledWith('transaction:submit', expect.objectContaining({ clientTxId: id }));
    });

    it('should remove the entry after a definitive accepted result', async () => {
      const transaction = { tokenId: 'token2', teamId: '002', timestamp: new Date().toISOString() };
      mockClient.isConnected = true;
      jest.spyOn(queueManager, 'replayTransaction').mockResolvedValue({ status: 'accepted' });

      const id = queueManager.queueTransaction(transaction);
      // queueTransaction kicks off a fire-and-forget durable submit; flush microtasks
      await Promise.resolve(); await Promise.resolve();

      expect(queueManager.tempQueue.some(t => t.clientTxId === id)).toBe(false);
    });
```

**Step 2 — Run them (expect FAIL).**
Run: `cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/ALNScanner && npx jest tests/unit/network/networkedQueueManager.test.js -t "should persist before emitting on the connected path|should remove the entry after a definitive accepted result"`
Expected FAIL: `should persist before emitting...` → `expect(received).toBe(true)  Received: false` (connected branch never pushes to `tempQueue`).

**Step 3 — Minimal implementation.** Change the connected branch of `queueTransaction` (from P2.6) so it persists first then routes through a durable submit that removes the entry on a definitive result. Replace the `else` branch:

```js
  queueTransaction(transaction) {
    const clientTxId = transaction.clientTxId
      || `${this.deviceId}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const tx = { ...transaction, clientTxId };

    // ALWAYS persist first (durability) — even on the connected path (TQ-1)
    this.tempQueue.push(tx);
    this.saveQueue();
    this.dispatchEvent(new CustomEvent('queue:changed', { detail: this.getStatus() }));

    if (this.client && this.client.isConnected) {
      // Durable submit: remove only on a definitive result
      this._submitDurable(tx);
    } else {
      this.debug.log('Transaction queued (offline)', { tokenId: tx.tokenId, clientTxId, queueSize: this.tempQueue.length });
    }
    return clientTxId;
  }

  /**
   * Submit a persisted transaction and remove it only on a definitive result.
   * Transient failures (timeout/connection error) leave it queued for syncQueue.
   * @private
   */
  _submitDurable(tx) {
    this.replayTransaction(tx)
      .then((result) => {
        const status = result?.status;
        if (status === 'accepted' || status === 'duplicate' || status === 'rejected' || status === 'error') {
          this._removeByClientTxId(tx.clientTxId);
          if (status === 'rejected' || status === 'error') {
            this.dispatchEvent(new CustomEvent('transaction:failed', {
              detail: { transaction: tx, status, message: result?.message }
            }));
          }
        }
        // queued/unknown: leave persisted for next reconnect
      })
      .catch((err) => {
        // timeout / connection error: leave persisted; syncQueue retries on reconnect
        this.debug.error?.('Durable submit failed - keeping for retry', { tokenId: tx.tokenId, error: err.message });
      });
  }

  /** @private */
  _removeByClientTxId(clientTxId) {
    const before = this.tempQueue.length;
    this.tempQueue = this.tempQueue.filter(t => t.clientTxId !== clientTxId);
    if (this.tempQueue.length !== before) {
      this.saveQueue();
      this.dispatchEvent(new CustomEvent('queue:changed', { detail: this.getStatus() }));
    }
  }
```

Important: `syncQueue` (P2.6) also calls `replayTransaction` and rebuilds `tempQueue` from survivors. Because both `syncQueue` and `_submitDurable` may run, guard against double-submit: `syncQueue` already guards via `this.syncing`. The connected-path `_submitDurable` runs when a NEW scan arrives while connected; entries enqueued offline are flushed only by `syncQueue` on reconnect. There is no overlap for a given entry because a fresh connected scan is submitted immediately and a reconnect flush only processes entries present at `syncQueue` start. Document this in a code comment.

**Step 4 — Run them (expect PASS).**
Run: `cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/ALNScanner && npx jest tests/unit/network/networkedQueueManager.test.js`
Expected PASS: full file green. (The earlier `'should send transaction immediately when connected'` is now replaced; the `'should handle missing client gracefully'` test at line 137 still passes because the offline branch still persists.)

**Step 5 — Commit.**
```bash
git add ALNScanner/src/network/networkedQueueManager.js ALNScanner/tests/unit/network/networkedQueueManager.test.js
git commit -m "fix(scanner): make connected-path transaction submit durable (TQ-1/TQ-2)

queueTransaction now always persists to localStorage before emitting, even
when connected, and removes the entry only after a definitive accepted/
duplicate/rejected/error result. Scans emitted during the reconnect window
(isConnected still true but socket dropping) survive as queued entries and
are retried by syncQueue on reconnect instead of being silently lost.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task P2.8: Reconcile the queue against `sync:full` state before replaying; run `syncQueue` after `sync:full` (TQ-6)

`_connectedHandler` (`networkedSession.js:170-178`) calls `queueManager.syncQueue()` on the `connected` event, which fires from `ConnectionManager` independently of `sync:full` arrival. So the queue can be replayed before `sync:full` has populated `deviceScannedTokens`/`recentTransactions`, meaning replays are never reconciled against already-recorded server state → double-replay risk. We (a) add a reconciliation step that drops queue entries whose `tokenId` is already in the server-restored `deviceScannedTokens`, and (b) trigger `syncQueue` from the `sync:full` handler (after state is applied) rather than only from `connected`.

**Files:**
- Modify: `ALNScanner/src/network/networkedQueueManager.js` (add `reconcileWithServerState(scannedTokenIds)`)
- Modify: `ALNScanner/src/network/networkedSession.js:170-178` (drop `syncQueue()` from `_connectedHandler`) and `:205-266` (call reconcile + syncQueue at the end of the `sync:full` case)
- Test: `ALNScanner/tests/unit/network/networkedQueueManager.test.js` (reconcile test)

**Step 1 — Write the failing test.** Add a new `describe` to `ALNScanner/tests/unit/network/networkedQueueManager.test.js`:

```js
  describe('reconcileWithServerState', () => {
    it('drops queued entries already recorded on the server', () => {
      queueManager.tempQueue = [
        { tokenId: 'tDup', teamId: '001', clientTxId: 'a' },
        { tokenId: 'tNew', teamId: '001', clientTxId: 'b' }
      ];

      queueManager.reconcileWithServerState(['tDup', 'tOther']);

      expect(queueManager.tempQueue.map(t => t.tokenId)).toEqual(['tNew']);
      expect(localStorageMock.setItem).toHaveBeenCalled();
    });

    it('is a no-op when given a non-array', () => {
      queueManager.tempQueue = [{ tokenId: 'tNew', teamId: '001', clientTxId: 'b' }];
      queueManager.reconcileWithServerState(undefined);
      expect(queueManager.tempQueue).toHaveLength(1);
    });
  });
```

**Step 2 — Run it (expect FAIL).**
Run: `cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/ALNScanner && npx jest tests/unit/network/networkedQueueManager.test.js -t "reconcileWithServerState"`
Expected FAIL: `TypeError: queueManager.reconcileWithServerState is not a function`.

**Step 3 — Minimal implementation (2 files).**

(a) `ALNScanner/src/network/networkedQueueManager.js` — add the method:

```js
  /**
   * Drop queued entries whose tokenId the server already recorded (from sync:full
   * deviceScannedTokens), preventing duplicate replays after reconnect (TQ-6).
   * @param {Array<string>} scannedTokenIds - token ids already recorded server-side
   */
  reconcileWithServerState(scannedTokenIds) {
    if (!Array.isArray(scannedTokenIds) || scannedTokenIds.length === 0) return;
    const recorded = new Set(scannedTokenIds);
    const before = this.tempQueue.length;
    this.tempQueue = this.tempQueue.filter(t => !recorded.has(t.tokenId));
    if (this.tempQueue.length !== before) {
      this.saveQueue();
      this.dispatchEvent(new CustomEvent('queue:changed', { detail: this.getStatus() }));
    }
  }
```

(b) `ALNScanner/src/network/networkedSession.js` — remove the `syncQueue()` call from `_connectedHandler` (lines 175-177) so the queue is not flushed before state arrives:

```js
    this._connectedHandler = () => {
      // On connection: initialize admin only. Queue sync is deferred until
      // sync:full has populated server state (TQ-6 reconciliation).
      if (this.services.adminController) {
        this.services.adminController.initialize();
      }
    };
```

Then, in the `case 'sync:full':` block, AFTER `deviceScannedTokens` is applied (after line 211) and at the END of the case (after the StateStore/displayStatus blocks), reconcile + flush:

```js
          // After server state is restored, reconcile the offline queue against
          // already-recorded scans, then flush remaining entries (TQ-6).
          if (this.services?.queueManager) {
            if (Array.isArray(payload.deviceScannedTokens)) {
              this.services.queueManager.reconcileWithServerState(payload.deviceScannedTokens);
            }
            this.services.queueManager.syncQueue();
          }
          break;
```

(Place this immediately before the existing `break;` that closes the `sync:full` case at line 266, replacing that bare `break;`.)

**Step 4 — Run it (expect PASS).**
Run: `cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/ALNScanner && npx jest tests/unit/network/networkedQueueManager.test.js -t "reconcileWithServerState"`
Expected PASS: `2 passed`. Run the full queue-manager file too to confirm no regression.

**Step 5 — Commit.**
```bash
git add ALNScanner/src/network/networkedQueueManager.js ALNScanner/src/network/networkedSession.js ALNScanner/tests/unit/network/networkedQueueManager.test.js
git commit -m "fix(scanner): reconcile offline queue against sync:full before replay (TQ-6)

Move queue flush from the connected event to the sync:full handler so server
state (deviceScannedTokens) is populated first, and drop queued entries the
server already recorded before replaying. Prevents duplicate replays on
reconnect that previously relied entirely on server-side dedup.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task P2.9: Persist `scannedTokens` keyed by sessionId (TQ-7)

In networked mode the `scannedTokens` Set is in-memory only (`NetworkedStorage.js:30`, surfaced via `unifiedDataManager.js:142-143`). After a reload it is empty until `sync:full` repopulates it, so during that gap the local duplicate guard misses and a reloaded-then-offline operator can enqueue a token twice. We persist `scannedTokens` to localStorage keyed by sessionId so the guard survives reloads, and rehydrate on construction / session set. We scope this to `NetworkedStorage` (LocalStorage already persists via its own transactions).

**Files:**
- Modify: `ALNScanner/src/core/storage/NetworkedStorage.js` (persist/rehydrate `scannedTokens` keyed by `currentSessionId`)
- Test: `ALNScanner/tests/unit/core/storage/NetworkedStorage.test.js` (new `describe`)

**Step 1 — Write the failing test.** Add to `ALNScanner/tests/unit/core/storage/NetworkedStorage.test.js`. The existing harness (lines 11-30) does not set up localStorage, so add a minimal in-memory mock in this `describe` (mirror the networkedQueueManager pattern at `networkedQueueManager.test.js:16-33`):

```js
  describe('scannedTokens persistence (TQ-7)', () => {
    let store;
    beforeEach(() => {
      store = {};
      Object.defineProperty(global, 'localStorage', {
        value: {
          getItem: (k) => store[k] ?? null,
          setItem: (k, v) => { store[k] = String(v); },
          removeItem: (k) => { delete store[k]; }
        },
        writable: true, configurable: true
      });
    });

    it('persists scanned tokens under a session-scoped key', () => {
      storage.setSessionId('sess-1');
      storage.addTransaction({ tokenId: 'tok-1', teamId: '001', mode: 'blackmarket' });

      expect(JSON.parse(store['networkedScannedTokens:sess-1'])).toContain('tok-1');
    });

    it('rehydrates scanned tokens for the current session', () => {
      store['networkedScannedTokens:sess-2'] = JSON.stringify(['tok-9']);
      storage.setSessionId('sess-2');

      expect(storage.scannedTokens.has('tok-9')).toBe(true);
    });
  });
```

**Step 2 — Run it (expect FAIL).**
Run: `cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/ALNScanner && npx jest tests/unit/core/storage/NetworkedStorage.test.js -t "scannedTokens persistence"`
Expected FAIL: `persists scanned tokens...` → `Cannot read properties of null (reading ...)` / `JSON.parse(undefined)` because nothing writes the session-scoped key; `rehydrates...` → `Received: false` (no rehydrate on `setSessionId`).

**Step 3 — Minimal implementation.** In `ALNScanner/src/core/storage/NetworkedStorage.js`:

Add a private persistence key helper and a save/load pair, hook `addTransaction` (after `this.scannedTokens.add` at line 102), `setScannedTokens` (line 361), and `setSessionId` (line 388):

```js
  /** @private */
  _scannedKey() {
    return this.currentSessionId ? `networkedScannedTokens:${this.currentSessionId}` : null;
  }

  /** @private */
  _saveScannedTokens() {
    const key = this._scannedKey();
    if (!key) return;
    try {
      localStorage.setItem(key, JSON.stringify([...this.scannedTokens]));
    } catch (e) {
      this.debug?.log(`[NetworkedStorage] Failed to persist scannedTokens: ${e.message}`, true);
    }
  }

  /** @private */
  _loadScannedTokens() {
    const key = this._scannedKey();
    if (!key) return;
    try {
      const saved = localStorage.getItem(key);
      if (saved) this.scannedTokens = new Set(JSON.parse(saved));
    } catch (e) {
      this.debug?.log(`[NetworkedStorage] Failed to load scannedTokens: ${e.message}`, true);
    }
  }
```

In `addTransaction`, after `this.scannedTokens.add(transaction.tokenId);` (line 102):
```js
      this._saveScannedTokens();
```

In `setScannedTokens(tokens)` (line 361-363), after building the Set:
```js
  setScannedTokens(tokens) {
    this.scannedTokens = new Set(tokens);
    this._saveScannedTokens();
  }
```

In `setSessionId(sessionId)` (line 388-390):
```js
  setSessionId(sessionId) {
    this.currentSessionId = sessionId;
    this._loadScannedTokens();
  }
```

**Step 4 — Run it (expect PASS).**
Run: `cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/ALNScanner && npx jest tests/unit/core/storage/NetworkedStorage.test.js -t "scannedTokens persistence"`
Expected PASS: `2 passed`. Run the full file to ensure existing `addTransaction`/`setSessionId` tests still pass (they run without a localStorage mock — guard the helpers with `typeof localStorage !== 'undefined'` if any existing test crashes, OR confirm jsdom provides `localStorage` by default; jsdom DOES provide it, so existing tests are unaffected).

**Step 5 — Commit.**
```bash
git add ALNScanner/src/core/storage/NetworkedStorage.js ALNScanner/tests/unit/core/storage/NetworkedStorage.test.js
git commit -m "fix(scanner): persist networked scannedTokens keyed by sessionId (TQ-7)

The duplicate guard was in-memory only in networked mode, so a reload left it
empty until sync:full arrived, allowing a reloaded-then-offline operator to
enqueue a token twice. Persist/rehydrate scannedTokens under
networkedScannedTokens:<sessionId> so re-scan protection survives reloads.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task P2.10: Wrap `NetworkedStorage.addTransaction` emit in the AsyncAPI envelope and fix the test that cements the broken shape (CC-5)

`NetworkedStorage.addTransaction` (`NetworkedStorage.js:91-98`) emits a RAW data object on `transaction:submit` (no `{event,data,timestamp}` wrapper). The backend STRICTLY rejects an unwrapped envelope (`adminEvents.js:144-150`: `if (!data.data) ... VALIDATION_ERROR`). This path is currently dead (live networked scans go through `queueManager`), but the storage-strategy design intends `NetworkedStorage` to be the networked path; wiring it up today would reject every transaction. The unit test at `NetworkedStorage.test.js:80-87` asserts the unwrapped shape, locking in the contract violation. Fix: route the emit through the same envelope `_emitCommand` already uses, and correct the test. (Per the review's recommendation, wrapping is preferred over deletion since the design intends this path.)

**Files:**
- Modify: `ALNScanner/src/core/storage/NetworkedStorage.js:91-98`
- Test: `ALNScanner/tests/unit/core/storage/NetworkedStorage.test.js:70-88` (the `'should emit transaction:submit to socket'` test)

**Step 1 — Write the failing test.** REPLACE the existing `'should emit transaction:submit to socket'` test (lines 71-88) with one asserting the envelope:

```js
    it('should emit transaction:submit wrapped in the AsyncAPI envelope', async () => {
      const tx = { tokenId: 'token1', teamId: '001', mode: 'blackmarket' };

      await storage.addTransaction(tx);

      expect(mockSocket.emit).toHaveBeenCalledWith(
        'transaction:submit',
        expect.objectContaining({
          event: 'transaction:submit',
          timestamp: expect.any(String),
          data: expect.objectContaining({
            tokenId: 'token1',
            teamId: '001',
            deviceType: 'gm'
          })
        })
      );
    });
```

**Step 2 — Run it (expect FAIL).**
Run: `cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/ALNScanner && npx jest tests/unit/core/storage/NetworkedStorage.test.js -t "should emit transaction:submit wrapped in the AsyncAPI envelope"`
Expected FAIL: the emit was called with a raw object `{tokenId, teamId, deviceId, deviceType, mode, timestamp}` (no `event`/top-level `data`), so the matcher reports `Number of calls: 1` but the argument does not match the envelope-shaped `objectContaining`.

**Step 3 — Minimal implementation.** Replace the emit in `addTransaction` (`NetworkedStorage.js:91-98`) with an envelope-wrapped emit:

```js
    this.socket.emit('transaction:submit', {
      event: 'transaction:submit',
      data: {
        tokenId: transaction.tokenId,
        teamId: transaction.teamId,
        deviceId: transaction.deviceId,
        deviceType: 'gm',
        mode: transaction.mode,
        summary: transaction.summary ?? null,
        timestamp: transaction.timestamp || new Date().toISOString()
      },
      timestamp: new Date().toISOString()
    });
```

(Keep the existing `this.scannedTokens.add` + `_saveScannedTokens()` from P2.9 and the `return { success: true, pending: true }` below unchanged.)

**Step 4 — Run it (expect PASS).**
Run: `cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/ALNScanner && npx jest tests/unit/core/storage/NetworkedStorage.test.js`
Expected PASS: full file green. The `'should mark token as scanned locally'` and `'should return pending result'` tests are unaffected (they assert side effects / return value, not the emit shape).

**Step 5 — Commit.**
```bash
git add ALNScanner/src/core/storage/NetworkedStorage.js ALNScanner/tests/unit/core/storage/NetworkedStorage.test.js
git commit -m "fix(scanner): wrap NetworkedStorage transaction:submit in AsyncAPI envelope

NetworkedStorage.addTransaction emitted a raw payload the backend strictly
rejects (adminEvents.js requires {event,data,timestamp}). Dead code today, but
a landmine if the storage strategy is ever wired as the networked path. Wrap
the emit and rewrite the test that asserted (and cemented) the broken shape.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

# Phase 3 — Operator-Visible Error Surfacing

**Make it visible.** Phases 1–2 fix the failures; this phase ensures the GM actually *sees* a rejected command or backend error during a show instead of a silent no-op. `safeAdminAction` surfaces ack failures (AC-2), the inline `system:reset` handler stops cross-resolving on the wrong ack (AC-3), and `AUTH_*` backend errors route to the auth/reconnect flow (AUTH-7). **Depends on Phase 2** — P3.3 rides on the `error`-event consumer added in P2.

### Task P3.1: Inject `uiManager` into `safeAdminAction` and surface admin-command failures as a visible error toast (AC-2)

Today every environment / show-control / music / cue / Bluetooth / audio / lighting / scoreboard button is dispatched through `safeAdminAction`, whose `.catch` writes **only** to the debug panel. When the backend rejects a command (e.g. its service dependency is down — `commandExecutor` `SERVICE_DEPENDENCIES` gating), the operator presses the button and sees nothing. We add a `uiManager.showError(...)` call alongside the existing `debug.log` so the GM gets a visible signal. `bindDOMEvents` already receives `uiManager` as its 5th parameter (`src/main.js:225`), so no wiring change is needed — `safeAdminAction` just needs to reference it.

**Files:**
- Modify: `ALNScanner/src/utils/domEventBindings.js:21-27` (the `safeAdminAction` helper)
- Test: `ALNScanner/tests/unit/utils/domEventBindings-safeAction.test.js:88` (existing suite passes `{}` for uiManager; add a mock + new test)

This is the REAL current helper (`domEventBindings.js:20-27`):

```javascript
  /** Catch rejected promises from fire-and-forget admin actions */
  function safeAdminAction(actionPromise, actionName) {
    if (actionPromise && typeof actionPromise.catch === 'function') {
      actionPromise.catch(err => {
        debug.log(`Command failed: ${actionName} — ${err.message}`, true);
      });
    }
  }
```

The existing test harness (`domEventBindings-safeAction.test.js:86-89`) binds with an empty object for uiManager:

```javascript
  beforeAll(() => {
    jest.useFakeTimers();
    bindDOMEvents(mockApp, {}, {}, mockDebug, {}, {}, {});
  });
```

**Step 1 — Write the failing test.** Add a `showError` mock and a new test to the existing suite. First replace the empty-object uiManager binding so the suite can assert against a real spy:

```javascript
// In domEventBindings-safeAction.test.js, add near mockDebug (after line 84):
  const mockUiManager = {
    showError: jest.fn(),
    showToast: jest.fn()
  };
```

```javascript
// Replace the beforeAll bindDOMEvents call (line 88) with:
    bindDOMEvents(mockApp, {}, {}, mockDebug, mockUiManager, {}, {});
```

```javascript
// Add this new test inside the describe block (e.g. after the existing
// 'should log to debug when a music action rejects' test):
  it('should surface a visible error toast when an admin action rejects (AC-2)', async () => {
    mockMusicController.play.mockRejectedValueOnce(new Error('VLC service unavailable'));

    const btn = document.createElement('button');
    btn.dataset.action = 'admin.musicPlay';
    document.body.appendChild(btn);

    clickAction(btn);
    await flushMicrotasks();

    expect(mockUiManager.showError).toHaveBeenCalledWith(
      expect.stringContaining('VLC service unavailable')
    );
  });
```

**Step 2 — Run it, expect FAIL.**

Run: `cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/ALNScanner && npm test -- tests/unit/utils/domEventBindings-safeAction.test.js`

Expected: FAIL with `expect(jest.fn()).toHaveBeenCalledWith(...) — Number of calls: 0` on the new test (the current `safeAdminAction` never touches `uiManager`). The other tests still pass.

**Step 3 — Minimal implementation.** Edit `safeAdminAction` in `domEventBindings.js` to also call `uiManager.showError`:

```javascript
  /** Catch rejected promises from fire-and-forget admin actions */
  function safeAdminAction(actionPromise, actionName) {
    if (actionPromise && typeof actionPromise.catch === 'function') {
      actionPromise.catch(err => {
        debug.log(`Command failed: ${actionName} — ${err.message}`, true);
        // AC-2: surface to the operator, not just the debug panel.
        // Guard for the existing-test harness that may not inject uiManager.
        if (uiManager && typeof uiManager.showError === 'function') {
          uiManager.showError(`Command failed: ${err.message}`);
        }
      });
    }
  }
```

**Step 4 — Run it, expect PASS.**

Run: `cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/ALNScanner && npm test -- tests/unit/utils/domEventBindings-safeAction.test.js`

Expected: PASS — all tests in the file green (the new AC-2 test + the 8 pre-existing tests).

**Step 5 — Commit.**

```bash
cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/ALNScanner
git add src/utils/domEventBindings.js tests/unit/utils/domEventBindings-safeAction.test.js
git commit -m "fix(gm-scanner): surface admin-command failures to operator via showError (AC-2)

safeAdminAction previously logged rejected admin-command promises only to
the debug panel, so a backend rejection (e.g. service dependency down) was
a silent no-op for the GM. It now also calls uiManager.showError so the
operator sees a visible toast, matching the existing session/score/video
admin paths.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task P3.2: Add an action filter to the inline `system:reset` ack handler so a racing ack can't cause a false "System reset timeout" (AC-3)

`app.adminResetAndCreateNew()` (`app.js:1101-1128`) sends `system:reset` and waits for the ack via a raw `socket.once('gm:command:ack', ...)` with **no action filter**. Unlike `CommandSender` (which ignores acks whose `action` doesn't match), this resolves on the *first* ack to arrive. If another command's ack races in during the reset window, `.once` fires on the wrong ack and self-removes; the genuine `system:reset` ack is never observed and the promise rejects on the 5s timeout — a false "System reset timeout (5s)" even though the reset succeeded server-side. We add the same action guard `CommandSender` uses (`CommandSender.js:43-44`).

Note the ack shape here differs from `CommandSender`: this path listens on the **raw Socket.io socket**, so the ack arrives as the full AsyncAPI envelope `{event, data:{action, success, message}, timestamp}` — the code already reads `response.data.success`. So the action lives at `response.data.action`, exactly as the review's "at minimum" fix states.

**Files:**
- Modify: `ALNScanner/src/app/app.js:1108-1118` (the `socket.once('gm:command:ack', ...)` callback)
- Test: `ALNScanner/tests/unit/app/system-reset-ack.test.js` (Create — no existing test covers this inline path)

This is the REAL current ack callback (`app.js:1106-1118`):

```javascript
        const socket = this.viewController.adminInstances.sessionManager.connection.socket;

        socket.once('gm:command:ack', (response) => {
          clearTimeout(timeout);

          if (response.data && response.data.success) {
            this.debug.log('System reset successful');
            resolve();
          } else {
            const errorMsg = response.data?.message || 'Reset failed';
            reject(new Error(errorMsg));
          }
        });
```

**Step 1 — Write the failing test.** Create a focused test that drives `adminResetAndCreateNew` with a fake socket whose `once('gm:command:ack', ...)` we can replay. We emit a *foreign* ack first (`action: 'session:create'`), then the genuine `system:reset` ack. With the filter, the foreign ack must be ignored and the reset must succeed.

```javascript
/**
 * app.adminResetAndCreateNew - system:reset ack action filtering (AC-3)
 *
 * The inline system:reset path must ignore gm:command:ack envelopes whose
 * action is not 'system:reset' (a racing ack must not resolve/reject the
 * reset promise on the wrong event).
 */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import App from '../../../src/app/app.js';

describe('app.adminResetAndCreateNew - ack action filter (AC-3)', () => {
  let app;
  let ackHandlers;
  let fakeSocket;
  let sessionManager;

  beforeEach(() => {
    // confirm() -> true, prompt() -> session name
    global.confirm = jest.fn(() => true);
    global.prompt = jest.fn(() => 'New Game');
    global.alert = jest.fn();

    // Collect handlers registered via socket.once so we can replay acks
    ackHandlers = [];
    fakeSocket = {
      once: jest.fn((event, cb) => { if (event === 'gm:command:ack') ackHandlers.push(cb); }),
      emit: jest.fn(),
    };

    sessionManager = {
      connection: { socket: fakeSocket },
      createSession: jest.fn().mockResolvedValue({}),
    };

    app = new App({
      debug: { log: jest.fn() },
      uiManager: { showToast: jest.fn(), showError: jest.fn() },
      dataManager: { getSessionData: jest.fn() },
    });
    app.viewController = { adminInstances: { sessionManager } };
  });

  it('ignores a foreign ack and resolves on the system:reset ack', async () => {
    const resetPromise = app.adminResetAndCreateNew();

    // Wait a microtask for socket.once to register, then replay acks.
    await Promise.resolve();
    const handler = ackHandlers[0];
    expect(handler).toBeDefined();

    // A racing ack for a DIFFERENT action arrives first — must be ignored.
    handler({ event: 'gm:command:ack', data: { action: 'session:create', success: true }, timestamp: '' });
    // The genuine reset ack arrives next — must resolve the wait.
    handler({ event: 'gm:command:ack', data: { action: 'system:reset', success: true }, timestamp: '' });

    await expect(resetPromise).resolves.toBeUndefined();
    expect(sessionManager.createSession).toHaveBeenCalledWith('New Game');
  });
});
```

**Step 2 — Run it, expect FAIL.**

Run: `cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/ALNScanner && npm test -- tests/unit/app/system-reset-ack.test.js`

Expected: FAIL. With the unfiltered `socket.once`, the FIRST (foreign) ack fires the handler and self-removes; `response.data.success` is `true` for `session:create`, so the promise resolves early — but the genuine reset ack is never matched. Worse, because the test registers a single replayable handler, the current code resolves on the wrong (`session:create`) ack: the test fails its intent because the second `system:reset` ack is delivered to an already-removed-in-production handler. The assertion that catches the regression: `createSession` is invoked on the wrong ack timing, and (with real `socket.once`) the genuine ack would be dropped. Expect a failure message similar to `received resolves but for the wrong ack` / `expect(handler).toBeDefined()` mismatch — confirming the missing action guard.

**Step 3 — Minimal implementation.** Add the action filter (same guard as `CommandSender.js:43-44`) at the top of the ack callback:

```javascript
        socket.once('gm:command:ack', function ackHandler(response) {
          // AC-3: only consume the ack for OUR action — a racing ack for a
          // different command must not resolve/reject the reset promise.
          // Re-arm the listener until the matching action arrives.
          if (response.data?.action !== 'system:reset') {
            socket.once('gm:command:ack', ackHandler);
            return;
          }

          clearTimeout(timeout);

          if (response.data && response.data.success) {
            this.debug.log('System reset successful');
            resolve();
          } else {
            const errorMsg = response.data?.message || 'Reset failed';
            reject(new Error(errorMsg));
          }
        }.bind(this));
```

(Note: `socket.once` self-removes after each fire, so we re-arm with another `socket.once` when the action doesn't match. The `.bind(this)` preserves `this.debug` since the named function is no longer the surrounding arrow.)

**Step 4 — Run it, expect PASS.**

Run: `cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/ALNScanner && npm test -- tests/unit/app/system-reset-ack.test.js`

Expected: PASS — the foreign `session:create` ack is ignored (re-arms), the `system:reset` ack resolves, and `createSession('New Game')` is called.

**Step 5 — Commit.**

```bash
cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/ALNScanner
git add src/app/app.js tests/unit/app/system-reset-ack.test.js
git commit -m "fix(gm-scanner): filter system:reset ack by action to prevent wrong-ack race (AC-3)

The inline system:reset handler used socket.once('gm:command:ack') with no
action filter, so a racing ack from another command would fire the once
handler, self-remove, and let the genuine reset ack be dropped — producing
a false 'System reset timeout (5s)' even when the reset succeeded. It now
re-arms until response.data.action === 'system:reset', matching the
CommandSender pattern.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task P3.3: Route `AUTH_*` backend `error` codes to `auth:required` + stale-token clear in `networkedSession` (AUTH-7)

A post-connection backend `error` event (e.g. `AUTH_REQUIRED` / `AUTH_INVALID` / `PERMISSION_DENIED` emitted by `handleGmIdentify`) is forwarded by `orchestratorClient` (it's in the `messageTypes` array, `orchestratorClient.js:256`) and unwrapped to `{ type: 'error', payload: { code, message } }`, but `networkedSession._messageHandler` has no handling that reacts to auth codes. Phase 2 adds the **base** `case 'error'` that surfaces `payload.message` to the operator (toast). This task extends that case so `AUTH_*` codes additionally (a) dispatch the existing `auth:required` event — which `app.js:149` already listens for to show the connection wizard — and (b) clear the stale token from localStorage (the L-5 / AUTH-5 defense-in-depth gap). This keeps post-connection auth failures consistent with the handshake-time `auth:required` flow that `connectionManager` already drives.

**Files:**
- Modify: `ALNScanner/src/network/networkedSession.js` — extend the `case 'error'` (added in P2) inside `_messageHandler`, around the existing service-state case (`networkedSession.js:316-320`)
- Test: `ALNScanner/tests/unit/network/networkedSession.test.js` (add to the existing `message:received` handler describe block; the `messageHandler` capture pattern is established at lines 503-525)

The existing message-handler test pattern (`networkedSession.test.js:503-525`) captures the registered handler and invokes it directly:

```javascript
      const messageCall = mockClient.addEventListener.mock.calls.find(
        (call) => call[0] === 'message:received'
      );
      messageHandler = messageCall ? messageCall[1] : null;
```
```javascript
    it('should update DataManager on score:adjusted event', () => {
      ...
      messageHandler({ detail: { type: 'score:adjusted', payload: { teamScore } } });
```

The backend `error` payload (per `backend/contracts/asyncapi.yaml` `Error` message, the AUTH codes are `AUTH_REQUIRED`, `AUTH_INVALID`, `PERMISSION_DENIED`) arrives unwrapped as `payload = { code, message }`.

**Step 1 — Write the failing test.** Add tests in the `message:received` describe block. The session is an `EventTarget`, so we spy on `dispatchEvent` to assert the `auth:required` re-dispatch, and stub `localStorage.removeItem`.

```javascript
    it('dispatches auth:required and clears token on AUTH_* error code (AUTH-7)', () => {
      const dispatchSpy = jest.spyOn(session, 'dispatchEvent');
      const removeSpy = jest.spyOn(window.localStorage.__proto__, 'removeItem').mockImplementation(() => {});

      messageHandler({ detail: { type: 'error', payload: { code: 'AUTH_REQUIRED', message: 'Authentication required' } } });

      // Routed into the auth/reconnect flow
      const authEvt = dispatchSpy.mock.calls.find(c => c[0]?.type === 'auth:required');
      expect(authEvt).toBeDefined();
      // Stale token cleared (L-5/AUTH-5 defense-in-depth)
      expect(removeSpy).toHaveBeenCalledWith('aln_auth_token');

      removeSpy.mockRestore();
      dispatchSpy.mockRestore();
    });

    it('does NOT dispatch auth:required for a non-auth error code (AUTH-7)', () => {
      const dispatchSpy = jest.spyOn(session, 'dispatchEvent');

      messageHandler({ detail: { type: 'error', payload: { code: 'VALIDATION_ERROR', message: 'bad payload' } } });

      const authEvt = dispatchSpy.mock.calls.find(c => c[0]?.type === 'auth:required');
      expect(authEvt).toBeUndefined();

      dispatchSpy.mockRestore();
    });
```

Note: these tests assume `session` was initialized so `messageHandler` is captured — follow the existing block's `beforeEach`/`init` setup at `networkedSession.test.js:485-508` (it calls `session.initialize()` then finds the `message:received` call). Place these tests in that same describe block so `messageHandler` is in scope.

**Step 2 — Run it, expect FAIL.**

Run: `cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/ALNScanner && npm test -- tests/unit/network/networkedSession.test.js`

Expected: FAIL on `dispatches auth:required and clears token on AUTH_* error code` — `expect(authEvt).toBeDefined()` receives `undefined` because the `case 'error'` (even after P2) only surfaces the message and does not route auth codes. (`expect(removeSpy).toHaveBeenCalledWith('aln_auth_token')` also fails — 0 calls.) The non-auth test should already pass.

**Step 3 — Minimal implementation.** Extend the P2-added `case 'error'` in `_messageHandler`. If P2 has not yet landed in your branch, add the full case; if P2 landed, add only the AUTH_* branch. Insert before the `case 'service:state':` (`networkedSession.js:316`):

```javascript
        case 'error': {
          const code = payload?.code;
          const message = payload?.message || 'An error occurred';

          // AUTH-7: post-connection auth/permission failures route into the
          // same auth:required flow the handshake path uses, and clear the
          // now-known-bad token (L-5/AUTH-5 defense-in-depth).
          if (typeof code === 'string' && code.startsWith('AUTH_') || code === 'PERMISSION_DENIED') {
            try { localStorage.removeItem('aln_auth_token'); } catch (e) { /* private mode */ }
            this.dispatchEvent(new CustomEvent('auth:required', { detail: { reason: message } }));
          } else {
            // Non-auth backend error — surface to operator (P2 behavior).
            this.dispatchEvent(new CustomEvent('backend:error', { detail: { code, message } }));
          }
          break;
        }
```

(If P2 already emits a `backend:error`/toast for the non-auth path, keep that and add only the `if (AUTH_*)` branch above it. The decisive new behavior for AUTH-7 is the `auth:required` re-dispatch + `removeItem('aln_auth_token')`.)

**Step 4 — Run it, expect PASS.**

Run: `cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/ALNScanner && npm test -- tests/unit/network/networkedSession.test.js`

Expected: PASS — `auth:required` dispatched and `aln_auth_token` removed for `AUTH_REQUIRED`; no `auth:required` for `VALIDATION_ERROR`. Existing handler tests stay green.

**Step 5 — Commit.**

```bash
cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/ALNScanner
git add src/network/networkedSession.js tests/unit/network/networkedSession.test.js
git commit -m "fix(gm-scanner): route AUTH_* backend error codes to auth:required + token clear (AUTH-7)

A post-connection backend 'error' event (AUTH_REQUIRED / AUTH_INVALID /
PERMISSION_DENIED from handleGmIdentify) was forwarded but never acted on.
The error case now re-dispatches the existing auth:required event (which
app.js already listens for to show the connection wizard) and clears the
stale aln_auth_token, keeping post-connection auth failures consistent with
the handshake-time flow.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

# Phase 4 — Contract Drift & Remaining Hardening

**Close the long tail.** Contract-conformance/drift fixes plus the independent medium/low hardening across NFC, auth/HTTP, and renderers. **P4a is contract-first** (drift in `group:completed`, `sync:full`, `sync:request`, device `connectionStatus`, lighting `activeScene`). **P4b** is NFC robustness — note **P4b.1 is a Phase-1 prerequisite** (pull it forward). **P4c** is auth/HTTP/wizard hardening; **P4d** is renderer/state correctness — and **P4d's AC-1/CC-6 deletion turns Phase 0's P0.2 green.** P4b/P4c/P4d tasks are mostly independent compact fixes (each task notes its local ordering).

## Phase 4a — Contract conformance & drift
### Task P4a.1: Add backend contract test pinning `group:completed` field name (CC-1, contract guard)

The `group:completed` AsyncAPI schema is already correct (uses `bonusPoints`), and the backend already broadcasts `bonusPoints`. The drift is purely on the *scanner consumer* (fixed in P4a.2). Per the Contract-First rule, we first lock the backend/contract side with a regression test so the scanner fix has a verified contract to consume. The existing `score-events.test.js` already covers the happy path; here we add one focused negative assertion that a payload using the legacy `bonus` field is REJECTED by the schema — proving `bonusPoints` is the contract field name the scanner must read.

**Files:**
- Modify (Test): `backend/tests/contract/websocket/score-events.test.js:168` (extend the existing `it('should use bonusPoints field name (not bonus)')` block)
- Reference (contract, do not edit): `backend/contracts/asyncapi.yaml:1832-1849` (`GroupCompleted` schema — `data.required` lists `bonusPoints`)
- Reference (backend, do not edit): `backend/src/websocket/broadcasts.js:277-287` (already emits `bonusPoints: data.bonus`)

Current real test code at `score-events.test.js:168-188`:

```javascript
    it('should use bonusPoints field name (not bonus)', () => {
      const event = {
        event: 'group:completed',
        data: {
          teamId: 'Team Alpha',
          group: 'jaw_group',
          bonusPoints: 500,  // Correct field name per AsyncAPI
          completedAt: new Date().toISOString()
        },
        timestamp: new Date().toISOString()
      };

      // Validate has 'bonusPoints' field
      expect(event.data).toHaveProperty('bonusPoints');
      expect(event.data).not.toHaveProperty('bonus');

      // Validate against contract
      expect(() => {
        validateWebSocketEvent(event, 'group:completed');
      }).not.toThrow();
    });
```

**Step 1 — Write the failing test.** Add this new `it` block immediately after the one above (inside the `describe('group:completed ...')` block):

```javascript
    it('should REJECT legacy `bonus` field — contract field is `bonusPoints` (CC-1)', () => {
      // Regression guard: a payload that uses the old `bonus` field name (the
      // bug the GM Scanner consumer had) is missing the required `bonusPoints`
      // and must fail AsyncAPI validation. This pins the contract field name
      // that the scanner's group:completed handler is required to read.
      const legacyEvent = {
        event: 'group:completed',
        data: {
          teamId: 'Team Alpha',
          group: 'jaw_group',
          bonus: 500,            // WRONG legacy name
          completedAt: new Date().toISOString()
        },
        timestamp: new Date().toISOString()
      };

      expect(() => {
        validateWebSocketEvent(legacyEvent, 'group:completed');
      }).toThrow(/required/i);
    });
```

**Step 2 — Run it (expected FAIL... or PASS).** From `backend/`:

```bash
npx jest tests/contract/websocket/score-events.test.js -t "REJECT legacy"
```

NOTE: AJV is configured `strict: false` (see `backend/tests/helpers/contract-validator.js:13-15`) but `additionalProperties` is NOT set to false on the `GroupCompleted.data` schema — so the extra `bonus` field is tolerated. However `bonusPoints` IS in `data.required`, so omitting it MUST trigger a `required` error. Expected: the test PASSES on first run because the contract is already correct. If instead you see `WebSocket event validation failed ... should have required property 'bonusPoints'` reported as a non-throw, re-read — that means the schema regressed and you must restore `bonusPoints` to `data.required` at `asyncapi.yaml:1835`. The point of this task is to convert the implicit contract guarantee into an explicit, named regression test.

**Step 3 — (No production change needed.)** The contract and backend are already correct; this task only adds the guard. If Step 2 unexpectedly fails, the minimal fix is to ensure `asyncapi.yaml:1832-1836` has:

```yaml
            required:
              - teamId
              - group
              - bonusPoints
              - completedAt
```

**Step 4 — Run + expected PASS.**

```bash
npx jest tests/contract/websocket/score-events.test.js -t "REJECT legacy"
# PASS  tests/contract/websocket/score-events.test.js
#   ✓ should REJECT legacy `bonus` field — contract field is `bonusPoints` (CC-1)
```

**Step 5 — Commit.**

```bash
git add backend/tests/contract/websocket/score-events.test.js
git commit -m "test(contract): pin group:completed bonusPoints field name (CC-1)

Add a regression guard asserting a legacy {bonus} payload fails AsyncAPI
validation, locking bonusPoints as the contract field the GM Scanner must read.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task P4a.2: Fix GM Scanner `group:completed` handler to read `bonusPoints` (CC-1, scanner consumer)

`app.js:157` destructures `bonus` from `event.detail`, but `networkedSession.js:307-311` forwards the raw backend payload (which carries `bonusPoints`, per the contract pinned in P4a.1). So `bonus` is always `undefined` and the group-completion toast renders without the awarded amount — the GM never sees the bonus on a major Black Market scoring moment.

**Files:**
- Modify: `ALNScanner/src/app/app.js:156-160` (the `group:completed` listener inside `_wireNetworkedSessionEvents()`)
- Create (Test): `ALNScanner/tests/unit/app/app.groupCompleted.test.js`
- Reference (do not edit): `ALNScanner/src/network/networkedSession.js:307-312` (forwards raw `payload` as `event.detail` — payload has `bonusPoints`)

Current real code at `app.js:156-160`:

```javascript
    this.networkedSession.addEventListener('group:completed', (event) => {
      const { teamId, bonus } = event.detail || {};
      const formattedBonus = bonus ? ` +$${bonus.toLocaleString()}` : '';
      this.uiManager.showToast(`Group completed by ${teamId || 'team'}${formattedBonus}`);
    });
```

**Step 1 — Write the failing test.** Copy the App-construction harness from `tests/unit/app/error-propagation.test.js:6-52` (mock `debug`, `uiManager.showToast`, `settings`, `sessionModeManager`, `tokenManager`, `dataManager`, `standaloneDataManager`). Drive the real handler by setting `app.networkedSession` to a live `EventTarget` and calling `_wireNetworkedSessionEvents()`, then dispatch the backend-shaped event:

```javascript
/**
 * Unit Test: App group:completed toast (CC-1)
 * Verifies the toast surfaces bonusPoints (the AsyncAPI field), not the
 * legacy `bonus` name. networkedSession forwards the raw backend payload.
 */
import { App } from '../../../src/app/app.js';

describe('App - group:completed toast', () => {
  let app;
  let mockDependencies;

  beforeEach(() => {
    mockDependencies = {
      debug: { log: jest.fn() },
      uiManager: { showError: jest.fn(), showScreen: jest.fn(), showToast: jest.fn() },
      settings: { deviceId: 'TEST_001', stationName: 'Test', save: jest.fn() },
      sessionModeManager: {
        setMode: jest.fn(),
        isNetworked: jest.fn(() => true),
        isStandalone: jest.fn(() => false),
      },
      tokenManager: {},
      dataManager: { resetForNewSession: jest.fn() },
      standaloneDataManager: { sessionData: {}, scannedTokens: new Set() },
    };
    Storage.prototype.getItem = jest.fn();
    Storage.prototype.setItem = jest.fn();
    Storage.prototype.removeItem = jest.fn();

    app = new App(mockDependencies);
    // Drive the real listener wiring against a live EventTarget
    app.networkedSession = new EventTarget();
    app._wireNetworkedSessionEvents();
  });

  afterEach(() => jest.clearAllMocks());

  it('renders the bonusPoints amount in the toast', () => {
    app.networkedSession.dispatchEvent(new CustomEvent('group:completed', {
      detail: { teamId: 'Team Alpha', group: 'jaw_group', bonusPoints: 60000, completedAt: '2026-05-29T00:00:00.000Z' },
    }));

    expect(mockDependencies.uiManager.showToast).toHaveBeenCalledWith(
      'Group completed by Team Alpha +$60,000'
    );
  });

  it('omits the amount gracefully when bonusPoints is absent', () => {
    app.networkedSession.dispatchEvent(new CustomEvent('group:completed', {
      detail: { teamId: 'Team Beta' },
    }));

    expect(mockDependencies.uiManager.showToast).toHaveBeenCalledWith(
      'Group completed by Team Beta'
    );
  });
});
```

**Step 2 — Run it + expected FAIL.** From `ALNScanner/`:

```bash
npx jest tests/unit/app/app.groupCompleted.test.js
```

Expected FAIL on the first test:

```
● App - group:completed toast › renders the bonusPoints amount in the toast
  expect(jest.fn()).toHaveBeenCalledWith(...expected)
  Expected: "Group completed by Team Alpha +$60,000"
  Received: "Group completed by Team Alpha"
```

(`bonus` is undefined → `formattedBonus` is empty.)

**Step 3 — Minimal implementation.** Edit `app.js:156-160` to destructure `bonusPoints`:

```javascript
    this.networkedSession.addEventListener('group:completed', (event) => {
      const { teamId, bonusPoints } = event.detail || {};
      const formattedBonus = bonusPoints ? ` +$${bonusPoints.toLocaleString()}` : '';
      this.uiManager.showToast(`Group completed by ${teamId || 'team'}${formattedBonus}`);
    });
```

**Step 4 — Run + expected PASS.**

```bash
npx jest tests/unit/app/app.groupCompleted.test.js
# PASS  tests/unit/app/app.groupCompleted.test.js
#   ✓ renders the bonusPoints amount in the toast
#   ✓ omits the amount gracefully when bonusPoints is absent
```

**Step 5 — Commit.**

```bash
git add ALNScanner/src/app/app.js ALNScanner/tests/unit/app/app.groupCompleted.test.js
git commit -m "fix(scanner): read bonusPoints in group:completed toast (CC-1)

app.js destructured the legacy {bonus} field; the backend/contract emit
{bonusPoints}, so the awarded amount was always blank. Read bonusPoints to
restore the bonus in the group-completion toast. Add a unit test.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task P4a.3: Document the missing `sync:full` fields in the AsyncAPI `SyncFull` schema (CC-2, contract)

`buildSyncFullPayload()` (`syncHelpers.js:131-146`) returns `playerScans, environment, gameClock, cueEngine, music, sound, displayStatus` in addition to the documented fields — but the `SyncFull.data` schema (`asyncapi.yaml:278-620`) only documents `session, scores, recentTransactions, videoStatus, devices, serviceHealth, heldItems`. The most reliability-critical event (reconnect resync) is materially under-specified, so contract tooling can't catch drift on those fields. This task adds property schemas for the 7 missing fields and makes the backend test in P4a.4 assert they are required.

**Files:**
- Modify: `backend/contracts/asyncapi.yaml:280-286` (add the 7 field names to `SyncFull.data.required`) and append their property schemas after the `heldItems` property (which ends at `asyncapi.yaml:620`, before `timestamp:` at `:621`)
- Reference (do not edit): `backend/src/websocket/syncHelpers.js:131-146` (the authoritative return shape), `:156-255` (sub-builders showing each field's shape)

Current `SyncFull.data.required` at `asyncapi.yaml:280-286`:

```yaml
            required:
              - session
              - scores
              - recentTransactions
              - videoStatus
              - devices
              - serviceHealth
```

**Step 1 — Write the failing test.** (The test is authored in P4a.4 — it asserts a payload missing these fields is rejected. Author it now so this task has a RED.) From `backend/`:

```bash
npx jest tests/unit/websocket/syncHelpers.test.js -t "documents all reconnect-restore fields"
```

Before editing the contract, expect FAIL (the new fields are not in `required`, so a payload omitting them validates and the `.toThrow` assertion fails):

```
● buildSyncFullPayload contract conformance › SyncFull schema documents all reconnect-restore fields
  Expected substring: "required"
  Received function did not throw
```

**Step 2 — Add the 7 fields to `required`.** Edit `asyncapi.yaml:280-286`:

```yaml
            required:
              - session
              - scores
              - recentTransactions
              - videoStatus
              - devices
              - serviceHealth
              - heldItems
              - playerScans
              - environment
              - gameClock
              - cueEngine
              - music
              - sound
              - displayStatus
```

**Step 3 — Add the property schemas.** Insert the following AFTER the `heldItems` property block (after `asyncapi.yaml:620` `example: []`, and BEFORE `timestamp:` at `:621`). Match the shapes from the sub-builders in `syncHelpers.js` (`buildGameClockState` `:156`, `buildCueEngineState` `:181`, `buildMusicState` `:206`) and `buildEnvironmentState`/`getState` for the rest:

```yaml
              playerScans:
                type: array
                description: Persisted player-scanner scans (session.playerScans)
                items:
                  type: object
              environment:
                type: object
                description: Bluetooth/audio/lighting environment snapshot (buildEnvironmentState)
                properties:
                  bluetooth: { type: object }
                  audio: { type: object }
                  lighting: { type: object }
              gameClock:
                type: object
                description: Game clock state (buildGameClockState)
                required: [status, elapsed, expectedDuration]
                properties:
                  status: { type: string }
                  elapsed: { type: number }
                  expectedDuration: { type: number }
              cueEngine:
                type: object
                description: Cue engine state (buildCueEngineState)
                required: [loaded, cues, activeCues, disabledCues]
                properties:
                  loaded: { type: boolean }
                  cues: { type: array }
                  activeCues: { type: array }
                  disabledCues: { type: array }
              music:
                type: object
                description: MPD music state with playlists (buildMusicState)
                required: [connected, state, volume, playlists]
                properties:
                  connected: { type: boolean }
                  state: { type: string }
                  volume: { type: integer }
                  track: { type: [object, 'null'] }
                  playlist: { type: [string, 'null'] }
                  pausedByGameClock: { type: boolean }
                  playlists: { type: array }
              sound:
                type: object
                description: Active pw-play sound playback (soundService.getState)
                required: [playing]
                properties:
                  playing: { type: array }
              displayStatus:
                type: object
                description: HDMI display mode (displayControlService.getStatus, timestamp stripped)
                properties:
                  currentMode: { type: string }
                  previousMode: { type: string }
                  pendingVideo: { type: [string, 'null'] }
```

**Step 4 — Run + expected PASS** (after P4a.4's test exists; run together):

```bash
npx jest tests/unit/websocket/syncHelpers.test.js -t "documents all reconnect-restore fields"
# PASS
```

**Step 5 — Commit** (combined with P4a.4 since the test and contract are interdependent — see P4a.4 commit).

---

### Task P4a.4: Backend test asserting `buildSyncFullPayload()` validates against the completed `SyncFull` schema (CC-2)

Now prove `buildSyncFullPayload()`'s real output conforms to the schema completed in P4a.3, AND that a payload missing the newly-required fields is rejected (the fail-first lever). This uses the existing `validateWebSocketEvent` helper and the minimal-services factory already in `syncHelpers.test.js`.

**Files:**
- Modify (Test): `backend/tests/unit/websocket/syncHelpers.test.js` (append a new `describe` block at end of file)
- Reference (do not edit): `backend/tests/helpers/contract-validator.js:95-108` (`validateWebSocketEvent`), `syncHelpers.test.js:11-35` (the `makeMinimalServices` factory pattern to copy)

**Step 1 — Write the test.** Append to `syncHelpers.test.js`. The minimal services factory returns only a subset; `buildSyncFullPayload` fills the rest with graceful defaults (gameClock/cueEngine/music/sound/displayStatus all default when their service is absent), so the real output already contains every field. Wrap it in the envelope before validating:

```javascript
const { validateWebSocketEvent } = require('../../helpers/contract-validator');

describe('buildSyncFullPayload contract conformance (CC-2)', () => {
  function makeServices() {
    const session = {
      id: 'sess-1', transactions: [], connectedDevices: [], playerScans: [],
      toJSON: () => ({
        id: 'sess-1', name: 'Test', startTime: new Date().toISOString(),
        status: 'active', teams: [], metadata: {},
      }),
    };
    return {
      sessionService: { getCurrentSession: () => session },
      transactionService: { getTeamScores: () => [], getToken: () => null },
      videoQueueService: {
        getState: () => ({
          status: 'idle', currentVideo: null, queue: [], queueLength: 0, connected: false,
        }),
      },
    };
  }

  it('produces an envelope that validates against the SyncFull schema', async () => {
    const data = await buildSyncFullPayload(makeServices());
    const event = { event: 'sync:full', data, timestamp: new Date().toISOString() };
    expect(() => validateWebSocketEvent(event, 'sync:full')).not.toThrow();
  });

  it('SyncFull schema documents all reconnect-restore fields', async () => {
    // Fail-first lever: a payload missing the newly-required fields must be
    // REJECTED, proving the schema now documents (and requires) them.
    const data = await buildSyncFullPayload(makeServices());
    for (const field of ['playerScans', 'environment', 'gameClock', 'cueEngine', 'music', 'sound', 'displayStatus']) {
      delete data[field];
    }
    const event = { event: 'sync:full', data, timestamp: new Date().toISOString() };
    expect(() => validateWebSocketEvent(event, 'sync:full')).toThrow(/required/i);
  });
});
```

**Step 2 — Run it + expected FAIL (before P4a.3 contract edit).** From `backend/`:

```bash
npx jest tests/unit/websocket/syncHelpers.test.js -t "reconnect-restore"
```

Expected: the `documents all reconnect-restore fields` test FAILS (`Received function did not throw`) because the fields aren't required yet. The `validates against the SyncFull schema` test may already pass (the schema is permissive). Apply P4a.3 now.

**Step 3 — (Implementation is P4a.3.)** With P4a.3's contract edit applied, the deleted fields trigger `required` errors.

**Step 4 — Run + expected PASS.**

```bash
npx jest tests/unit/websocket/syncHelpers.test.js -t "CC-2"
# PASS  tests/unit/websocket/syncHelpers.test.js
#   ✓ produces an envelope that validates against the SyncFull schema
#   ✓ SyncFull schema documents all reconnect-restore fields
```

Also run the broader sync/state suites to confirm no other payload-shape test broke (these add `required` fields that real callers always include, so they should pass):

```bash
npx jest tests/unit/websocket/syncHelpers.test.js tests/contract/http/state.test.js
```

**Step 5 — Commit (P4a.3 + P4a.4 together).**

```bash
git add backend/contracts/asyncapi.yaml backend/tests/unit/websocket/syncHelpers.test.js
git commit -m "feat(contract): document all sync:full reconnect-restore fields (CC-2)

SyncFull documented only 7 of the ~14 fields buildSyncFullPayload emits.
Add schemas + required entries for playerScans, environment, gameClock,
cueEngine, music, sound, displayStatus, and a backend test asserting the
real payload validates and that omitting the fields is rejected.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task P4a.5: Add a `SyncRequest` message to the AsyncAPI publish contract (CC-3)

`MonitoringDisplay._requestInitialState()` (`MonitoringDisplay.js:151`) emits a raw `sync:request` (no envelope) and `server.js:75` handles it, but the publish channel `oneOf` (`asyncapi.yaml:105-108`) lists only `TransactionSubmit` and `GmCommand`. A future strict-validation middleware would silently break admin refresh. We add the message to the contract. **Decision (see Section summary):** `sync:request` carries NO payload today (`socket.emit('sync:request')` with no args; `server.js` handler takes no data), so the contract documents it as the bare event name WITHOUT the `{event,data,timestamp}` envelope — matching reality. Aligning the client to the envelope is out of scope for this task (it would require a server-side handler change and risks breaking the live admin refresh path); we document what is actually on the wire and note the divergence.

**Files:**
- Modify: `backend/contracts/asyncapi.yaml:105-108` (add `SyncRequest` to publish `oneOf`) and add a `SyncRequest` message under `components/messages` (insert near the other client→server messages, e.g. after `TransactionSubmit` ends — find it after the `GmCommand` message)
- Modify (Test): `backend/tests/contract/websocket/score-events.test.js` is the wrong home; instead add a tiny schema-presence test. Create `backend/tests/contract/websocket/sync-request.test.js`
- Reference (do not edit): `ALNScanner/src/admin/MonitoringDisplay.js:149-154` (raw emit, no envelope), `backend/src/server.js:75-94` (handler takes no payload)

Current publish `oneOf` at `asyncapi.yaml:105-108`:

```yaml
      message:
        oneOf:
          - $ref: '#/components/messages/TransactionSubmit'
          - $ref: '#/components/messages/GmCommand'
```

**Step 1 — Write the failing test.** Create `backend/tests/contract/websocket/sync-request.test.js`:

```javascript
/**
 * sync:request — Contract presence test (CC-3)
 * Asserts the client→server sync:request event is declared in the AsyncAPI
 * publish channel, so strict-validation middleware won't drop admin refresh.
 */
const yaml = require('js-yaml');
const fs = require('fs');
const path = require('path');

const asyncapi = yaml.load(
  fs.readFileSync(path.join(__dirname, '../../../contracts/asyncapi.yaml'), 'utf8')
);

describe('sync:request — AsyncAPI publish contract (CC-3)', () => {
  it('declares a SyncRequest message in components.messages', () => {
    const messages = asyncapi.components.messages;
    const match = Object.values(messages).find(m => m.name === 'sync:request');
    expect(match).toBeDefined();
  });

  it('lists SyncRequest in the publish channel oneOf', () => {
    const refs = asyncapi.channels['/'].publish.message.oneOf.map(o => o.$ref);
    expect(refs).toContain('#/components/messages/SyncRequest');
  });
});
```

**Step 2 — Run it + expected FAIL.** From `backend/`:

```bash
npx jest tests/contract/websocket/sync-request.test.js
```

Expected FAIL (both assertions):

```
● sync:request — AsyncAPI publish contract (CC-3) › declares a SyncRequest message
  expect(received).toBeDefined()  Received: undefined
● ... › lists SyncRequest in the publish channel oneOf
  expect(array).toContain("#/components/messages/SyncRequest")
```

**Step 3 — Add the contract entries.** Edit the publish `oneOf` at `asyncapi.yaml:105-108`:

```yaml
      message:
        oneOf:
          - $ref: '#/components/messages/TransactionSubmit'
          - $ref: '#/components/messages/GmCommand'
          - $ref: '#/components/messages/SyncRequest'
```

Add the message under `components/messages` (place it after the `GmCommand` message definition):

```yaml
    SyncRequest:
      name: sync:request
      title: Request Full State Resync
      summary: Admin panel asks the orchestrator to re-send sync:full
      description: |
        Client→server request emitted by the GM Scanner admin panel
        (MonitoringDisplay) to pull the current full state on demand. The
        server responds by emitting a fresh `sync:full` to the requesting
        socket.

        **Envelope exception**: Unlike other client→server events, this event
        carries NO payload — it is emitted as the bare event name
        (`socket.emit('sync:request')`). The server handler (server.js) takes
        no data argument. Documented here as payload-less to match the wire.
      payload:
        type: 'null'
```

**Step 4 — Run + expected PASS.**

```bash
npx jest tests/contract/websocket/sync-request.test.js
# PASS  tests/contract/websocket/sync-request.test.js
#   ✓ declares a SyncRequest message in components.messages
#   ✓ lists SyncRequest in the publish channel oneOf
```

**Step 5 — Commit.**

```bash
git add backend/contracts/asyncapi.yaml backend/tests/contract/websocket/sync-request.test.js
git commit -m "feat(contract): declare client sync:request in AsyncAPI publish (CC-3)

MonitoringDisplay emits sync:request and the backend handles it, but the
publish oneOf omitted it — a future strict-validation middleware could drop
admin refresh. Document it as a payload-less message and add a presence test.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task P4a.6: VERIFY whether `GET /api/state` device entries include `connectionStatus` (CC-8b)

CC-8b is `needs-confirmation`. `connectionWizard.js:210-212` filters `devices.filter(d => d.type === 'gm' && d.connectionStatus === 'connected')` to compute existing station numbers, but the device map in `syncHelpers.js:91-97` emits `{deviceId, type, name, connectionTime, ipAddress}` — `connectionStatus` is NOT mapped. If absent, the filter matches nothing and auto-numbering always returns `GM_Station_1` (feeding the deviceId collisions in M-2). Confirm before fixing.

**Files:**
- Reference (read only): `backend/src/websocket/syncHelpers.js:91-97` (device `.map()`), `ALNScanner/src/ui/connectionWizard.js:210-212` (the filter)

**Step 1 — Inspect the code path (no server needed).** The HTTP `/api/state` route delegates to the exact same `buildSyncFullPayload()` (`stateRoutes.js:32-45`), so the device map at `syncHelpers.js:91-97` is authoritative for both. Read it:

```bash
sed -n '84,98p' backend/src/websocket/syncHelpers.js
```

Confirm the mapped object keys are exactly `deviceId, type, name, connectionTime, ipAddress` — no `connectionStatus`.

**Step 2 — Confirm against a running orchestrator (definitive).** If an orchestrator is reachable on the LAN with a connected GM, curl and inspect:

```bash
curl -sk https://localhost:3000/api/state | python3 -c "import sys,json; d=json.load(sys.stdin); print(json.dumps(d.get('devices', []), indent=2))"
```

Expected (BUG CONFIRMED): each device object has `deviceId/type/name/connectionTime/ipAddress` and NO `connectionStatus` key. If `connectionStatus` IS present, STOP — CC-8b is refuted and P4a.7/P4a.8 are skipped; instead, document the refutation and the section's `connectionWizard` filter is already correct.

**Step 3 — Record the outcome.** Note in the PR description: "CC-8b confirmed: `/api/state` devices omit `connectionStatus` (mapped at syncHelpers.js:91-97); the wizard filter at connectionWizard.js:211 matches nothing → station numbering always returns GM_Station_1." Proceed to P4a.7.

**(No code change, no commit in this task — verification only. P4a.7 carries the contract+backend fix.)**

---

### Task P4a.7: Add `connectionStatus` to the `/api/state` device map + OpenAPI schema + backend test (CC-8b fix, contract-first)

With CC-8b confirmed in P4a.6, add `connectionStatus` to the device map in `syncHelpers.js` (which feeds BOTH `/api/state` and `sync:full`) and to the OpenAPI `GameState.devices` item schema. This also unblocks correct station auto-numbering (helps RL-7 / M-2). Contract + backend test first, then the scanner consumer (P4a.8) just reads it.

**Files:**
- Modify: `backend/contracts/openapi.yaml:1668-1697` (`GameState.devices` item — add `connectionStatus` property)
- Modify: `backend/src/websocket/syncHelpers.js:91-97` (device `.map()` — add `connectionStatus`)
- Modify: `backend/contracts/asyncapi.yaml:528-552` (`SyncFull.data.devices` item — add `connectionStatus` so sync:full and /api/state stay aligned)
- Modify (Test): `backend/tests/contract/http/state.test.js` (append a test that creates a connected GM device and asserts `connectionStatus` is present and validates)
- Reference (do not edit): `backend/src/models/deviceConnection.js:23-24` (defaults `connectionStatus: 'connected'`)

Current device map at `syncHelpers.js:91-97`:

```javascript
    devices = deviceList.map(device => ({
      deviceId: device.id,
      type: device.type,
      name: device.name,
      connectionTime: device.connectionTime,
      ipAddress: device.ipAddress,
    }));
```

**Step 1 — Write the failing test.** Append to `state.test.js` (the suite already creates+starts a session in `beforeEach`; import `DeviceConnection` and add a connected GM device):

```javascript
const DeviceConnection = require('../../../src/models/deviceConnection');

describe('GET /api/state device connectionStatus (CC-8b)', () => {
  it('includes connectionStatus on device entries for station auto-numbering', async () => {
    await sessionService.updateDevice(new DeviceConnection({
      id: 'GM_Station_1', type: 'gm', name: 'GM Station',
    }));

    const response = await request(app.app).get('/api/state').expect(200);

    const gm = (response.body.devices || []).find(d => d.deviceId === 'GM_Station_1');
    expect(gm).toBeDefined();
    expect(gm.connectionStatus).toBe('connected');

    // Response still conforms to the (updated) OpenAPI GameState schema
    validateHTTPResponse(response, '/api/state', 'get', 200);
  });
});
```

(Place the `require('../../../src/models/deviceConnection')` at the top with the other requires.)

**Step 2 — Run it + expected FAIL.** From `backend/`:

```bash
npx jest tests/contract/http/state.test.js -t "connectionStatus"
```

Expected FAIL:

```
● GET /api/state device connectionStatus (CC-8b) › includes connectionStatus on device entries
  expect(received).toBe(expected)
  Expected: "connected"  Received: undefined
```

**Step 3 — Implement.** (a) Add `connectionStatus` to the device map in `syncHelpers.js:91-97`:

```javascript
    devices = deviceList.map(device => ({
      deviceId: device.id,
      type: device.type,
      name: device.name,
      connectionTime: device.connectionTime,
      connectionStatus: device.connectionStatus,
      ipAddress: device.ipAddress,
    }));
```

(b) Add the property to the OpenAPI `GameState.devices` item at `openapi.yaml:1694` (after `connectionTime`, before `ipAddress`):

```yaml
              connectionStatus:
                type: string
                enum: [connected, disconnected, reconnecting]
                description: Device connection status (used for station auto-numbering)
                example: "connected"
```

(c) Mirror it in the AsyncAPI `SyncFull.data.devices` item at `asyncapi.yaml:550` (after `connectionTime:`, before `ipAddress:`):

```yaml
                    connectionStatus:
                      type: string
                      enum: [connected, disconnected, reconnecting]
                      example: "connected"
```

**Step 4 — Run + expected PASS.**

```bash
npx jest tests/contract/http/state.test.js
# PASS  tests/contract/http/state.test.js
#   ✓ should match OpenAPI contract
#   ✓ includes connectionStatus on device entries for station auto-numbering
```

**Step 5 — Commit.**

```bash
git add backend/src/websocket/syncHelpers.js backend/contracts/openapi.yaml backend/contracts/asyncapi.yaml backend/tests/contract/http/state.test.js
git commit -m "fix(state): expose device connectionStatus in /api/state + sync:full (CC-8b)

The device map omitted connectionStatus, so the GM Scanner's station
auto-numbering filter matched nothing and always returned GM_Station_1
(contributing to deviceId collisions). Add connectionStatus to the
syncHelpers device map and to the OpenAPI/AsyncAPI device item schemas,
with a contract test asserting a connected GM exposes it.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task P4a.8: Confirm the GM Scanner station-numbering filter consumes `connectionStatus` (CC-8b, scanner consumer)

The scanner's `connectionWizard.js:210-212` already filters on `d.connectionStatus === 'connected'` — it was correct all along; the field was simply absent from the response (fixed in P4a.7). This task adds a regression test proving the wizard now derives `existingIds` correctly from a state payload that includes `connectionStatus`, so the consumer can't silently regress if the field name changes.

**Files:**
- Reference (likely no change): `ALNScanner/src/ui/connectionWizard.js:205-235` (`assignStationName`), `:185-204` (`_findNextStationId`)
- Create (Test): `ALNScanner/tests/unit/ui/connectionWizard.stationNumbering.test.js`

Current real filter at `connectionWizard.js:210-212`:

```javascript
      // Only count CONNECTED GM devices (disconnected entries are stale)
      const existingIds = devices
        .filter(d => d.type === 'gm' && d.connectionStatus === 'connected')
        .map(d => d.deviceId);
```

**Step 1 — Write the test.** First read `_findNextStationId` to learn its exact contract (what it returns given existing ids). Then test `assignStationName` end-to-end with a mocked `fetch` returning a `/api/state` body that now includes `connectionStatus`. From the test, stub `localStorage` so the saved-name early-return at `:209-214` does NOT short-circuit:

```javascript
/**
 * Unit Test: connectionWizard station auto-numbering (CC-8b)
 * With connectionStatus now present in /api/state, the wizard must skip the
 * already-connected GM_Station_1 and assign GM_Station_2.
 * @jest-environment jsdom
 */
import { jest } from '@jest/globals';

describe('connectionWizard - station auto-numbering (CC-8b)', () => {
  let ConnectionWizard;

  beforeEach(() => {
    jest.resetModules();
    document.body.innerHTML = '<div id="stationNameDisplay"></div>';
    // No saved station name → do not take the reuse early-return
    Storage.prototype.getItem = jest.fn(() => null);
    Storage.prototype.setItem = jest.fn();
  });

  afterEach(() => jest.clearAllMocks());

  it('assigns the next free station when a connected GM already exists', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        devices: [
          { deviceId: 'GM_Station_1', type: 'gm', connectionStatus: 'connected' },
          { deviceId: 'GM_Station_3', type: 'gm', connectionStatus: 'disconnected' },
        ],
      }),
    });

    // Adjust import/instantiation to the real module shape discovered in src.
    const mod = await import('../../../src/ui/connectionWizard.js');
    ConnectionWizard = mod.ConnectionWizard || mod.default;
    const wizard = typeof ConnectionWizard === 'function' ? new ConnectionWizard() : mod;

    await wizard.assignStationName('https://orч:3000'.replace('ч',''));

    const display = document.getElementById('stationNameDisplay');
    // GM_Station_1 is connected (counted), GM_Station_3 is disconnected (ignored)
    expect(display.textContent).toBe('GM_Station_2');
    expect(display.dataset.deviceId).toBe('GM_Station_2');
  });
});
```

**Step 2 — Run it.** From `ALNScanner/`:

```bash
npx jest tests/unit/ui/connectionWizard.stationNumbering.test.js
```

If `_findNextStationId` returns the lowest unused `GM_Station_N` skipping connected ids, this PASSES immediately (the consumer was already correct — P4a.7 supplied the data). If it FAILS on the import/instantiation shape, adjust the import line to match the real export in `connectionWizard.js` (read its `export` statement) — this is harness alignment, not a production bug. If it FAILS on the assertion (e.g. returns `GM_Station_1`), inspect `_findNextStationId` at `:185-204` and fix its skip logic minimally.

**Step 3 — Implementation (only if Step 2's assertion failed).** Most likely none needed. If `_findNextStationId` is off, the minimal fix is to ensure it returns the first `GM_Station_N` (N≥1) whose id is NOT in `existingIds`.

**Step 4 — Run + expected PASS.**

```bash
npx jest tests/unit/ui/connectionWizard.stationNumbering.test.js
# PASS
```

**Step 5 — Commit.**

```bash
git add ALNScanner/tests/unit/ui/connectionWizard.stationNumbering.test.js ALNScanner/src/ui/connectionWizard.js
git commit -m "test(scanner): station auto-numbering consumes connectionStatus (CC-8b)

With connectionStatus now present in /api/state (backend P4a.7), assert the
wizard skips already-connected GM stations when picking the next station id.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task P4a.9: Backend contract test pinning lighting `activeScene` as a string (SR-1, contract-first)

`lightingService.getState()` (`lightingService.js:349-356`) returns `activeScene: this._activeScene` — a **string** (the HA `entity_id`, e.g. `"scene.party"`) or `null`. The GM Scanner's `EnvironmentRenderer` reads `activeScene?.id` (`:104, :123`), comparing `scene.id === activeScene.id` — always false against a string, so the active-scene tile never highlights. Before fixing the renderer, pin the wire shape: the lighting `service:state` payload's `activeScene` is a string|null.

**Files:**
- Modify (Test): `backend/tests/contract/websocket/` — create `lighting-state.test.js`. (If a lighting `service:state` schema already lives in another contract test, extend it instead; grep first.)
- Reference (do not edit): `backend/src/services/lightingService.js:349-356` (`getState()` returns `activeScene` string|null)
- Reference: `backend/contracts/asyncapi.yaml` `ServiceState` message (domain `lighting`)

**Step 1 — Locate the lighting service:state schema.** From `backend/`:

```bash
grep -n "activeScene\|lighting" backend/contracts/asyncapi.yaml
grep -rln "lighting" backend/tests/contract/websocket/
```

If the `ServiceState` schema declares the `lighting` domain shape, confirm `activeScene` is typed `string`/`null`; if it's untyped (`type: object`), add a `lighting`-domain assertion via a new test rather than a schema change.

**Step 2 — Write the failing/guard test.** Create `backend/tests/contract/websocket/lighting-state.test.js`:

```javascript
/**
 * Lighting service:state — contract guard (SR-1)
 * activeScene is a string entity_id (or null), NOT an object. Pins the wire
 * shape the GM Scanner EnvironmentRenderer must consume.
 */
const lightingService = require('../../../src/services/lightingService');

describe('lighting getState() activeScene shape (SR-1)', () => {
  it('returns activeScene as a string or null (never an object)', () => {
    const state = lightingService.getState();
    expect(state).toHaveProperty('activeScene');
    const t = typeof state.activeScene;
    expect(['string', 'object']).toContain(t); // object only when null
    if (state.activeScene !== null) {
      expect(typeof state.activeScene).toBe('string');
    }
  });

  it('reflects a set string entity_id', () => {
    lightingService._activeScene = 'scene.party';
    try {
      expect(lightingService.getState().activeScene).toBe('scene.party');
    } finally {
      lightingService._activeScene = null;
    }
  });
});
```

**Step 3 — Run it + expected result.** From `backend/`:

```bash
npx jest tests/contract/websocket/lighting-state.test.js
```

Expected PASS (the backend already returns a string). This test documents the contract the renderer fix (P4a.10) depends on. If it FAILS, the service shape changed — reconcile before touching the renderer.

**Step 4 — (No production change.)**

**Step 5 — Commit.**

```bash
git add backend/tests/contract/websocket/lighting-state.test.js
git commit -m "test(contract): pin lighting activeScene as string entity_id (SR-1)

Document that lightingService.getState().activeScene is a string|null so the
GM Scanner EnvironmentRenderer fix (P4a.10) has a verified contract to consume.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task P4a.10: Fix `EnvironmentRenderer` to treat `activeScene` as a string id + correct its test (SR-1, scanner consumer)

`EnvironmentRenderer` reads `activeScene?.id` in three spots (`:104` differential, `:113` build-grid `scene.id === activeScene.id`, `:123` cache init) — all wrong for a string. The unit test at `EnvironmentRenderer.test.js:76` feeds the broken object shape `activeScene: { id: 'tension' }`, masking the bug. Fix the renderer to compare against the string and fix the test to use the real string shape.

**Files:**
- Modify: `ALNScanner/src/ui/renderers/EnvironmentRenderer.js:104` (`newActiveId`), `:113` (`scene.id === activeScene.id`), `:123` (`this._activeSceneId = activeScene?.id`)
- Modify (Test): `ALNScanner/tests/unit/ui/renderers/EnvironmentRenderer.test.js:76-86` ("should mark active scene tile")

Current real code:

`EnvironmentRenderer.js:103-104`:
```javascript
    // Differential: only toggle active class
    const newActiveId = activeScene?.id || null;
```

`EnvironmentRenderer.js:113`:
```javascript
      const isActive = activeScene && (scene.id === activeScene.id);
```

`EnvironmentRenderer.js:123`:
```javascript
    this._activeSceneId = activeScene?.id || null;
```

`EnvironmentRenderer.test.js:74-86`:
```javascript
    it('should mark active scene tile', () => {
      renderer.renderLighting({
        connected: true,
        activeScene: { id: 'tension' },
        scenes,
      });

      const activeTile = document.querySelector('.scene-tile--active');
      expect(activeTile).toBeTruthy();
      expect(activeTile.dataset.sceneId).toBe('tension');
    });
```

**Step 1 — Write the failing test (fix the existing one to the real shape).** Replace the `activeScene: { id: 'tension' }` object with the real string `activeScene: 'tension'`:

```javascript
    it('should mark active scene tile', () => {
      renderer.renderLighting({
        connected: true,
        activeScene: 'tension',   // backend sends the entity_id string (SR-1)
        scenes,
      });

      const activeTile = document.querySelector('.scene-tile--active');
      expect(activeTile).toBeTruthy();
      expect(activeTile.dataset.sceneId).toBe('tension');
    });
```

**Step 2 — Run it + expected FAIL.** From `ALNScanner/`:

```bash
npx jest tests/unit/ui/renderers/EnvironmentRenderer.test.js -t "should mark active scene tile"
```

Expected FAIL (the renderer compared `scene.id === activeScene.id`; `'tension'.id` is undefined, so no tile gets `scene-tile--active`):

```
● EnvironmentRenderer › Lighting › should mark active scene tile
  expect(received).toBeTruthy()
  Received: null
```

**Step 3 — Implement.** Edit `EnvironmentRenderer.js` in three places:

`:104`:
```javascript
    const newActiveId = activeScene || null;
```

`:113`:
```javascript
      const isActive = activeScene && (scene.id === activeScene);
```

`:123`:
```javascript
    this._activeSceneId = activeScene || null;
```

**Step 4 — Run + expected PASS** (and the full EnvironmentRenderer suite — the `activeScene: null` cases at `:53` and `:96` still work since `null || null === null`):

```bash
npx jest tests/unit/ui/renderers/EnvironmentRenderer.test.js
# PASS  tests/unit/ui/renderers/EnvironmentRenderer.test.js
#   Lighting
#     ✓ should mark active scene tile
#     ✓ should render scene tiles when connected
#     ... (all green)
```

**Step 5 — Commit.**

```bash
git add ALNScanner/src/ui/renderers/EnvironmentRenderer.js ALNScanner/tests/unit/ui/renderers/EnvironmentRenderer.test.js
git commit -m "fix(scanner): treat lighting activeScene as a string id (SR-1)

EnvironmentRenderer compared scene.id against activeScene.id, but the backend
sends activeScene as the HA entity_id string — so the active tile never
highlighted. Compare against the string and fix the test that fed the wrong
object shape.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

## Phase 4b — NFC robustness  *(P4b.1 is a Phase-1 prerequisite — see Phase 1)*
### Task P4b.1: Add AbortController to NFCHandler.startScan and make stopScan actually abort (NFC-1)

The comment "Web NFC doesn't have explicit stop" in `nfcHandler.js:160` is factually wrong. `NDEFReader.scan()` accepts `{ signal }` from an `AbortController`, and aborting it stops the radio scan and tears down the `'reading'` listener. Today `stopScan()` (line 162-164) only flips `this.isScanning = false`; the reader and its listeners keep running across screen changes — leaking radio/listeners and risking a stray off-screen tap queuing a `transaction:submit`. This task gives `NFCHandler` a real abort path. It is the dependency that Phase P1b's NFC-3 (visibilitychange/pagehide teardown) builds on — note for the assembler: **P1b NFC-3 requires this task to land first.**

This is a pure client-side change: `extractTokenId` produces a local `{id, source}` object that never crosses the wire, so no `backend/contracts` change is required.

**Files:**
- Modify: `ALNScanner/src/utils/nfcHandler.js:10-15` (constructor — add `this.abortController`)
- Modify: `ALNScanner/src/utils/nfcHandler.js:30-79` (startScan — create controller, pass `{ signal }` to `reader.scan`)
- Modify: `ALNScanner/src/utils/nfcHandler.js:158-164` (stopScan — abort + null out reader/controller)
- Test: `ALNScanner/tests/unit/utils/nfcHandler.test.js` (extend existing `describe('stopScan')` and add `describe('startScan AbortController')`)

**Step 1 — Write the failing test.** Append to `ALNScanner/tests/unit/utils/nfcHandler.test.js`, replacing the existing `describe('stopScan', ...)` block (lines 144-150) with this expanded version:

```javascript
  describe('startScan AbortController', () => {
    let scanSpy;

    beforeEach(() => {
      scanSpy = jest.fn().mockResolvedValue(undefined);
      // Minimal NDEFReader mock that records the options passed to scan()
      global.window.NDEFReader = class {
        constructor() { this.addEventListener = jest.fn(); }
        scan(opts) { return scanSpy(opts); }
      };
    });

    afterEach(() => {
      delete global.window.NDEFReader;
    });

    it('passes an AbortSignal to reader.scan()', async () => {
      const handler = new NFCHandlerClass();
      await handler.startScan(() => {}, () => {});

      expect(scanSpy).toHaveBeenCalledTimes(1);
      const opts = scanSpy.mock.calls[0][0];
      expect(opts).toBeDefined();
      expect(opts.signal).toBeInstanceOf(AbortSignal);
      expect(opts.signal.aborted).toBe(false);
    });
  });

  describe('stopScan', () => {
    beforeEach(() => {
      global.window.NDEFReader = class {
        constructor() { this.addEventListener = jest.fn(); }
        scan() { return Promise.resolve(); }
      };
    });

    afterEach(() => {
      delete global.window.NDEFReader;
    });

    it('should set isScanning to false', () => {
      NFCHandler.isScanning = true;
      NFCHandler.stopScan();
      expect(NFCHandler.isScanning).toBe(false);
    });

    it('aborts the active scan and clears reader/controller', async () => {
      const handler = new NFCHandlerClass();
      await handler.startScan(() => {}, () => {});
      const signal = handler.abortController.signal;

      handler.stopScan();

      expect(signal.aborted).toBe(true);
      expect(handler.reader).toBe(null);
      expect(handler.abortController).toBe(null);
      expect(handler.isScanning).toBe(false);
    });
  });
```

**Step 2 — Run it, expect FAIL.** From `/home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/ALNScanner`:

```bash
npx jest tests/unit/utils/nfcHandler.test.js -t "AbortController"
npx jest tests/unit/utils/nfcHandler.test.js -t "aborts the active scan"
```

Expected FAIL — `startScan` calls `reader.scan()` with no argument, so `scanSpy.mock.calls[0][0]` is `undefined`:
```
expect(opts).toBeDefined()
Received: undefined
```
and `handler.abortController` is `undefined` (never created), so `signal.aborted` throws `TypeError: Cannot read properties of undefined (reading 'signal')`.

**Step 3 — Minimal implementation.** In `ALNScanner/src/utils/nfcHandler.js`, add the field to the constructor (after line 13):

```javascript
  constructor() {
    this.reader = null;
    this.abortController = null;
    this.isScanning = false;
    this.lastRead = null;       // { id: string, timestamp: number }
    this.debounceMs = 2000;     // Ignore same tag within 2 seconds
  }
```

Replace the `try { this.reader = new NDEFReader(); ... await this.reader.scan(); this.isScanning = true;` region (lines 35-73) — keep the listener attachment untouched, only change the reader/scan lines:

```javascript
    try {
      this.reader = new NDEFReader();
      this.abortController = new AbortController();

      // CRITICAL: Attach event listeners BEFORE calling scan()
      // ... existing reading/readingerror listeners unchanged ...

      // NOW start scanning - listeners are ready to catch events.
      // Pass the abort signal so stopScan() can truly stop the radio.
      await this.reader.scan({ signal: this.abortController.signal });
      this.isScanning = true;
```

Replace `stopScan()` (lines 158-164):

```javascript
  /**
   * Stop NFC scanning by aborting the active scan.
   * Web NFC DOES support stopping via AbortController (NDEFReader.scan({signal})).
   */
  stopScan() {
    if (this.abortController) {
      this.abortController.abort();
    }
    this.abortController = null;
    this.reader = null;
    this.isScanning = false;
  }
```

**Step 4 — Run it, expect PASS.**

```bash
npx jest tests/unit/utils/nfcHandler.test.js
```

Expected PASS — all `nfcHandler.test.js` suites green, including the new AbortController + stopScan-abort cases.

**Step 5 — Commit.**

```bash
git add ALNScanner/src/utils/nfcHandler.js ALNScanner/tests/unit/utils/nfcHandler.test.js
git commit -m "fix(nfc): abort NDEFReader scan in stopScan via AbortController

NFC-1: Web NFC supports stopping via NDEFReader.scan({signal}); stopScan()
was a no-op (flipped a boolean only), leaking the reader and its 'reading'
listener across screen changes. Now creates an AbortController in startScan
and aborts+nulls it in stopScan. Prerequisite for visibilitychange teardown.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task P4b.2: Make startScan idempotent — abort any prior scan before re-arming (NFC-2)

`_startNFCScanning()` (app.js:595) runs on every team confirmation (`confirmTeamId` at app.js:380 `await this._startNFCScanning()`). Each call into `NFCHandler.startScan` does `new NDEFReader()` and attaches fresh `'reading'`/`'readingerror'` listeners with no teardown of the prior reader. Over a 2-3 hour show with many team switches, leaked readers/closures accumulate; at worst a single physical tap is processed by more than one live listener — **double-queuing a transaction**. With P4b.1's AbortController in place, the fix is one guard at the top of `startScan`: abort the previous scan before arming a new one.

**Files:**
- Modify: `ALNScanner/src/utils/nfcHandler.js:30-37` (startScan — guard with `stopScan()` before re-arming)
- Test: `ALNScanner/tests/unit/utils/nfcHandler.test.js` (extend `describe('startScan AbortController')`)

**Step 1 — Write the failing test.** Add inside the `describe('startScan AbortController', ...)` block created in P4b.1:

```javascript
    it('aborts a prior scan before re-arming (idempotent re-entry)', async () => {
      const handler = new NFCHandlerClass();

      await handler.startScan(() => {}, () => {});
      const firstSignal = handler.abortController.signal;
      expect(firstSignal.aborted).toBe(false);

      // Re-enter (simulates a second team confirmation) WITHOUT stopScan
      await handler.startScan(() => {}, () => {});

      // The first scan's signal must have been aborted by the re-arm
      expect(firstSignal.aborted).toBe(true);
      // A fresh controller is now in place and not aborted
      expect(handler.abortController.signal).not.toBe(firstSignal);
      expect(handler.abortController.signal.aborted).toBe(false);
    });
```

**Step 2 — Run it, expect FAIL.** From `ALNScanner`:

```bash
npx jest tests/unit/utils/nfcHandler.test.js -t "idempotent re-entry"
```

Expected FAIL — the second `startScan` overwrites `this.abortController` without aborting the first, so the first signal is never aborted:
```
expect(firstSignal.aborted).toBe(true)
Received: false
```

**Step 3 — Minimal implementation.** In `ALNScanner/src/utils/nfcHandler.js`, at the top of the `try` in `startScan` (immediately before `this.reader = new NDEFReader();`, line 36), abort any in-flight scan:

```javascript
    try {
      // Idempotent re-arm: tear down any prior scan before starting a new one
      // (called on every team confirmation — prevents leaked readers/listeners
      //  and a single tap being processed by more than one live listener).
      if (this.abortController) {
        this.stopScan();
      }

      this.reader = new NDEFReader();
      this.abortController = new AbortController();
```

**Step 4 — Run it, expect PASS.**

```bash
npx jest tests/unit/utils/nfcHandler.test.js
```

Expected PASS — full file green, including `idempotent re-entry`.

**Step 5 — Commit.**

```bash
git add ALNScanner/src/utils/nfcHandler.js ALNScanner/tests/unit/utils/nfcHandler.test.js
git commit -m "fix(nfc): make startScan idempotent — abort prior scan before re-arming

NFC-2: _startNFCScanning() runs on every team confirmation, each creating a
new NDEFReader + listeners with no teardown of the previous one. Leaked
readers accumulate over a 2-3h show and a single tap could be processed by
multiple live listeners, double-queuing a transaction. startScan now aborts
any in-flight scan before arming a new one.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task P4b.3: Guard processNFCRead against non-string / null result.id (NFC-4)

`processNFCRead` (app.js:639) only guards `source === 'error'` (line 641). For any other source it immediately does `result.id.length` (line 648) and `result.id.trim()` (line 658) with no string/non-null check. Today's NFC path is safe, but `manualEntry`/`simulateScan`/future record types could deliver `id: null` or a non-string, throwing a `TypeError` inside the async `'reading'` handler — which `nfcHandler` does **not** await, becoming an unhandled rejection with **no user feedback**. Add a `typeof result.id === 'string' && result.id.trim() !== ''` guard right after the error-source check.

**Files:**
- Modify: `ALNScanner/src/app/app.js:645-648` (insert id-validity guard after the error-source block)
- Test: `ALNScanner/tests/unit/app/app-nfc-errors.test.js` (add cases under `describe('processNFCRead error handling')`)

**Step 1 — Write the failing test.** Add inside `describe('processNFCRead error handling', ...)` in `ALNScanner/tests/unit/app/app-nfc-errors.test.js`:

```javascript
    it('does not throw when a non-error result has null id', async () => {
      const badResult = { id: null, source: 'manual', raw: null };

      await expect(app.processNFCRead(badResult)).resolves.not.toThrow();

      // Should surface a user-facing error and NOT proceed to token lookup
      expect(mockDependencies.uiManager.showError).toHaveBeenCalledWith(
        'Could not read token - please re-tap'
      );
      expect(mockDependencies.tokenManager.findToken).not.toHaveBeenCalled();
      expect(mockDependencies.dataManager.addTransaction).not.toHaveBeenCalled();
    });

    it('does not throw when a non-error result has an empty/whitespace id', async () => {
      const blankResult = { id: '   ', source: 'manual', raw: '   ' };

      await expect(app.processNFCRead(blankResult)).resolves.not.toThrow();

      expect(mockDependencies.uiManager.showError).toHaveBeenCalledWith(
        'Could not read token - please re-tap'
      );
      expect(mockDependencies.tokenManager.findToken).not.toHaveBeenCalled();
    });
```

**Step 2 — Run it, expect FAIL.** From `ALNScanner`:

```bash
npx jest tests/unit/app/app-nfc-errors.test.js -t "non-error result has null id"
```

Expected FAIL — `result.source` is `'manual'` (not `'error'`), so execution reaches `this.debug.log(...result.id.length...)` at app.js:648 and throws:
```
TypeError: Cannot read properties of null (reading 'length')
```
The `resolves.not.toThrow()` assertion fails with the rejected promise.

**Step 3 — Minimal implementation.** In `ALNScanner/src/app/app.js`, immediately after the error-source block (after line 645, before the `this.debug.log(\`Processing token...\`)` at line 647) insert:

```javascript
    // Defensive: any non-error source must still carry a usable string id.
    // manualEntry/simulateScan/future record types could deliver id: null,
    // which would throw a TypeError in this async (un-awaited) handler.
    if (typeof result.id !== 'string' || result.id.trim() === '') {
      this.debug.log(`NFC read returned no usable id (source=${result.source})`, true);
      this.uiManager.showError('Could not read token - please re-tap');
      return;
    }
```

**Step 4 — Run it, expect PASS.**

```bash
npx jest tests/unit/app/app-nfc-errors.test.js
```

Expected PASS — both new cases plus all existing `app-nfc-errors` tests green (the existing `text-record`/`url-record`/`generic-decode` happy-path tests still pass because they carry string ids).

**Step 5 — Commit.**

```bash
git add ALNScanner/src/app/app.js ALNScanner/tests/unit/app/app-nfc-errors.test.js
git commit -m "fix(nfc): guard processNFCRead against null/non-string result.id

NFC-4: Only source==='error' was guarded; a non-error result with id:null
(manualEntry/simulateScan/future record types) hit result.id.length and
threw a TypeError inside the un-awaited 'reading' handler — an unhandled
rejection with no operator feedback. Now validates id is a non-empty string
and surfaces a re-tap error.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task P4b.4: Drop the URL-record branch (or extract token segment) so junk URLs never queue an Unknown transaction (NFC-5)

`extractTokenId` (nfcHandler.js:119-128) returns the **whole URL** as `id` for a `url` record. `findToken` normalization (tokenManager.js:218-219) only strips `:`/`-` and lowercases, so a URL like `https://example.com/token456` never matches a token key — and `processNFCRead` then queues a junk **Unknown** `transaction:submit` to the backend (app.js:675-676 `recordTransaction(null, cleanId, true)`). The existing unit test at `nfcHandler.test.js:72-85` **codifies** the broken full-URL behavior. Production ALN tags are written as **text** records (see the text-record branch + the simulateScan ids which are bare token strings); URL records are not part of the token-encoding scheme. This task drops the url-record branch so URL tags fall through to generic-decode or the `unreadable-records` error path, and fixes the test that cemented the bad behavior.

This stays inside the client (the result object is local), so no `backend/contracts` change is needed.

**Decision to confirm before implementing:** verify with the token-authoring process that production tags are text-encoded (not URL). The review states "if never used, drop the url-record branch." If URL records ARE used, replace the branch body with token-segment extraction (`url.split('/').pop()`) instead of deleting — but the default per the finding and the bare-id token scheme is to **drop** it.

**Files:**
- Modify: `ALNScanner/src/utils/nfcHandler.js:119-128` (remove the `url` recordType branch)
- Test: `ALNScanner/tests/unit/utils/nfcHandler.test.js:72-85` (replace the "should extract URL record" test that codifies full-URL behavior)

**Step 1 — Write the failing test.** Replace the existing `it('should extract URL record', ...)` (lines 72-85) in `ALNScanner/tests/unit/utils/nfcHandler.test.js` with:

```javascript
    it('does NOT return a raw URL as the token id (url records are not token-encoded)', () => {
      // A URL-record tag would queue a junk "Unknown" transaction if returned raw.
      // Production tags are text-encoded; url records must not yield a full-URL id.
      const urlData = new TextEncoder().encode('https://example.com/token456');
      const message = {
        records: [{
          recordType: 'url',
          data: urlData
        }]
      };

      const result = NFCHandler.extractTokenId(message, 'serial123');

      // Must NOT be the raw URL via a 'url-record' source.
      expect(result.source).not.toBe('url-record');
      // Falls through to generic decode (the URL string is decodable text) —
      // the important invariant is the id is never claimed as an authoritative
      // url-record token.
      expect(result.id).not.toBe('https://example.com/token456');
    });
```

**Step 2 — Run it, expect FAIL.** From `ALNScanner`:

```bash
npx jest tests/unit/utils/nfcHandler.test.js -t "url records are not token-encoded"
```

Expected FAIL — the current `url` branch returns `{ id: 'https://example.com/token456', source: 'url-record' }`:
```
expect(result.source).not.toBe('url-record')
Expected: not "url-record"
Received: "url-record"
```

**Step 3 — Minimal implementation.** In `ALNScanner/src/utils/nfcHandler.js`, delete the entire `url` recordType branch (lines 119-128):

```javascript
      if (record.recordType === "url") {
        const decoder = new TextDecoder();
        const url = decoder.decode(record.data);
        Debug.log(`✅ URL record: ${url}`);
        return {
          id: url,
          source: 'url-record',
          raw: url
        };
      }
```

Removing it lets a `url` record fall through to the generic-decode block (lines 131-145), which decodes the URL string and returns `source: 'generic-decode'` — so the result is no longer authoritatively claimed as a token, and the new assertion (`source !== 'url-record'`) holds. (Note: with generic-decode, `result.id` becomes the decoded URL string but flagged as a best-effort decode, not a `url-record` token — and NFC-4's guard plus `findToken` returning null routes it to the Unknown-token path the operator can see, rather than a contract-blessed url id. If the assembler later wants URL tags to hard-fail instead, change the test to expect `source === 'error'` and add an explicit reject for `recordType === 'url'`.)

**Step 4 — Run it, expect PASS.**

```bash
npx jest tests/unit/utils/nfcHandler.test.js
```

Expected PASS — the rewritten URL test passes (now `source: 'generic-decode'`, not `'url-record'`) and all other `extractTokenId` cases (text-record, no-records error, unreadable-records error, generic-decode) remain green.

**Step 5 — Commit.**

```bash
git add ALNScanner/src/utils/nfcHandler.js ALNScanner/tests/unit/utils/nfcHandler.test.js
git commit -m "fix(nfc): drop url-record branch — raw URLs queued junk Unknown transactions

NFC-5: A url NDEF record returned the whole URL as the token id; findToken
normalization (strip :/- + lowercase) never matches a token key, so a junk
Unknown transaction:submit was queued to the backend. Production tags are
text-encoded — url records are not part of the token scheme. Removed the
branch (url tags fall through to generic-decode) and replaced the unit test
that codified the full-URL behavior.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task P4b.5: Escalate repeated readingerror to a durable Manual Entry affordance and log a meaningful field (NFC-6)

Two defects on the read-error path:
1. **Log loses detail.** `nfcHandler.js:67` does `Debug.log(\`NFC Read Error: ${event}\`, true)` — stringifying the raw `Event` to `[object Event]`. Web NFC `readingerror` events carry no `message`, but the event's `type` (and timing) is the only useful field; log that instead of the object.
2. **No durable fallback.** The app-side onError callback (app.js:610-615) only sets `scanStatus` to "Read error. Tap token again." On *repeated* errors the GM gets no escalation to Manual Entry (a `Manual Entry (Debug)` button already exists at `index.html:183` wired to `app.manualEntry`). After N consecutive read errors, escalate the `scanStatus` message to point the GM at Manual Entry so a bad tag/reader doesn't dead-end the show.

Pure client change; no contract impact.

**Files:**
- Modify: `ALNScanner/src/utils/nfcHandler.js:66-69` (log `event.type` not the raw event)
- Modify: `ALNScanner/src/app/app.js:56` area (add `this.nfcReadErrorCount = 0;` field) and `app.js:608-616` (escalate after a threshold; reset on success)
- Modify: `ALNScanner/src/app/app.js:639` (reset `nfcReadErrorCount` at the top of a successful `processNFCRead`)
- Test: `ALNScanner/tests/unit/app/app-nfc-errors.test.js` (add `describe('readingerror escalation')`)

**Step 1 — Write the failing test.** The onError callback is created inside `_startNFCScanning`; to test its escalation behavior deterministically, drive it via the callback passed to `nfcHandler.startScan`. Add to `ALNScanner/tests/unit/app/app-nfc-errors.test.js`:

```javascript
  describe('readingerror escalation', () => {
    let onErrorCb;

    beforeEach(async () => {
      app.nfcSupported = true;
      // Capture the onError callback App passes into nfcHandler.startScan
      mockDependencies.nfcHandler.startScan.mockImplementation((onRead, onError) => {
        onErrorCb = onError;
        return Promise.resolve();
      });
      document.getElementById('scanStatus').textContent = '';
      await app._startNFCScanning();
    });

    it('shows the transient hint on the first read error', () => {
      onErrorCb({ type: 'readingerror' });
      expect(document.getElementById('scanStatus').textContent)
        .toMatch(/Tap token again/i);
    });

    it('escalates to Manual Entry after repeated read errors', () => {
      for (let i = 0; i < 3; i++) onErrorCb({ type: 'readingerror' });
      expect(document.getElementById('scanStatus').textContent)
        .toMatch(/Manual Entry/i);
    });

    it('resets the error counter after a successful read', async () => {
      mockDependencies.tokenManager.findToken.mockReturnValue(null);

      onErrorCb({ type: 'readingerror' });
      onErrorCb({ type: 'readingerror' });
      await app.processNFCRead({ id: 'token123', source: 'text-record', raw: 'token123' });
      // After success the counter is back to 0, so one more error is transient again
      onErrorCb({ type: 'readingerror' });

      expect(document.getElementById('scanStatus').textContent)
        .toMatch(/Tap token again/i);
      expect(document.getElementById('scanStatus').textContent)
        .not.toMatch(/Manual Entry/i);
    });
  });
```

**Step 2 — Run it, expect FAIL.** From `ALNScanner`:

```bash
npx jest tests/unit/app/app-nfc-errors.test.js -t "escalates to Manual Entry"
```

Expected FAIL — the current onError callback always sets `'Read error. Tap token again.'` regardless of count:
```
expect(received).toMatch(/Manual Entry/i)
Received string: "Read error. Tap token again."
```

**Step 3 — Minimal implementation.**

(a) In `ALNScanner/src/utils/nfcHandler.js`, fix the readingerror log (lines 66-69):

```javascript
      this.reader.addEventListener("readingerror", (event) => {
        // readingerror events carry no `message`; log the event type (the only
        // meaningful field) instead of stringifying the raw Event to [object Event].
        Debug.log(`NFC Read Error (event type: ${event?.type || 'unknown'})`, true);
        if (onError) onError(event);
      });
```

(b) In `ALNScanner/src/app/app.js`, add the counter field near `this.nfcSupported = false;` (line 56):

```javascript
    this.nfcSupported = false;
    this.nfcReadErrorCount = 0;
```

(c) Replace the onError callback in `_startNFCScanning` (lines 610-615):

```javascript
        (err) => {
          this.nfcReadErrorCount++;
          this.debug.log(`NFC read error #${this.nfcReadErrorCount} (type: ${err?.type || err?.message || 'unknown'})`, true);
          if (status) {
            status.textContent = this.nfcReadErrorCount >= 3
              ? 'Reader trouble — use the Manual Entry button below.'
              : 'Read error. Tap token again.';
          }
        }
```

(d) Reset the counter on a successful read — at the very top of `processNFCRead` (app.js:639, before the error-source check) is wrong (errors share the method); instead reset it right after the id-validity guard passes, just before the `findToken` lookup. Insert before line 661 (`// Look up token first...`):

```javascript
    // A usable read clears the consecutive read-error escalation.
    this.nfcReadErrorCount = 0;
```

**Step 4 — Run it, expect PASS.**

```bash
npx jest tests/unit/app/app-nfc-errors.test.js
npx jest tests/unit/utils/nfcHandler.test.js
```

Expected PASS — the three escalation cases plus all prior `app-nfc-errors` and `nfcHandler` tests green.

**Step 5 — Commit.**

```bash
git add ALNScanner/src/app/app.js ALNScanner/src/utils/nfcHandler.js ALNScanner/tests/unit/app/app-nfc-errors.test.js
git commit -m "fix(nfc): escalate repeated read errors to Manual Entry; log event type

NFC-6: readingerror handler logged the raw Event ([object Event], no detail)
and only ever showed 'Tap token again' with no escalation. Now logs the event
type and, after 3 consecutive read errors, points the GM at the existing
Manual Entry button so a bad tag/reader can't dead-end the show. Counter
resets on a successful read.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

## Phase 4c — Auth / HTTP / wizard hardening
### Task P4c.1: Clear password field + disable autocomplete after auth (AUTH-3)

**Context:** `handleConnectionSubmit()` in `connectionWizard.js` reads the shared admin secret from `#gmPassword` but never clears it; the value persists in the DOM/JS memory for the whole session (recoverable via devtools). Fix: clear the field in a `finally` block and set `autocomplete='off'` on the input.

**Files:**
- Modify: `ALNScanner/src/ui/connectionWizard.js:280-373` (`handleConnectionSubmit`)
- Test: `ALNScanner/tests/unit/ui/connectionWizard.test.js` (add to existing `describe('handleConnectionSubmit()')`)

Current code (verified, `connectionWizard.js:280-296` and `369-373`):
```javascript
  async handleConnectionSubmit(event) {
    event.preventDefault();

    const serverUrl = document.getElementById('serverUrl').value;
    const password = document.getElementById('gmPassword').value;
    const statusDiv = document.getElementById('connectionStatusMsg');
    ...
    } catch (error) {
      statusDiv.textContent = `❌ Connection failed: ${error.message}`;
      statusDiv.style.color = '#f44336';
    }
  }
```

**Step 1 — Write the failing test.** Append inside the existing `describe('handleConnectionSubmit()', ...)` block (the harness already builds `#gmPassword`, mocks `fetch`, `Storage.prototype`, and `mockApp.selectGameMode`):

```javascript
    test('should clear the password field after a successful auth', async () => {
      const display = document.getElementById('stationNameDisplay');
      display.dataset.deviceId = 'GM_Station_1';
      document.getElementById('serverUrl').value = 'http://localhost:3000';
      document.getElementById('gmPassword').value = 'super-secret';

      mockFetch
        .mockResolvedValueOnce({ ok: true }) // health
        .mockResolvedValueOnce({ ok: true, json: async () => ({ token: 'jwt' }) }); // auth

      const event = new Event('submit');
      event.preventDefault = jest.fn();
      await wizard.handleConnectionSubmit(event);

      expect(document.getElementById('gmPassword').value).toBe('');
    });

    test('should clear the password field even when auth fails', async () => {
      const display = document.getElementById('stationNameDisplay');
      display.dataset.deviceId = 'GM_Station_1';
      document.getElementById('serverUrl').value = 'http://localhost:3000';
      document.getElementById('gmPassword').value = 'super-secret';

      mockFetch
        .mockResolvedValueOnce({ ok: true }) // health
        .mockResolvedValueOnce({ ok: false }); // auth rejected

      const event = new Event('submit');
      event.preventDefault = jest.fn();
      await wizard.handleConnectionSubmit(event);

      expect(document.getElementById('gmPassword').value).toBe('');
    });
```

**Step 2 — Run it (expect FAIL).**
```bash
cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/ALNScanner
npx jest tests/unit/ui/connectionWizard.test.js -t "clear the password field"
```
Expected: both new tests FAIL with `Expected: "" / Received: "super-secret"`.

**Step 3 — Minimal implementation.** Wrap the existing `try/catch` so the field is always cleared. Change the tail of `handleConnectionSubmit` (`connectionWizard.js:369-373`):

```javascript
    } catch (error) {
      statusDiv.textContent = `❌ Connection failed: ${error.message}`;
      statusDiv.style.color = '#f44336';
    } finally {
      // AUTH-3: never retain the shared admin secret in the DOM/JS memory
      const passwordInput = document.getElementById('gmPassword');
      if (passwordInput) {
        passwordInput.value = '';
        passwordInput.setAttribute('autocomplete', 'off');
      }
    }
  }
```

**Step 4 — Run it (expect PASS).**
```bash
cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/ALNScanner
npx jest tests/unit/ui/connectionWizard.test.js -t "clear the password field"
```
Expected: 2 passed.

**Step 5 — Commit.**
```bash
git add ALNScanner/src/ui/connectionWizard.js ALNScanner/tests/unit/ui/connectionWizard.test.js
git commit -m "fix(gm-scanner): clear admin password field after auth (AUTH-3)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task P4c.2: Guard auth-response JSON parse + validate token is a non-empty string (AUTH-4 / HTTP-2)

**Context:** `const { token } = await authResponse.json()` (`connectionWizard.js:333`) is unguarded. A 200-with-HTML body throws into the generic catch ("Connection failed" despite auth visually succeeding); a JSON body missing `token` stores the literal `undefined`/`'undefined'` string and silently fails later. Fix: isolate `.json()` in its own try/catch and validate `token` is a non-empty string BEFORE persisting.

**Files:**
- Modify: `ALNScanner/src/ui/connectionWizard.js:327-338`
- Test: `ALNScanner/tests/unit/ui/connectionWizard.test.js` (add to `describe('handleConnectionSubmit()')`)

Current code (verified, `connectionWizard.js:327-338`):
```javascript
      if (!authResponse.ok) {
        statusDiv.textContent = '❌ Invalid password';
        statusDiv.style.color = '#f44336';
        return;
      }

      const { token } = await authResponse.json();

      // 3. Save configuration to localStorage
      localStorage.setItem('aln_orchestrator_url', normalizedUrl);
      localStorage.setItem('aln_auth_token', token);
      localStorage.setItem('aln_station_name', deviceId);
```

**Step 1 — Write the failing test.** Append inside `describe('handleConnectionSubmit()', ...)`:

```javascript
    test('should surface a clear error when auth body is not JSON', async () => {
      const display = document.getElementById('stationNameDisplay');
      display.dataset.deviceId = 'GM_Station_1';
      document.getElementById('serverUrl').value = 'http://localhost:3000';
      document.getElementById('gmPassword').value = 'admin';

      mockFetch
        .mockResolvedValueOnce({ ok: true }) // health
        .mockResolvedValueOnce({ ok: true, json: async () => { throw new SyntaxError('Unexpected token <'); } });

      const event = new Event('submit');
      event.preventDefault = jest.fn();
      await wizard.handleConnectionSubmit(event);

      const statusDiv = document.getElementById('connectionStatusMsg');
      expect(statusDiv.textContent).toContain('Invalid auth response');
      expect(Storage.prototype.setItem).not.toHaveBeenCalledWith('aln_auth_token', expect.anything());
      expect(mockApp.selectGameMode).not.toHaveBeenCalled();
    });

    test('should reject an auth body missing the token field', async () => {
      const display = document.getElementById('stationNameDisplay');
      display.dataset.deviceId = 'GM_Station_1';
      document.getElementById('serverUrl').value = 'http://localhost:3000';
      document.getElementById('gmPassword').value = 'admin';

      mockFetch
        .mockResolvedValueOnce({ ok: true }) // health
        .mockResolvedValueOnce({ ok: true, json: async () => ({ expiresIn: 86400 }) }); // no token

      const event = new Event('submit');
      event.preventDefault = jest.fn();
      await wizard.handleConnectionSubmit(event);

      const statusDiv = document.getElementById('connectionStatusMsg');
      expect(statusDiv.textContent).toContain('Invalid auth response');
      expect(Storage.prototype.setItem).not.toHaveBeenCalledWith('aln_auth_token', expect.anything());
    });
```

**Step 2 — Run it (expect FAIL).**
```bash
cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/ALNScanner
npx jest tests/unit/ui/connectionWizard.test.js -t "Invalid auth response"
```
Expected FAIL: first test gets `❌ Connection failed: Unexpected token <` (not "Invalid auth response"); second test stores `undefined` and proceeds, so `selectGameMode`/`setItem('aln_auth_token', ...)` fire.

**Step 3 — Minimal implementation.** Replace `connectionWizard.js:333` (`const { token } = await authResponse.json();`) with an isolated parse + validation:

```javascript
      // AUTH-4/HTTP-2: guard against non-JSON (200-but-HTML SPA shell) and
      // a JSON body missing the token before persisting anything.
      let authBody;
      try {
        authBody = await authResponse.json();
      } catch {
        statusDiv.textContent = '❌ Invalid auth response (not JSON)';
        statusDiv.style.color = '#f44336';
        return;
      }

      const token = authBody && authBody.token;
      if (typeof token !== 'string' || token.length === 0) {
        statusDiv.textContent = '❌ Invalid auth response (missing token)';
        statusDiv.style.color = '#f44336';
        return;
      }
```

(Leave the three `localStorage.setItem(...)` lines that follow unchanged — they now run only with a validated `token`.)

**Step 4 — Run it (expect PASS).**
```bash
cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/ALNScanner
npx jest tests/unit/ui/connectionWizard.test.js -t "Invalid auth response"
```
Expected: 2 passed. Also re-run the full file to confirm the existing happy-path test (`should read deviceId from display dataset`) still passes:
```bash
npx jest tests/unit/ui/connectionWizard.test.js
```

**Step 5 — Commit.**
```bash
git add ALNScanner/src/ui/connectionWizard.js ALNScanner/tests/unit/ui/connectionWizard.test.js
git commit -m "fix(gm-scanner): validate auth response token, guard .json() parse (AUTH-4, HTTP-2)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task P4c.3: Clear stale aln_auth_token when ConnectionManager dispatches auth:required (AUTH-5)

**Context:** When the token is known bad, `ConnectionManager.connect()` (token invalid → `connectionWizard.js`/`connectionManager.js:86-91`) and the reconnection handler (`connectionManager.js:178-184`) dispatch `auth:required` but never remove `aln_auth_token` from localStorage. `clearStaleState()` exists in `StateValidationService` but is only invoked on the startup path. Defense-in-depth gap: remove the bad token at the moment it is known bad — the single dispatch point.

**Files:**
- Modify: `ALNScanner/src/network/connectionManager.js:84-136` and `:165-196`
- Test: `ALNScanner/tests/unit/network/connectionManager.test.js` (the harness uses jsdom's real `localStorage`; no mock needed)

Current code (verified, `connectionManager.js:85-91`):
```javascript
    // Validate token
    if (!this.isTokenValid()) {
      this.dispatchEvent(new CustomEvent('auth:required', {
        detail: { reason: 'invalid_token' }
      }));
      throw new Error('Invalid or expired token');
    }
```
and the reconnection-handler branch (`connectionManager.js:178-184`):
```javascript
        if (!this.isTokenValid()) {
          this.dispatchEvent(new CustomEvent('auth:required', {
            detail: { reason: 'token_expired' }
          }));
          return;
        }
```
and the max-retries branch (`connectionManager.js:128-132`):
```javascript
      } else {
        this.dispatchEvent(new CustomEvent('auth:required', {
          detail: { reason: 'max_retries' }
        }));
      }
```

**Step 1 — Write the failing test.** Append a new describe to `connectionManager.test.js`:

```javascript
  describe('auth:required clears stale token (AUTH-5)', () => {
    it('removes aln_auth_token when connecting with an expired token', async () => {
      localStorage.setItem('aln_auth_token', 'stale-jwt');
      connectionManager.token = createExpiredToken();

      await expect(connectionManager.connect()).rejects.toThrow();

      expect(localStorage.getItem('aln_auth_token')).toBeNull();
    });

    it('removes aln_auth_token when a server disconnect finds the token expired', async () => {
      global.fetch = jest.fn().mockResolvedValue({ ok: true });
      await connectionManager.connect(); // establish + register socket:disconnected handler
      localStorage.setItem('aln_auth_token', 'stale-jwt');
      connectionManager.token = createExpiredToken();

      const disconnectHandler = mockClient.addEventListener.mock.calls
        .find(c => c[0] === 'socket:disconnected')[1];
      disconnectHandler({ detail: { reason: 'io server disconnect' } });

      expect(localStorage.getItem('aln_auth_token')).toBeNull();
    });
  });
```

**Step 2 — Run it (expect FAIL).**
```bash
cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/ALNScanner
npx jest tests/unit/network/connectionManager.test.js -t "clears stale token"
```
Expected FAIL: `expect(localStorage.getItem('aln_auth_token')).toBeNull()` receives `"stale-jwt"` in both cases.

**Step 3 — Minimal implementation.** Add a tiny private helper and call it at each `auth:required` dispatch that means "token is bad" (`invalid_token`, `token_expired`, `max_retries`). Add the helper near the other privates in `connectionManager.js` (e.g. just above `_clearRetryTimer`):

```javascript
  /**
   * Remove the known-bad auth token so the wizard re-auths cleanly. (AUTH-5)
   * @private
   */
  _clearStaleToken() {
    this.token = null;
    try {
      localStorage.removeItem('aln_auth_token');
    } catch {
      // localStorage unavailable (non-browser env) — nothing to clear
    }
  }
```
Then call it immediately before the three dispatches. In `connect()` token-validity branch (`:86`):
```javascript
    if (!this.isTokenValid()) {
      this._clearStaleToken();
      this.dispatchEvent(new CustomEvent('auth:required', {
        detail: { reason: 'invalid_token' }
      }));
      throw new Error('Invalid or expired token');
    }
```
In the max-retries branch (`:128`):
```javascript
      } else {
        this._clearStaleToken();
        this.dispatchEvent(new CustomEvent('auth:required', {
          detail: { reason: 'max_retries' }
        }));
      }
```
In the reconnection handler (`:179`):
```javascript
        if (!this.isTokenValid()) {
          this._clearStaleToken();
          this.dispatchEvent(new CustomEvent('auth:required', {
            detail: { reason: 'token_expired' }
          }));
          return;
        }
```

**Step 4 — Run it (expect PASS).**
```bash
cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/ALNScanner
npx jest tests/unit/network/connectionManager.test.js
```
Expected: new tests pass AND the existing `auth:required` tests (which assert the event `detail`) still pass — clearing the token does not change the dispatched detail.

**Step 5 — Commit.**
```bash
git add ALNScanner/src/network/connectionManager.js ALNScanner/tests/unit/network/connectionManager.test.js
git commit -m "fix(gm-scanner): clear stale aln_auth_token on auth:required (AUTH-5)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task P4c.4: Escape/validate discovered-server URL before innerHTML (AUTH-6) + drop dead server.ip branch (HTTP-7)

**Context:** `displayDiscoveredServers()` (`connectionWizard.js:130-146`) interpolates `${server.url}` raw into `innerHTML` via `data-arg="${server.url}"`; a `"` in a value from a rogue LAN responder breaks out of the attribute. The `${server.ip || server.url}` text branch is dead — the producer (`scanForServers` at `:111`) always supplies only `{url}`. Fix: build the row with `createElement` + `textContent`/`setAttribute` (no string interpolation into HTML), drop the dead `server.ip` branch, and guard `selectServer` against a falsy url.

**Files:**
- Modify: `ALNScanner/src/ui/connectionWizard.js:130-146` (`displayDiscoveredServers`) and `:266-275` (`selectServer`)
- Test: `ALNScanner/tests/unit/ui/connectionWizard.test.js` (new `describe('displayDiscoveredServers()')`)

Current code (verified, `connectionWizard.js:137-145`):
```javascript
    servers.forEach(server => {
      const serverEl = document.createElement('div');
      serverEl.className = 'server-item';
      serverEl.innerHTML = `
        <span>🎮 Game Server at ${server.ip || server.url}</span>
        <button data-action="connectionWizard.selectServer" data-arg="${server.url}">Select</button>
      `;
      serversDiv.appendChild(serverEl);
    });
```

**Step 1 — Write the failing test.** Add a new describe block:

```javascript
  describe('displayDiscoveredServers()', () => {
    test('does not allow a quote in the url to break out of the data-arg attribute', () => {
      const evil = 'http://10.0.0.5:3000/"><img src=x onerror=alert(1)>';
      wizard.displayDiscoveredServers([{ url: evil }]);

      const btn = document.querySelector('#discoveredServers button[data-action="connectionWizard.selectServer"]');
      expect(btn).not.toBeNull();
      // The exact url must survive intact in the attribute (escaped by the DOM API, not interpolated)
      expect(btn.getAttribute('data-arg')).toBe(evil);
      // No injected <img> element may exist
      expect(document.querySelector('#discoveredServers img')).toBeNull();
    });

    test('renders the url text without relying on a server.ip field', () => {
      wizard.displayDiscoveredServers([{ url: 'http://10.0.0.7:3000' }]);
      const span = document.querySelector('#discoveredServers .server-item span');
      expect(span.textContent).toContain('http://10.0.0.7:3000');
    });
  });
```

**Step 2 — Run it (expect FAIL).**
```bash
cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/ALNScanner
npx jest tests/unit/ui/connectionWizard.test.js -t "displayDiscoveredServers"
```
Expected FAIL: the injected `<img>` is parsed into the DOM (so the `toBeNull()` assertion fails) and/or `data-arg` is truncated at the injected quote.

**Step 3 — Minimal implementation.** Replace the `servers.forEach` body in `displayDiscoveredServers` with DOM-API construction (`connectionWizard.js:137-145`):

```javascript
    servers.forEach(server => {
      if (!server || !server.url) return; // HTTP-7: guard malformed entries

      const serverEl = document.createElement('div');
      serverEl.className = 'server-item';

      const span = document.createElement('span');
      span.textContent = `🎮 Game Server at ${server.url}`;

      const button = document.createElement('button');
      button.textContent = 'Select';
      button.setAttribute('data-action', 'connectionWizard.selectServer');
      button.setAttribute('data-arg', server.url); // AUTH-6: setAttribute escapes, no innerHTML

      serverEl.appendChild(span);
      serverEl.appendChild(button);
      serversDiv.appendChild(serverEl);
    });
```
Also guard `selectServer` (`connectionWizard.js:269`) against a falsy url (HTTP-7 hardening):
```javascript
  selectServer(url) {
    if (!url) return;
    document.getElementById('serverUrl').value = url;
```

**Step 4 — Run it (expect PASS).**
```bash
cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/ALNScanner
npx jest tests/unit/ui/connectionWizard.test.js -t "displayDiscoveredServers"
```
Expected: 2 passed. Also confirm the existing `selectServer()` test still passes (it calls `selectServer('http://10.0.0.100:3000')`).

**Step 5 — Commit.**
```bash
git add ALNScanner/src/ui/connectionWizard.js ALNScanner/tests/unit/ui/connectionWizard.test.js
git commit -m "fix(gm-scanner): build discovered-server rows via DOM API, drop dead server.ip branch (AUTH-6, HTTP-7)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task P4c.5: Cap discovery scan concurrency + skip auto-scan when a saved orchestrator URL exists (HTTP-6)

**Context:** `scanForServers()` (`connectionWizard.js:43-124`) fires 254 IPs × 2 ports + localhost concurrent `fetch`es (each 500ms timeout) with no concurrency cap, spiking Pi CPU/memory and flooding the console with CORS/network errors. `showConnectionWizard()` (`:395-401`) auto-fires it 100ms after the modal opens, even when a known orchestrator URL is already saved. Fix: (a) batch the probes into chunks of ~32 (sequential batches, parallel within a batch); (b) skip the auto-scan in `showConnectionWizard` when `aln_orchestrator_url` is present in localStorage.

**Files:**
- Modify: `ALNScanner/src/ui/connectionWizard.js:70-104` (probe loop in `scanForServers`) and `:395-401` (`showConnectionWizard`)
- Test: `ALNScanner/tests/unit/ui/connectionWizard.test.js` (new `describe('scan concurrency / auto-scan gating')`)

Current code (verified, `connectionWizard.js:395-401`):
```javascript
  showConnectionWizard() {
    const modal = document.getElementById('connectionModal');
    modal.style.display = 'flex';

    // Auto-scan on open for better UX (but don't block)
    setTimeout(() => this.scanForServers(), 100);
  }
```

**Step 1 — Write the failing test.** Add a `#connectionModal` element to the shared DOM fixture (`document.body.innerHTML` in the top `beforeEach`) by appending `<div id="connectionModal"></div>` inside the form fixture, then add:

```javascript
  describe('auto-scan gating (HTTP-6)', () => {
    test('does NOT auto-scan when a saved orchestrator URL exists', () => {
      jest.useFakeTimers();
      Storage.prototype.getItem.mockImplementation((k) =>
        k === 'aln_orchestrator_url' ? 'http://10.0.0.9:3000' : null);
      const scanSpy = jest.spyOn(wizard, 'scanForServers').mockResolvedValue();

      wizard.showConnectionWizard();
      jest.advanceTimersByTime(200);

      expect(scanSpy).not.toHaveBeenCalled();
      jest.useRealTimers();
    });

    test('still auto-scans when no saved orchestrator URL exists', () => {
      jest.useFakeTimers();
      Storage.prototype.getItem.mockReturnValue(null);
      const scanSpy = jest.spyOn(wizard, 'scanForServers').mockResolvedValue();

      wizard.showConnectionWizard();
      jest.advanceTimersByTime(200);

      expect(scanSpy).toHaveBeenCalled();
      jest.useRealTimers();
    });
  });

  describe('scan concurrency cap (HTTP-6)', () => {
    test('never has more than the batch size of probes in flight at once', async () => {
      let inFlight = 0;
      let maxInFlight = 0;
      mockFetch.mockImplementation(() => {
        inFlight++;
        maxInFlight = Math.max(maxInFlight, inFlight);
        return new Promise((resolve) => setTimeout(() => {
          inFlight--;
          resolve({ ok: false });
        }, 0));
      });
      Storage.prototype.getItem.mockReturnValue(null);

      await wizard.scanForServers();

      expect(maxInFlight).toBeLessThanOrEqual(64); // batch of 32 IP-port pairs => <= 64 fetches
    });
  });
```

**Step 2 — Run it (expect FAIL).**
```bash
cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/ALNScanner
npx jest tests/unit/ui/connectionWizard.test.js -t "HTTP-6"
```
Expected FAIL: `showConnectionWizard` always schedules the scan (gating test fails), and the unbatched loop pushes ~509 concurrent fetches (`maxInFlight` far exceeds 64).

**Step 3 — Minimal implementation.**

(a) Gate auto-scan in `showConnectionWizard` (`connectionWizard.js:399-400`):
```javascript
    // HTTP-6: skip the auto-scan if we already have a saved orchestrator URL
    const savedUrl = localStorage.getItem('aln_orchestrator_url');
    if (!savedUrl) {
      setTimeout(() => this.scanForServers(), 100);
    }
```

(b) Replace the "build all promises then `Promise.all`" section in `scanForServers` (`connectionWizard.js:70-104`) with a batched scan. Build the candidate URL list first, then drain it in chunks:
```javascript
      const commonPorts = [3000, 8080];
      const protocol = window.location.protocol.replace(':', '');

      // Build the candidate list (no fetches yet)
      const candidates = [];
      for (let i = 1; i <= 254; i++) {
        for (const port of commonPorts) {
          candidates.push(`${protocol}://${subnet}.${i}:${port}`);
        }
      }
      candidates.push(`${protocol}://localhost:3000`);

      const probe = (url) =>
        fetch(`${url}/health`, { method: 'GET', mode: 'cors', signal: AbortSignal.timeout(500) })
          .then(response => (response.ok ? url : null))
          .catch(() => null);

      // HTTP-6: drain in bounded batches so we never open ~509 sockets at once
      const BATCH_SIZE = 32;
      const results = [];
      for (let i = 0; i < candidates.length; i += BATCH_SIZE) {
        const batch = candidates.slice(i, i + BATCH_SIZE);
        const settled = await Promise.all(batch.map(probe));
        results.push(...settled);
      }

      // Current origin if served from orchestrator
      if (window.location.pathname.startsWith('/gm-scanner/')) {
        results.push(window.location.origin);
      }

      const foundServers = [...new Set(results.filter(url => url !== null))];
```
(Delete the old `const promises = []` … `const results = await Promise.all(promises);` block this replaces. The `if (foundServers.length > 0) {...}` block below is unchanged.)

**Step 4 — Run it (expect PASS).**
```bash
cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/ALNScanner
npx jest tests/unit/ui/connectionWizard.test.js -t "HTTP-6"
```
Expected: 3 passed. Run the whole file to confirm no regressions:
```bash
npx jest tests/unit/ui/connectionWizard.test.js
```

**Step 5 — Commit.**
```bash
git add ALNScanner/src/ui/connectionWizard.js ALNScanner/tests/unit/ui/connectionWizard.test.js
git commit -m "perf(gm-scanner): cap discovery scan concurrency, skip auto-scan when URL saved (HTTP-6)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task P4c.6: Fetch tokens.json (dist root) before data/tokens.json; downgrade first-try 404 to debug (HTTP-3)

**Context:** `loadDatabase()` (`tokenManager.js:37-64`) fetches `data/tokens.json` FIRST, but `vite.config.js` `publicDir: 'data'` copies the *contents* of `data/` into the dist root — so `dist/data/tokens.json` does not exist and `data/tokens.json` 404s on every startup (~29× in one session), logging an error on the critical path each (re)load. Only the fallback `tokens.json` succeeds. Fix: try `tokens.json` (the real dist-root location) FIRST; keep `data/tokens.json` as the dev/back-compat fallback; downgrade the first-try miss to a debug log (a genuine total failure still throws). `Debug.log(msg, true)` is the error-level form; `Debug.log(msg)` is debug-level.

**Files:**
- Modify: `ALNScanner/src/core/tokenManager.js:37-64` (`loadDatabase`)
- Test: `ALNScanner/tests/unit/core/tokenManager.test.js` (`describe('loadDatabase')`)

Current code (verified, `tokenManager.js:38-49`):
```javascript
    try {
      // Try loading from submodule path first
      let response = await fetch('data/tokens.json');
      if (!response.ok) {
        Debug.log('Trying root directory for tokens.json');
        // Fallback to root directory for backward compatibility
        response = await fetch('tokens.json');
        if (!response.ok) {
          throw new Error('Failed to load tokens.json from data/ or root');
        }
      }
      this.database = await response.json();
```

**Step 1 — Write the failing test.** Add to `describe('loadDatabase')`:

```javascript
    it('should fetch tokens.json (dist root) FIRST, before data/tokens.json', async () => {
      const mockTokens = { tokenA: { SF_RFID: 'tokenA', SF_ValueRating: 1, SF_MemoryType: 'Personal' } };
      global.fetch.mockResolvedValueOnce({
        ok: true,
        url: 'tokens.json',
        json: () => Promise.resolve(mockTokens)
      });

      const result = await TokenManager.loadDatabase();

      expect(result).toBe(true);
      expect(global.fetch).toHaveBeenCalledTimes(1); // root hit on first try, no data/ round-trip
      expect(global.fetch).toHaveBeenNthCalledWith(1, 'tokens.json');
      expect(TokenManager.database).toEqual(mockTokens);
    });

    it('should fall back to data/tokens.json when root is missing', async () => {
      const mockTokens = { tokenB: { SF_RFID: 'tokenB', SF_ValueRating: 2, SF_MemoryType: 'Business' } };
      global.fetch
        .mockResolvedValueOnce({ ok: false }) // tokens.json (root) missing
        .mockResolvedValueOnce({ ok: true, url: 'data/tokens.json', json: () => Promise.resolve(mockTokens) });

      const result = await TokenManager.loadDatabase();

      expect(result).toBe(true);
      expect(global.fetch).toHaveBeenNthCalledWith(1, 'tokens.json');
      expect(global.fetch).toHaveBeenNthCalledWith(2, 'data/tokens.json');
      expect(TokenManager.database).toEqual(mockTokens);
    });
```

**Step 2 — Run it (expect FAIL).**
```bash
cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/ALNScanner
npx jest tests/unit/core/tokenManager.test.js -t "loadDatabase"
```
Expected FAIL: current order calls `data/tokens.json` first, so `toHaveBeenNthCalledWith(1, 'tokens.json')` fails. NOTE: the existing tests `should load tokens from data/tokens.json` and `should fallback to root tokens.json if data/ fails` (lines 27-62) assume the OLD order and WILL break — update them to the new order in this same step (Step 3) since the fetch sequence is the load-bearing change.

**Step 3 — Minimal implementation.** Replace `tokenManager.js:38-49` with root-first ordering and a debug-level first-try log:

```javascript
    try {
      // HTTP-3: dist root is the real location (vite publicDir:'data' copies
      // data/ CONTENTS into the dist root). Try it first; keep data/ as a
      // dev/back-compat fallback. First-try miss is debug, not error.
      let response = await fetch('tokens.json');
      if (!response.ok) {
        Debug.log('tokens.json not at root, trying data/ fallback'); // debug-level
        response = await fetch('data/tokens.json');
        if (!response.ok) {
          throw new Error('Failed to load tokens.json from root or data/');
        }
      }
      this.database = await response.json();
```
Also update the two existing pre-change tests (`tokenManager.test.js:27-62`) so their `mockResolvedValueOnce` ordering matches root-first (the first mocked response now answers `tokens.json`). For `should load tokens from data/tokens.json`, set its first mock `url` to `'tokens.json'`; for `should fallback...`, swap the two mocks so the failing one is the root and the succeeding one is `data/`.

**Step 4 — Run it (expect PASS).**
```bash
cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/ALNScanner
npx jest tests/unit/core/tokenManager.test.js
```
Expected: all `loadDatabase` tests pass (new + adjusted existing).

**Step 5 — Commit.**
```bash
git add ALNScanner/src/core/tokenManager.js ALNScanner/tests/unit/core/tokenManager.test.js
git commit -m "fix(gm-scanner): fetch tokens.json (dist root) before data/, debug-level first miss (HTTP-3)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task P4c.7: Guard tokens.json parse against 200-but-HTML SPA fallback; validate it is a non-empty token map (HTTP-4)

**Context:** If `tokens.json` is missing but the orchestrator serves the SPA shell with `200` (uncertain whether `/gm-scanner/*` returns the index for unknown static paths — defensive either way), `.json()` (`tokenManager.js:49`) throws an opaque `SyntaxError` caught by the outer catch, surfacing "Unexpected token <" instead of "token database not found." Also a `200` returning `{}` or a non-object would set an empty/invalid database silently. Fix: check `content-type` is JSON before parsing, isolate the parse, and validate the result is a non-empty plain-object map of tokens. Builds on P4c.6 (root-first order).

**Files:**
- Modify: `ALNScanner/src/core/tokenManager.js:49-57` (parse + post-parse validation in `loadDatabase`)
- Test: `ALNScanner/tests/unit/core/tokenManager.test.js` (`describe('loadDatabase')`)

Current code (verified, `tokenManager.js:49-57`, after P4c.6 the fetch order changes but this parse block is the same):
```javascript
      this.database = await response.json();
      Debug.log(`✅ Loaded ${Object.keys(this.database).length} tokens from ${response.url}`);
      Debug.log(`Sample keys: ${Object.keys(this.database).slice(0, 3).join(', ')}`);

      // Build group inventory for bonus calculations
      this.groupInventory = this.buildGroupInventory();
      this.logGroupStats();

      return true;
```

**Step 1 — Write the failing test.** Add to `describe('loadDatabase')`:

```javascript
    it('should return false (not crash) when a 200 returns the HTML SPA shell', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        url: 'tokens.json',
        headers: { get: (h) => (h.toLowerCase() === 'content-type' ? 'text/html' : null) },
        json: () => Promise.reject(new SyntaxError('Unexpected token <'))
      });

      const result = await TokenManager.loadDatabase();

      expect(result).toBe(false);
      expect(Object.keys(TokenManager.database).length).toBe(0);
    });

    it('should reject a 200 that returns an empty/invalid token map', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        url: 'tokens.json',
        headers: { get: () => 'application/json' },
        json: () => Promise.resolve({})
      });

      const result = await TokenManager.loadDatabase();

      expect(result).toBe(false);
      expect(Object.keys(TokenManager.database).length).toBe(0);
    });
```

**Step 2 — Run it (expect FAIL).**
```bash
cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/ALNScanner
npx jest tests/unit/core/tokenManager.test.js -t "SPA shell"
```
Expected FAIL: empty-map test currently returns `true` with a 0-token database (the validation does not exist yet). (The HTML-shell test may already return false via the outer catch but with a misleading message; the explicit content-type guard makes the failure intentional and clear.)

**Step 3 — Minimal implementation.** Add a content-type check + post-parse validation. Replace `tokenManager.js:49` (`this.database = await response.json();`) and the lines immediately after, up to `return true;`:

```javascript
      // HTTP-4: a 200 can still be the SPA HTML shell for an unknown static path.
      const contentType = response.headers?.get?.('content-type') || '';
      if (!contentType.includes('application/json')) {
        throw new Error('Token database response was not JSON (got SPA shell?)');
      }

      const parsed = await response.json();
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed) || Object.keys(parsed).length === 0) {
        throw new Error('Token database is empty or not a token map');
      }

      this.database = parsed;
      Debug.log(`✅ Loaded ${Object.keys(this.database).length} tokens from ${response.url}`);
      Debug.log(`Sample keys: ${Object.keys(this.database).slice(0, 3).join(', ')}`);

      // Build group inventory for bonus calculations
      this.groupInventory = this.buildGroupInventory();
      this.logGroupStats();

      return true;
```
The existing outer `catch (error)` already logs the message and returns `false` without loading demo data — the thrown messages above now surface a clear cause.

NOTE: existing happy-path tests in this file mock the response WITHOUT a `headers` object — add `headers: { get: () => 'application/json' }` to those mocks (the ones touched in P4c.6 and the `buildGroupInventory` setup that calls `loadDatabase`, if any) so they keep passing.

**Step 4 — Run it (expect PASS).**
```bash
cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/ALNScanner
npx jest tests/unit/core/tokenManager.test.js
```
Expected: all pass (new guards + updated happy-path mocks).

**Step 5 — Commit.**
```bash
git add ALNScanner/src/core/tokenManager.js ALNScanner/tests/unit/core/tokenManager.test.js
git commit -m "fix(gm-scanner): guard tokens.json against HTML SPA fallback, validate non-empty map (HTTP-4)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task P4c.8: Resolve VideoController /api/videos drift — document the WebSocket-only design (HTTP-8)

**Context:** `ALNScanner/CLAUDE.md` and the VideoController docstring claim the video picker is "Populated from `GET /api/videos`", but NO such endpoint exists in `backend/contracts/openapi.yaml` or `backend/src/routes/` (verified: zero matches for `api/videos`), and nothing in `VideoController.js` (verified pure-WebSocket: every method calls `sendCommand(this.connection, 'video:*', ...)`) fetches it. `addToQueue(videoFile)` (`VideoController.js:61-63`) relies on the operator knowing the exact filename. This is doc/feature drift, not an error-handling defect.

**Decision (assumption — flag for the assembler):** There is currently no manual video-picker UI wired to a list source, and adding a new contracted HTTP endpoint + backend route + tests is out of scope for a comms-hardening pass. We resolve the drift by **fixing the docs** to match the real WebSocket-only design rather than implementing `/api/videos`. If a future video-picker UI is desired, that is a separate feature (it would add `GET /api/videos` to `openapi.yaml` FIRST, then a backend route returning the contents of `config.video.directory` with `res.ok`/timeout/JSON guards, then the scanner consumer — contract-first per the repo rules). This task does NOT cross the wire, so no contract change is needed now.

**Files:**
- Modify: `ALNScanner/CLAUDE.md` (the `### VideoController` → "Video List:" line that reads "Populated from `GET /api/videos` (backend's video directory)")
- Modify: `ALNScanner/src/admin/VideoController.js:56-63` (docstring on `addToQueue`)
- Test: none — documentation-only change (no behavioral code path; a unit test would assert prose).

**Step 1 — (No failing test.)** This is a docs/comment correction; there is no runtime behavior to assert. Verify the claim is false first:
```bash
cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem
grep -rn "api/videos" backend/contracts backend/src ALNScanner/src   # expect: no matches
```
Expected: no matches (confirms the endpoint does not exist).

**Step 2 — (No run; nothing to fail.)**

**Step 3 — Apply the doc fix.** In `ALNScanner/CLAUDE.md`, change the VideoController "Video List" line from:
```
**Video List:**
- Populated from `GET /api/videos` (backend's video directory)
```
to:
```
**Video List:**
- No HTTP list endpoint exists. Manual video-add is WebSocket-only: the operator
  supplies the exact filename to `video:queue:add` via `addToQueue(videoFile)`.
  (A future picker UI would add a contracted `GET /api/videos` endpoint first.)
```
And update the `addToQueue` docstring in `VideoController.js:56-60`:
```javascript
  /**
   * Add a video to the playback queue (WebSocket-only).
   * No /api/videos list endpoint exists — the caller must supply the exact
   * filename present in the backend video directory.
   * @param {string} videoFile - Video filename (e.g., "jaw001.mp4")
   * @returns {Promise<Object>} Add response
   */
```

**Step 4 — Verify the docs no longer assert a non-existent endpoint.**
```bash
cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem
grep -rn "GET /api/videos" ALNScanner/CLAUDE.md ALNScanner/src/admin/VideoController.js   # expect: no matches
```
Expected: no matches.

**Step 5 — Commit.**
```bash
git add ALNScanner/CLAUDE.md ALNScanner/src/admin/VideoController.js
git commit -m "docs(gm-scanner): VideoController video-add is WebSocket-only; drop phantom GET /api/videos (HTTP-8)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

## Phase 4d — Renderer / state correctness & misc
### Task P4d.1: Escape backend session name in SessionRenderer templates (SR-2)

**Files:**
- Modify: `ALNScanner/src/ui/renderers/SessionRenderer.js:180-181` (and the five `${sessionName}` interpolations at lines 203, 223, 246, 266) — currently injects `session?.name` raw into `innerHTML`
- Modify: `ALNScanner/src/ui/renderers/SessionRenderer.js:67` — differential name update uses `textContent` (already safe), but template path is unescaped
- Test: `ALNScanner/tests/unit/ui/renderers/SessionRenderer.test.js` (jsdom; harness at lines 1-30)

Every other renderer (`EnvironmentRenderer`, `HealthRenderer`, `CueRenderer`) imports `escapeHtml` and has an XSS test (see `EnvironmentRenderer.test.js:98-110`). `SessionRenderer` is the only one that interpolates a backend string into `innerHTML` un-escaped. Current code (`SessionRenderer.js:180-181`):

```js
  _getTemplate(viewState, session) {
    const sessionName = session?.name || 'New Session';
```

…then `<h4 id="session-name">${sessionName}</h4>` at lines 203/223/246/266.

**Step 1 — Write failing test.** Add inside the existing `describe('SessionRenderer', ...)` block (it already has `container` + jsdom setup):

```js
  describe('XSS — session name escaping (SR-2)', () => {
    it('should escape HTML in the session name in the setup template', () => {
      renderer.render({ name: '<img src=x onerror="alert(1)">', status: 'setup' });

      const header = container.querySelector('.session-header');
      expect(header.innerHTML).not.toContain('<img');
      expect(header.innerHTML).toContain('&lt;img');
    });

    it('should escape HTML in the session name in the active template', () => {
      renderer.render({ name: '<b>boom</b>', status: 'active' });

      const nameEl = container.querySelector('#session-name');
      expect(nameEl.textContent).toBe('<b>boom</b>'); // rendered as text, not markup
      expect(container.querySelector('.session-header').innerHTML).toContain('&lt;b&gt;');
    });
  });
```

**Step 2 — Run + expect FAIL.**

```bash
cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/ALNScanner
npx jest tests/unit/ui/renderers/SessionRenderer.test.js -t "session name escaping"
```

Expected: FAIL — `Expected substring: not "<img"` (raw markup is present), and the second assertion fails because the unescaped `<b>` is parsed into a real element so `#session-name` is empty / `&lt;b&gt;` absent.

**Step 3 — Minimal implementation.** Import the existing util and escape the name. Edit `SessionRenderer.js`:

```js
// top of file (line 11, after the JSDoc block):
import { escapeHtml } from '../../utils/escapeHtml.js';
```

```js
  _getTemplate(viewState, session) {
    const sessionName = escapeHtml(session?.name) || 'New Session';
```

(`escapeHtml` returns `''` for non-strings, so the `|| 'New Session'` fallback still fires for missing names.)

**Step 4 — Run + expect PASS.**

```bash
cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/ALNScanner
npx jest tests/unit/ui/renderers/SessionRenderer.test.js
```

Expected: PASS — all existing SessionRenderer tests plus the two new XSS tests green.

**Step 5 — Commit.**

```bash
git add ALNScanner/src/ui/renderers/SessionRenderer.js ALNScanner/tests/unit/ui/renderers/SessionRenderer.test.js
git commit -m "fix(gm-scanner): escapeHtml session name in SessionRenderer (SR-2)

The only renderer interpolating a backend string into innerHTML without
escaping. Matches the escapeHtml pattern used by every other renderer.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task P4d.2: Add StateStore.replace() for full-domain replacement (SSR-2 prerequisite)

**Files:**
- Modify: `ALNScanner/src/core/stateStore.js:18-43` — `update()` is a pure shallow merge with no key removal
- Test: `ALNScanner/tests/unit/core/stateStore.test.js` (node env; harness at lines 1-9)

`update()` shallow-merges (`{ ...prev, ...state }`, line 20), so a domain accumulates orphan keys: `sync:full` gameclock = `{status, elapsed, expectedDuration}` while `service:state` gameclock = `{status, elapsed, startTime, totalPausedMs}` — after both fire the domain carries disjoint stale fields. We need a way to replace a domain wholesale (used by sync:full restore in P4d.3). Keep `update()` for incremental `service:state` deltas; add `replace()` for snapshots.

**Step 1 — Write failing test.** Add a new `describe` block in `stateStore.test.js`:

```js
  describe('replace() — full-domain replacement (SSR-2)', () => {
    it('should drop keys absent from the new state (no orphan merge)', () => {
      store.update('gameclock', { status: 'running', elapsed: 10, startTime: 123, totalPausedMs: 0 });
      store.replace('gameclock', { status: 'paused', elapsed: 10, expectedDuration: 7200 });
      expect(store.get('gameclock')).toEqual({ status: 'paused', elapsed: 10, expectedDuration: 7200 });
    });

    it('should notify listeners with the replaced state and prev', () => {
      store.update('video', { nowPlaying: 'a.mp4', isPlaying: true });
      const cb = jest.fn();
      store.on('video', cb);
      store.replace('video', { isPlaying: false });
      expect(cb).toHaveBeenCalledWith({ isPlaying: false }, { nowPlaying: 'a.mp4', isPlaying: true });
    });

    it('should not notify when the replacement is shallow-equal', () => {
      store.update('audio', { sink: 'hdmi' });
      const cb = jest.fn();
      store.on('audio', cb);
      store.replace('audio', { sink: 'hdmi' });
      expect(cb).not.toHaveBeenCalled();
    });
  });
```

**Step 2 — Run + expect FAIL.**

```bash
cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/ALNScanner
npx jest tests/unit/core/stateStore.test.js -t "full-domain replacement"
```

Expected: FAIL — `TypeError: store.replace is not a function`.

**Step 3 — Minimal implementation.** Add `replace()` to `stateStore.js` after `update()` (line 43), reusing the shallow-equality + notification logic:

```js
  replace(domain, state) {
    const prev = this._state[domain] || null;
    const next = { ...state };

    // Skip notification if nothing actually changed (shallow equality)
    if (prev !== null) {
      const keys = Object.keys(next);
      const prevKeys = Object.keys(prev);
      if (keys.length === prevKeys.length && keys.every(k => next[k] === prev[k])) {
        return;
      }
    }

    this._prev[domain] = prev;
    this._state[domain] = next;
    const listeners = this._listeners[domain];
    if (listeners) {
      for (const cb of listeners) {
        try {
          cb(this._state[domain], this._prev[domain]);
        } catch (e) {
          console.error(`StateStore listener error [${domain}]:`, e);
        }
      }
    }
  }
```

**Step 4 — Run + expect PASS.**

```bash
cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/ALNScanner
npx jest tests/unit/core/stateStore.test.js
```

Expected: PASS — existing + 3 new tests green.

**Step 5 — Commit.**

```bash
git add ALNScanner/src/core/stateStore.js ALNScanner/tests/unit/core/stateStore.test.js
git commit -m "feat(gm-scanner): add StateStore.replace() for full-domain snapshots (SSR-2)

update() shallow-merges and never removes keys, so domains accumulate
orphan fields across sync:full vs service:state shapes (gameclock drift).
replace() swaps a domain wholesale; used by sync:full restore.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task P4d.3: Use replace() for sync:full domain restore so stale state cannot linger (SR-3, SSR-2)

**Files:**
- Modify: `ALNScanner/src/network/networkedSession.js:246-258` — the `if (payload.X) this._store.update(...)` block inside the `sync:full` case
- Test: `ALNScanner/tests/unit/network/networkedSession.test.js` (the `sync:full → StateStore` block at lines 794-905 uses a `mockStore` with `update`/`get`/`getAll`)

A `sync:full` is an authoritative full snapshot. Today each domain is restored with `update()` (shallow merge), so (a) a domain that already accumulated keys keeps the stale ones (SSR-2), and (b) if a future/partial `sync:full` omits a domain the renderer keeps showing stale state (SR-3, e.g. video still "Playing"). Switch the snapshot restore to `replace()`. Current code (`networkedSession.js:246-258`):

```js
          if (this._store) {
            if (payload.music) this._store.update('music', payload.music);
            if (payload.serviceHealth) this._store.update('health', payload.serviceHealth);
            if (payload.environment?.bluetooth) this._store.update('bluetooth', payload.environment.bluetooth);
            if (payload.environment?.audio) this._store.update('audio', payload.environment.audio);
            if (payload.environment?.lighting) this._store.update('lighting', payload.environment.lighting);
            if (payload.gameClock) this._store.update('gameclock', payload.gameClock);
            if (payload.cueEngine) this._store.update('cueengine', payload.cueEngine);
            if (payload.heldItems) this._store.update('held', { items: payload.heldItems });
            if (payload.videoStatus) this._store.update('video', payload.videoStatus);
            if (payload.sound) this._store.update('sound', payload.sound);
          }
```

**Step 1 — Write failing test.** The existing block's `mockStore` only stubs `update`. Add `replace: jest.fn()` to that mock (line ~798) and append tests asserting `replace` (not `update`) is used for snapshot restore. Add inside the `sync:full → StateStore` describe:

```js
      it('should REPLACE (not merge) the video domain on sync:full restore (SR-3)', () => {
        const payload = { videoStatus: { nowPlaying: 'jaw011.mp4', isPlaying: true } };
        storeMessageHandler({ detail: { type: 'sync:full', payload } });

        expect(mockStore.replace).toHaveBeenCalledWith('video', { nowPlaying: 'jaw011.mp4', isPlaying: true });
        expect(mockStore.update).not.toHaveBeenCalledWith('video', expect.anything());
      });

      it('should REPLACE gameclock on sync:full so service:state-only keys are dropped (SSR-2)', () => {
        const payload = { gameClock: { status: 'paused', elapsed: 10, expectedDuration: 7200 } };
        storeMessageHandler({ detail: { type: 'sync:full', payload } });

        expect(mockStore.replace).toHaveBeenCalledWith('gameclock', { status: 'paused', elapsed: 10, expectedDuration: 7200 });
      });
```

Also extend the `mockStore` definition in this block's `beforeEach` (line ~798):

```js
        mockStore = {
          update: jest.fn(),
          replace: jest.fn(),
          get: jest.fn(),
          getAll: jest.fn(() => ({})),
        };
```

> NOTE: the existing assertions in this block (lines 828-905) assert `mockStore.update` was called for each domain. Those assertions must be flipped to `replace` in the same edit — they are now testing the wrong method. Update each `expect(mockStore.update).toHaveBeenCalledWith('music', ...)` → `expect(mockStore.replace).toHaveBeenCalledWith('music', ...)` etc. (music/health/bluetooth/audio/lighting/gameclock/cueengine/held/video). Leave the `service:state → StateStore` block (lines 741-792) on `update` — service:state stays incremental.

**Step 2 — Run + expect FAIL.**

```bash
cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/ALNScanner
npx jest tests/unit/network/networkedSession.test.js -t "StateStore"
```

Expected: FAIL — `expect(mockStore.replace).toHaveBeenCalledWith('video', ...)` fails (replace never called; production still calls `update`).

**Step 3 — Minimal implementation.** In `networkedSession.js:247-257` change `this._store.update(` → `this._store.replace(` for the snapshot domains (leave the `service:state` case at line 318 on `update`):

```js
          if (this._store) {
            if (payload.music) this._store.replace('music', payload.music);
            if (payload.serviceHealth) this._store.replace('health', payload.serviceHealth);
            if (payload.environment?.bluetooth) this._store.replace('bluetooth', payload.environment.bluetooth);
            if (payload.environment?.audio) this._store.replace('audio', payload.environment.audio);
            if (payload.environment?.lighting) this._store.replace('lighting', payload.environment.lighting);
            if (payload.gameClock) this._store.replace('gameclock', payload.gameClock);
            if (payload.cueEngine) this._store.replace('cueengine', payload.cueEngine);
            if (payload.heldItems) this._store.replace('held', { items: payload.heldItems });
            if (payload.videoStatus) this._store.replace('video', payload.videoStatus);
            if (payload.sound) this._store.replace('sound', payload.sound);
          }
```

**Step 4 — Run + expect PASS.**

```bash
cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/ALNScanner
npx jest tests/unit/network/networkedSession.test.js
```

Expected: PASS — full networkedSession suite green.

**Step 5 — Commit.**

```bash
git add ALNScanner/src/network/networkedSession.js ALNScanner/tests/unit/network/networkedSession.test.js
git commit -m "fix(gm-scanner): replace() service domains on sync:full restore (SR-3, SSR-2)

sync:full is an authoritative snapshot — merging let stale keys linger
across the sync:full vs service:state gameclock shapes, and a partial
sync:full could leave a domain showing stale state. service:state stays
incremental (update); sync:full now replaces.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task P4d.4: structuredClone nested domains in StateStore.get()/getAll() (SSR-3)

**Files:**
- Modify: `ALNScanner/src/core/stateStore.js:45-50` — `get()`/`getAll()` return shallow copies; nested values (`video.queue`, `cueengine.cues`, `bluetooth.devices`, `health` object-of-objects) are shared by reference
- Test: `ALNScanner/tests/unit/core/stateStore.test.js`

A consumer mutating a nested object/array would corrupt canonical state and defeat the shallow-equality change detection in `update()`/`replace()`. Current code:

```js
  get(domain) {
    const state = this._state[domain];
    return state ? { ...state } : null;
  }

  getAll() { return { ...this._state }; }
```

`structuredClone` is available in jsdom/Node 18+ (this repo runs Node 'current' via babel-preset-env; verify locally — it is present in the Pi's Node).

**Step 1 — Write failing test.** Add to the `get() / getAll()` describe block:

```js
    it('should deep-copy nested objects from get() (SSR-3)', () => {
      store.update('video', { queue: [{ id: 'a' }, { id: 'b' }] });
      const copy = store.get('video');
      copy.queue.push({ id: 'c' });
      copy.queue[0].id = 'mutated';
      expect(store.get('video').queue).toEqual([{ id: 'a' }, { id: 'b' }]);
    });

    it('should deep-copy nested objects from getAll() (SSR-3)', () => {
      store.update('health', { vlc: { status: 'healthy' } });
      const all = store.getAll();
      all.health.vlc.status = 'down';
      expect(store.get('health')).toEqual({ vlc: { status: 'healthy' } });
    });
```

**Step 2 — Run + expect FAIL.**

```bash
cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/ALNScanner
npx jest tests/unit/core/stateStore.test.js -t "deep-copy nested"
```

Expected: FAIL — `expect(...).toEqual([{id:'a'},{id:'b'}])` receives the mutated `[{id:'mutated'},{id:'b'},{id:'c'}]` (nested array shared by reference).

**Step 3 — Minimal implementation.** Use `structuredClone` in `stateStore.js`:

```js
  get(domain) {
    const state = this._state[domain];
    return state ? structuredClone(state) : null;
  }

  getAll() { return structuredClone(this._state); }
```

> NOTE: domains may hold non-cloneable values in future (e.g. a real `Map`/`Set` from `cueengine`). `structuredClone` DOES handle Map/Set. It does NOT handle functions — service domains carry plain data only, so this is safe. The existing "return a copy" tests (lines 111-123) still pass.

**Step 4 — Run + expect PASS.**

```bash
cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/ALNScanner
npx jest tests/unit/core/stateStore.test.js
```

Expected: PASS.

**Step 5 — Commit.**

```bash
git add ALNScanner/src/core/stateStore.js ALNScanner/tests/unit/core/stateStore.test.js
git commit -m "fix(gm-scanner): deep-copy nested domains in StateStore.get/getAll (SSR-3)

Shallow copies shared nested objects/arrays (video.queue, health map) by
reference — a mutating consumer could corrupt canonical state and defeat
shallow-equality change detection. structuredClone isolates them.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task P4d.5: Remove the dead discoveredDevices merge path in EnvironmentRenderer (SR-4)

**Files:**
- Modify: `ALNScanner/src/ui/renderers/EnvironmentRenderer.js:261-282, 306-331` — `renderBluetooth` destructures `discoveredDevices = []` and `_mergeDevices` appends discovered devices, but `bluetoothService.getState()` never supplies `discoveredDevices`
- Test: `ALNScanner/tests/unit/ui/renderers/EnvironmentRenderer.test.js`

Confirmed against backend `bluetoothService.getState()` (`backend/src/services/bluetoothService.js:437`) which returns only `{available, scanning, pairedDevices, connectedDevices}` — no `discoveredDevices`. The renderer's discovered-merge is dead code (always `[]` via `service:state`). **Decision: remove the dead path** (Pi's BCM43455 supports a single A2DP stream and the operational model is pair-then-connect known speakers; surfacing arbitrary discovered devices is not a current feature, and adding it would be a backend `getState()`/sync:full contract change out of scope for this phase). Current code (`EnvironmentRenderer.js:261-262, 282`):

```js
  renderBluetooth(btState, prev = null) {
    const { scanning, discoveredDevices = [], connectedDevices = [] } = btState;
    ...
    const allDevices = this._mergeDevices(connectedDevices, btState.pairedDevices, discoveredDevices);
```

**Step 1 — Write failing test.** Assert that the renderer no longer renders un-paired "discovered" devices (it should only render connected + paired). Locate the EnvironmentRenderer Bluetooth describe block and add:

```js
    it('should not render discovered (un-paired) devices — dead path removed (SR-4)', () => {
      // discoveredDevices is not part of bluetoothService.getState(); ignore it if present
      renderer.renderBluetooth({
        scanning: false,
        connectedDevices: [],
        pairedDevices: [{ address: 'AA:BB', name: 'MaxEBeats' }],
        discoveredDevices: [{ address: 'CC:DD', name: 'StrangerSpeaker' }],
      });

      const list = document.getElementById('bt-device-list');
      expect(list.textContent).toContain('MaxEBeats');
      expect(list.textContent).not.toContain('StrangerSpeaker');
      expect(list.querySelectorAll('.bt-device-item')).toHaveLength(1);
    });
```

(This test requires the Bluetooth DOM scaffold `#bt-device-list`, `#bt-speaker-count`, `#btn-bt-scan`, `#bt-scan-status` — they are already created in the EnvironmentRenderer test `beforeEach` body. Verify and add any missing ones.)

**Step 2 — Run + expect FAIL.**

```bash
cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/ALNScanner
npx jest tests/unit/ui/renderers/EnvironmentRenderer.test.js -t "discovered"
```

Expected: FAIL — `StrangerSpeaker` IS rendered (current `_mergeDevices` appends it), `toHaveLength(1)` receives 2.

**Step 3 — Minimal implementation.** Drop the discovered handling. Edit `EnvironmentRenderer.js`:

```js
  renderBluetooth(btState, prev = null) {
    const { scanning, connectedDevices = [] } = btState;
```

```js
    const allDevices = this._mergeDevices(connectedDevices, btState.pairedDevices);
```

And simplify `_mergeDevices` (remove the `discoveredDevices` parameter + its loop at lines 323-328):

```js
  _mergeDevices(connectedDevices, pairedDevices) {
    const allDevices = [];

    // Connected devices first
    connectedDevices.forEach(d => {
      allDevices.push({ ...d, status: 'connected' });
    });

    // Paired (not already connected)
    if (pairedDevices) {
      pairedDevices.forEach(d => {
        if (!allDevices.some(ad => ad.address === d.address)) {
          allDevices.push({ ...d, status: 'paired' });
        }
      });
    }

    return allDevices;
  }
```

Also update the `renderBluetooth` JSDoc (line 258) and the `else` branch in `_renderDeviceItem` (lines 361-368) — the "Pair" button branch is now unreachable since no `discovered`-status devices exist. Leave the Pair branch only if `pairedDevices` can include un-paired entries; per `getState()` it cannot, so the branch is dead too. **Keep `_renderDeviceItem`'s Pair branch** for now (harmless, no test covers it) OR remove it and note in commit — recommend removing for cleanliness and assert in test that no Pair button renders.

**Step 4 — Run + expect PASS.**

```bash
cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/ALNScanner
npx jest tests/unit/ui/renderers/EnvironmentRenderer.test.js
```

Expected: PASS. If any existing test fed `discoveredDevices` and expected it rendered, update it to reflect the removed feature.

**Step 5 — Commit.**

```bash
git add ALNScanner/src/ui/renderers/EnvironmentRenderer.js ALNScanner/tests/unit/ui/renderers/EnvironmentRenderer.test.js
git commit -m "refactor(gm-scanner): remove dead discoveredDevices merge in EnvironmentRenderer (SR-4)

bluetoothService.getState() never supplies discoveredDevices over
service:state, so the discovered-merge path was dead. Operational model is
pair-then-connect known speakers (single A2DP stream on Pi).

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task P4d.6: CSS.escape renderer querySelector id lookups (SR-5)

**Files:**
- Modify: `ALNScanner/src/ui/renderers/HealthRenderer.js:112` — `this.container.querySelector(\`[data-service="${s.id}"]\`)`
- Modify: `ALNScanner/src/ui/renderers/CueRenderer.js:121` and `:215` — `querySelector(\`[data-cue-id="${cue.id}"]\`)` / `${cueId}`
- Modify: `ALNScanner/src/ui/renderers/EnvironmentRenderer.js:120` — `this.sceneGrid.querySelector(\`[data-scene-id="${scene.id}"]\`)`
- Test: add to each renderer's existing test file

The id is `escapeHtml`'d into the attribute (`innerHTML`) but the cache-lookup `querySelector` uses the raw id. If an id ever contains a quote/metacharacter, the escaped attribute and the raw selector disagree (silent cache miss → no differential update) or the selector throws. `CSS.escape` makes the selector match the rendered attribute. (jsdom provides `CSS.escape`.)

**Step 1 — Write failing test.** Add to `HealthRenderer.test.js` (the harness builds `#health-dashboard`). A service id with a quote forces a degraded (expanded) render and a cache lookup:

```js
    it('should cache the service card even when an id contains a selector metachar (SR-5)', () => {
      // Force expanded mode (one service down) with a metachar id in SERVICE_NAMES
      renderer.SERVICE_NAMES = { 'vlc"x': 'VLC X', music: 'Music' };
      renderer.render({ serviceHealth: { 'vlc"x': { status: 'down', message: 'boom' }, music: { status: 'healthy' } } });

      // Cache lookup must have found the card (no throw, differential update path works)
      expect(renderer._serviceEls['vlc"x']).toBeDefined();
      expect(renderer._serviceEls['vlc"x'].card).toBeTruthy();
    });
```

**Step 2 — Run + expect FAIL.**

```bash
cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/ALNScanner
npx jest tests/unit/ui/renderers/HealthRenderer.test.js -t "selector metachar"
```

Expected: FAIL — `querySelector('[data-service="vlc"x"]')` throws `SyntaxError` (unescaped quote) OR returns null, so `_serviceEls['vlc"x']` is `undefined`.

**Step 3 — Minimal implementation.** Wrap each raw-id selector with `CSS.escape`:

`HealthRenderer.js:112`:
```js
      const card = this.container.querySelector(`[data-service="${CSS.escape(s.id)}"]`);
```

`CueRenderer.js:121`:
```js
      const item = this.standingListEl.querySelector(`[data-cue-id="${CSS.escape(cue.id)}"]`);
```

`CueRenderer.js:215`:
```js
      const item = this.activeListEl.querySelector(`[data-cue-id="${CSS.escape(cueId)}"]`);
```

`EnvironmentRenderer.js:120`:
```js
      const btn = this.sceneGrid.querySelector(`[data-scene-id="${CSS.escape(scene.id)}"]`);
```

(No import needed — `CSS` is a global in jsdom and browsers.)

**Step 4 — Run + expect PASS.**

```bash
cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/ALNScanner
npx jest tests/unit/ui/renderers/HealthRenderer.test.js tests/unit/ui/renderers/CueRenderer.test.js tests/unit/ui/renderers/EnvironmentRenderer.test.js
```

Expected: PASS — all three renderer suites green.

**Step 5 — Commit.**

```bash
git add ALNScanner/src/ui/renderers/HealthRenderer.js ALNScanner/src/ui/renderers/CueRenderer.js ALNScanner/src/ui/renderers/EnvironmentRenderer.js ALNScanner/tests/unit/ui/renderers/HealthRenderer.test.js
git commit -m "fix(gm-scanner): CSS.escape id lookups in renderer querySelectors (SR-5)

Ids are escapeHtml'd into attributes but matched with raw selectors —
a metachar would cause a silent cache miss or a selector throw. CSS.escape
aligns the lookup with the rendered attribute.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task P4d.7: Dispatch socket:connected from exactly one place (WS-5)

**Files:**
- Modify: `ALNScanner/src/network/orchestratorClient.js:73-75` (the `onConnect` resolver in `connect()`) and `:216-219` (the persistent `on('connect')` in `_setupSocketHandlers`)
- Test: `ALNScanner/tests/unit/network/orchestratorClient.test.js` (harness lines 1-28; `createMockSocket` provides `_simulateConnect`)

Both the persistent `on('connect')` (line 216) and the per-connect `once('connect')` resolver (line 73) call `this.dispatchEvent(new CustomEvent('socket:connected'))`. On the first connect both fire → the event dispatches twice. Benign today (no listener) but a future on-connect listener (e.g. offline-queue re-sync) would double-fire — exactly the wrong thing in reconnect churn. Make the persistent handler the single source; the `connect()` promise still resolves.

**Step 1 — Write failing test.** Add to the `connect` describe in `orchestratorClient.test.js`:

```js
    it('should dispatch socket:connected exactly once per connect (WS-5)', async () => {
      const handler = jest.fn();
      client.addEventListener('socket:connected', handler);

      const p = client.connect('token', { deviceId: 'TEST', deviceType: 'gm' });
      mockSocket._simulateConnect();
      await p;

      expect(handler).toHaveBeenCalledTimes(1);
    });
```

> Check `createMockSocket._simulateConnect` — if it invokes BOTH the `once('connect')` and the persistent `on('connect')` handlers (it should, to mirror socket.io), the current code dispatches twice and the test fails. If the mock only fires `once` handlers, adjust the mock so `_simulateConnect()` triggers all registered `connect` handlers (matches real socket.io fan-out). Read `createMockSocket` first (it is defined in a jest setup/helper imported globally — grep for it).

**Step 2 — Run + expect FAIL.**

```bash
cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/ALNScanner
npx jest tests/unit/network/orchestratorClient.test.js -t "exactly once"
```

Expected: FAIL — `expect(handler).toHaveBeenCalledTimes(1)` receives 2.

**Step 3 — Minimal implementation.** Remove the dispatch from the per-connect resolver (keep the resolve), leaving the persistent handler as the sole dispatcher. Edit `orchestratorClient.js:67-76`:

```js
      const onConnect = () => {
        if (this.connectionTimeout) {
          clearTimeout(this.connectionTimeout);
          this.connectionTimeout = null;
        }
        // socket:connected is dispatched by the persistent on('connect') handler
        // (single source) — here we only set state + resolve the connect() promise.
        this.isConnected = true;
        resolve();
      };
```

(The persistent `on('connect')` at lines 216-219 keeps `this.isConnected = true; this.dispatchEvent(...socket:connected...)`.)

**Step 4 — Run + expect PASS.**

```bash
cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/ALNScanner
npx jest tests/unit/network/orchestratorClient.test.js
```

Expected: PASS — the existing "should emit socket:connected event when connection succeeds" test (line 76) still passes (persistent handler fires), plus the new once-only test.

**Step 5 — Commit.**

```bash
git add ALNScanner/src/network/orchestratorClient.js ALNScanner/tests/unit/network/orchestratorClient.test.js
git commit -m "fix(gm-scanner): dispatch socket:connected from one place (WS-5)

Both the per-connect resolver and the persistent on('connect') handler
dispatched it — a future on-connect listener would double-fire during
reconnect churn. Resolver now only resolves; persistent handler emits.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task P4d.8: Warn when the envelope unwrap fallback hits a non-conforming event (WS-7)

**Files:**
- Modify: `ALNScanner/src/network/orchestratorClient.js:264-273` (`_setupMessageHandlers` forwarding) and `:143-145` (`sendCommand` ack handler)
- Test: `ALNScanner/tests/unit/network/orchestratorClient.test.js`

The `envelope.data || envelope` fallback (lines 144, 267) is defensible runtime safety but silently accepts events that violate the required `{event, data, timestamp}` envelope — turning contract drift into confusing undefined-field behavior. Keep the fallback, but warn when it triggers. The scanner uses a `Debug` singleton; for low-friction use `console.warn` (consistent with `OrchestratorClient`'s existing `console.warn` at line 47).

**Step 1 — Write failing test.** Add to `orchestratorClient.test.js`:

```js
    it('should warn when a forwarded event lacks the AsyncAPI envelope (WS-7)', async () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      const p = client.connect('token', { deviceId: 'TEST', deviceType: 'gm' });
      mockSocket._simulateConnect();
      await p;

      // Emit a non-conforming event (no .data envelope)
      mockSocket._simulateMessage('session:update', { id: 'sess-1', status: 'active' });

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('non-conforming'),
        'session:update'
      );
      warnSpy.mockRestore();
    });
```

> HARNESS NOTE (verified): `createMockSocket()` in `orchestratorClient.test.js:457` exposes `_simulateMessage(type, data)` which invokes the registered `on(type)` handlers with `data` as the envelope. Use that (there is no `_emit`). `_simulateConnect()` fires ALL `connect` handlers (both `on` and `once` are stored in one array), so the persistent + once handlers both run.

**Step 2 — Run + expect FAIL.**

```bash
cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/ALNScanner
npx jest tests/unit/network/orchestratorClient.test.js -t "non-conforming"
```

Expected: FAIL — `console.warn` not called (current code silently falls back).

**Step 3 — Minimal implementation.** Add the warn in the forwarding handler (`orchestratorClient.js:265-272`):

```js
    messageTypes.forEach(type => {
      this.socket.on(type, (envelope) => {
        // Extract payload from AsyncAPI envelope
        if (envelope == null || envelope.data === undefined) {
          console.warn('OrchestratorClient: received non-conforming (un-enveloped) event', type);
        }
        const payload = envelope?.data ?? envelope;
        // Forward as generic message:received event
        this.dispatchEvent(new CustomEvent('message:received', {
          detail: { type, payload }
        }));
      });
    });
```

And in `sendCommand`'s ack handler (`:143-145`), add the same guard:

```js
      const handler = (envelope) => {
        if (envelope == null || envelope.data === undefined) {
          console.warn('OrchestratorClient: non-conforming gm:command:ack envelope');
        }
        const data = envelope?.data ?? envelope;
        if (data.action === action) {
```

**Step 4 — Run + expect PASS.**

```bash
cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/ALNScanner
npx jest tests/unit/network/orchestratorClient.test.js
```

Expected: PASS. (Existing forwarding tests that emit proper `{data:...}` envelopes do not trigger the warn.)

**Step 5 — Commit.**

```bash
git add ALNScanner/src/network/orchestratorClient.js ALNScanner/tests/unit/network/orchestratorClient.test.js
git commit -m "fix(gm-scanner): warn on non-conforming envelope unwrap fallback (WS-7)

Keep the envelope.data||envelope safety net but log when it triggers, so
contract drift surfaces as a clear warning instead of confusing
undefined-field behavior.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task P4d.9: Update AsyncAPI prose for audio:route:set to acknowledge specific sink names (AC-5)

**Files:**
- Modify: `backend/contracts/asyncapi.yaml:1429` — prose says `{stream: 'video'|'music'|'sound', sink: 'hdmi'|'bluetooth'}` but the scanner sends raw PipeWire sink names (e.g. `bluez_output.AA_BB_CC_DD_EE_FF.1`)
- Test: `backend/tests/contract/` (run from `backend/`)

**CONTRACT-FIRST:** This is a contract-prose-only change (no wire payload change). Confirmed `audioRoutingService.setStreamRoute(stream, sink)` (`backend/src/services/audioRoutingService.js:257-260`) accepts `'hdmi'`, `'bluetooth'`, OR a specific sink name — backend already tolerates what the scanner sends (`AudioController.setVideoOutput` passes the dropdown's raw `sink.name`). So the contract prose is wrong/under-specified, not the code. **Decision: update the contract prose** (cheaper and lower-risk than re-introducing alias normalization on the client, which would lose the ability to target a specific BT speaker among several). No scanner change.

> Sequencing note: per Contract-First, contract + backend land before any scanner change. Here there is NO scanner change — the scanner already sends sink names. This task only corrects the contract text.

**Step 1 — Write failing test.** The backend `tests/contract/scanner/request-schema-validation.test.js` validates scanner payloads against the contract. Add (or extend) a test asserting an `audio:route:set` payload with a specific sink name is accepted by the GmCommand schema. First read that test file to match its AJV + yaml-load harness, then add:

```js
  it('accepts audio:route:set with a specific PipeWire sink name (AC-5)', () => {
    const cmd = {
      event: 'gm:command',
      data: { action: 'audio:route:set', payload: { stream: 'video', sink: 'bluez_output.AA_BB_CC_DD_EE_FF.1' } },
      timestamp: new Date().toISOString(),
    };
    const validate = ajv.compile(gmCommandSchema);
    expect(validate(cmd)).toBe(true);
  });
```

Since the `payload` is `type: object` (not a strict sub-schema), this likely already validates — so the real deliverable is the prose. If the existing schema already passes the payload, make the failing test a **doc assertion** instead: assert the prose no longer claims only `'hdmi'|'bluetooth'`:

```js
  it('documents audio:route:set sink as hdmi|bluetooth|<sink-name> (AC-5)', () => {
    const text = fs.readFileSync(asyncapiPath, 'utf8');
    const line = text.split('\n').find(l => l.includes('`audio:route:set`'));
    expect(line).toMatch(/specific sink name|<sink-name>|PipeWire sink/);
  });
```

**Step 2 — Run + expect FAIL.**

```bash
cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/backend
npx jest tests/contract/scanner/request-schema-validation.test.js -t "audio:route:set"
```

Expected: FAIL — the prose line matches neither pattern (it still reads `sink: 'hdmi'|'bluetooth'`).

**Step 3 — Minimal implementation.** Edit `backend/contracts/asyncapi.yaml:1429`:

```yaml
        - `audio:route:set` — `{stream: 'video'|'music'|'sound', sink: 'hdmi'|'bluetooth'|<pipewire-sink-name>}`. The logical aliases `hdmi`/`bluetooth` resolve to the first matching sink; a specific PipeWire sink name (e.g. `bluez_output.AA_BB_CC_DD_EE_FF.1`) targets that exact device. The GM dropdown sends the specific sink name.
```

**Step 4 — Run + expect PASS.**

```bash
cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/backend
npx jest tests/contract/scanner/request-schema-validation.test.js
```

Expected: PASS.

**Step 5 — Commit.**

```bash
git add backend/contracts/asyncapi.yaml backend/tests/contract/scanner/request-schema-validation.test.js
git commit -m "docs(contract): audio:route:set sink accepts specific PipeWire names (AC-5)

Prose claimed only hdmi|bluetooth, but the GM dropdown sends specific sink
names and setStreamRoute() tolerates them (needed to target one BT speaker
among several). Contract-prose-only fix; no wire change.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task P4d.10: Add a GmCommand action-enum conformance test in the scanner (AC-4/P0 enabler)

**Files:**
- Create: `ALNScanner/tests/unit/admin/command-action-conformance.test.js`
- Reference contract: `backend/contracts/asyncapi.yaml:1456+` (GmCommand `action.enum`) — accessible from ALNScanner via `../backend/contracts/asyncapi.yaml`

This is the conformance test the review (AC-4) calls for: load the AsyncAPI `GmCommand` action enum and assert every action string the scanner's controllers emit is a member. It makes the dead `system:restart`/`system:clear` (P4d.11) a hard failure and prevents future drift. ALNScanner has no YAML parser dependency — read the enum with a small regex against the raw file (no new dependency) OR `require('node:fs')` + minimal parse. Keep it dependency-free.

**Step 1 — Write the test (expected to FAIL until P4d.11 removes the dead actions).**

```js
/**
 * Contract conformance: every gm:command action a controller emits must be
 * a member of the AsyncAPI GmCommand action enum. Guards against drift like
 * the dead system:restart / system:clear (AC-1/CC-6).
 */
import { describe, it, expect } from '@jest/globals';
import fs from 'node:fs';
import path from 'node:path';

// Extract the GmCommand action enum from the AsyncAPI contract (no yaml dep).
function loadActionEnum() {
  const file = path.resolve(__dirname, '../../../../backend/contracts/asyncapi.yaml');
  const text = fs.readFileSync(file, 'utf8');
  // Find the GmCommand action enum block: an "enum:" under an "action:" property
  // followed by "- value" lines. Scope to the gm:command publish message.
  const start = text.indexOf('action:\n');
  const enumIdx = text.indexOf('enum:', start);
  const after = text.slice(enumIdx + 'enum:'.length);
  const actions = [];
  for (const line of after.split('\n').slice(1)) {
    const m = line.match(/^\s+-\s+([a-z][a-z0-9:_-]+)\s*$/i);
    if (m) actions.push(m[1]);
    else if (line.trim() && !line.trim().startsWith('-')) break; // end of enum block
  }
  return new Set(actions);
}

// Action strings the scanner controllers emit (sendCommand 2nd arg).
const SCANNER_ACTIONS = [
  'session:create', 'session:addTeam', 'session:pause', 'session:resume',
  'session:end', 'session:start',
  'video:play', 'video:pause', 'video:stop', 'video:skip',
  'video:queue:add', 'video:queue:reorder', 'video:queue:clear',
  'display:idle-loop', 'display:scoreboard', 'display:return-to-video', 'display:status',
  'score:adjust', 'score:reset', 'transaction:delete',
  'system:reset',
  'bluetooth:scan:start', 'bluetooth:scan:stop', 'bluetooth:pair', 'bluetooth:unpair',
  'bluetooth:connect', 'bluetooth:disconnect',
  'audio:route:set', 'audio:volume:set',
  'lighting:scene:activate', 'lighting:scenes:refresh',
  'cue:fire', 'cue:stop', 'cue:pause', 'cue:resume', 'cue:enable', 'cue:disable',
  'service:check',
];

describe('gm:command action conformance (AC-4)', () => {
  const enumSet = loadActionEnum();

  it('parses a non-trivial action enum from the contract', () => {
    expect(enumSet.size).toBeGreaterThan(20);
    expect(enumSet.has('session:create')).toBe(true);
  });

  it.each(SCANNER_ACTIONS)('action "%s" is in the GmCommand enum', (action) => {
    expect(enumSet.has(action)).toBe(true);
  });

  it('does NOT reference the dead system:restart / system:clear actions', () => {
    expect(SCANNER_ACTIONS).not.toContain('system:restart');
    expect(SCANNER_ACTIONS).not.toContain('system:clear');
  });
});
```

> `service:check` IS in the enum (verify against the contract; `AdminOperations.checkService` sends it). If the contract lacks `service:check`, that is a separate finding — confirm before listing it. Run the parse-only test first to sanity-check the regex against the real file.

**Step 2 — Run + expect FAIL (or PASS for the list, then verify it would catch drift).**

```bash
cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/ALNScanner
npx jest tests/unit/admin/command-action-conformance.test.js
```

Expected: PASS for the curated `SCANNER_ACTIONS` list (all are in the enum) AND the parse-sanity test. This test's value is regression protection — to prove it catches drift, temporarily add `'system:restart'` to `SCANNER_ACTIONS` and confirm the `it.each` row FAILs with `expect(enumSet.has('system:restart')).toBe(true)` → received false; then remove it. (Document this manual RED check in the PR.)

**Step 3 — Implementation:** none beyond the test (this task adds the guard; P4d.11 removes the dead methods so no controller emits them).

**Step 4 — Run + expect PASS.**

```bash
cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/ALNScanner
npx jest tests/unit/admin/command-action-conformance.test.js
```

Expected: PASS.

**Step 5 — Commit.**

```bash
git add ALNScanner/tests/unit/admin/command-action-conformance.test.js
git commit -m "test(gm-scanner): conformance test for gm:command action enum (AC-4)

Loads the AsyncAPI GmCommand action enum and asserts every controller
action is a member — guards against drift like the dead
system:restart/system:clear and replaces the phantom always-success mock.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task P4d.11: Delete dead restartSystem()/clearData() and their tests (AC-1, CC-6)

**Files:**
- Modify: `ALNScanner/src/admin/AdminOperations.js:24-38` — delete `restartSystem()` and `clearData()` (emit `system:restart`/`system:clear`, which are NOT in the GmCommand enum → backend returns "Unknown action"); zero production callers (the real reset is the inline `system:reset` in `app.js`)
- Modify: `ALNScanner/tests/unit/admin/AdminOperations.test.js:21-46` — delete the `restartSystem`/`clearData` describe blocks (they lock in invalid actions via an always-success mock)
- Modify: `ALNScanner/tests/unit/admin/adminModule.test.js:249-282` — delete the two `it('should send system restart/clear command')` cases

Confirmed via grep: `restartSystem`/`clearData`/`system:restart`/`system:clear` appear ONLY in `AdminOperations.js` and these two test files — no production caller. Depends on P4d.10 (the conformance test exists so the enum is the authority).

**Step 1 — Write the failing assertion FIRST (TDD red): assert the methods are gone.** Add to `AdminOperations.test.js`:

```js
  describe('dead system actions removed (AC-1/CC-6)', () => {
    it('no longer exposes restartSystem()', () => {
      expect(typeof ops.restartSystem).toBe('undefined');
    });
    it('no longer exposes clearData()', () => {
      expect(typeof ops.clearData).toBe('undefined');
    });
  });
```

**Step 2 — Run + expect FAIL.**

```bash
cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/ALNScanner
npx jest tests/unit/admin/AdminOperations.test.js -t "dead system actions"
```

Expected: FAIL — `restartSystem`/`clearData` are still functions (`typeof` is `'function'`).

**Step 3 — Minimal implementation.** Delete the two methods from `AdminOperations.js` (lines 24-38, including the JSDoc), leaving `resetScores()` as the first method. Also update the class JSDoc (line 9: "GM restarts system or clears data (emergency operations)") to remove that bullet. Then remove the now-obsolete tests:
- In `AdminOperations.test.js`, delete the `describe('restartSystem', ...)` and `describe('clearData', ...)` blocks (lines 21-46).
- In `adminModule.test.js`, delete the two `it(...)` cases at lines 250-282.

**Step 4 — Run + expect PASS.**

```bash
cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/ALNScanner
npx jest tests/unit/admin/AdminOperations.test.js tests/unit/admin/adminModule.test.js tests/unit/admin/command-action-conformance.test.js
```

Expected: PASS — dead-action tests gone, the "dead system actions removed" assertions pass, the conformance test (P4d.10) passes.

**Step 5 — Commit.**

```bash
git add ALNScanner/src/admin/AdminOperations.js ALNScanner/tests/unit/admin/AdminOperations.test.js ALNScanner/tests/unit/admin/adminModule.test.js
git commit -m "refactor(gm-scanner): delete dead restartSystem/clearData (AC-1, CC-6)

system:restart / system:clear are not in the GmCommand enum (backend
returns 'Unknown action') and had zero callers — the real reset is the
inline system:reset in app.js. Removes the phantom-mock tests that
cemented the invalid action names.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task P4d.12: Serialize same-action gm:commands client-side (WS-6 interim)

**Files:**
- Modify: `ALNScanner/src/network/orchestratorClient.js:132-168` (`sendCommand`)
- Test: `ALNScanner/tests/unit/network/orchestratorClient.test.js`

`sendCommand` correlates acks only by `action` name (line 145). Two in-flight commands with the same action (e.g. rapid `session:addTeam` during churn) resolve in arrival order, so callers can receive each other's `success`/`message`. The full fix is a per-command `requestId` echoed in the ack — a coordinated contract change across asyncapi (`GmCommand`/`GmCommandAck` at lines 1456 & 1592), backend `commandExecutor.js`/`adminEvents.js`, AND the scanner. That is out of scope for this renderer/misc phase. **Decision: implement the interim client-side serialization** — queue a same-action command behind any in-flight one so acks can't cross-resolve. Defer the requestId contract change (see crossDeps).

**Step 1 — Write failing test.** Add to `orchestratorClient.test.js`:

```js
  describe('sendCommand same-action serialization (WS-6 interim)', () => {
    it('does not resolve a second same-action command on the first ack', async () => {
      const p = client.connect('token', { deviceId: 'TEST', deviceType: 'gm' });
      mockSocket._simulateConnect();
      await p;

      const r1 = client.sendCommand('session:addTeam', { teamId: 'A' });
      const r2 = client.sendCommand('session:addTeam', { teamId: 'B' });

      // First ack arrives — must resolve r1 only, not r2.
      mockSocket._simulateMessage('gm:command:ack', { data: { action: 'session:addTeam', success: true, message: 'A added' } });

      await expect(r1).resolves.toEqual({ success: true, message: 'A added' });

      // r2 still pending until its own ack
      let r2Settled = false;
      r2.then(() => { r2Settled = true; });
      await Promise.resolve();
      expect(r2Settled).toBe(false);

      mockSocket._simulateMessage('gm:command:ack', { data: { action: 'session:addTeam', success: true, message: 'B added' } });
      await expect(r2).resolves.toEqual({ success: true, message: 'B added' });
    });
  });
```

> HARNESS NOTE (verified): use `mockSocket._simulateMessage('gm:command:ack', {data:{...}})` to fire the ack handler. The mock's `emit('gm:command', ...)` is a plain `jest.fn()` and does NOT auto-ack, so the second same-action send genuinely stays pending until its `_simulateMessage` ack — but ONLY because the serialization fix below defers registering r2's handler until r1 settles. Without the fix, both handlers are registered up front and the first ack resolves both.

**Step 2 — Run + expect FAIL.**

```bash
cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/ALNScanner
npx jest tests/unit/network/orchestratorClient.test.js -t "same-action serialization"
```

Expected: FAIL — with the current code, BOTH handlers match `action==='session:addTeam'` on the first ack; `r2` resolves early (gets "A added") so `r2Settled` becomes true and/or `r2` resolves with the wrong message.

**Step 3 — Minimal implementation.** Add a per-action in-flight chain so same-action commands run sequentially. Edit `orchestratorClient.js` — add `this._actionChains = {};` in the constructor (after line 33), then wrap `sendCommand`'s body:

```js
  async sendCommand(action, payload = {}, timeout = 5000) {
    if (!this.socket?.connected) {
      throw new Error('Socket not connected');
    }

    // Serialize same-action commands: a second send for the same action waits
    // for the prior one to settle, so by-action ack correlation can't cross-resolve.
    const prior = this._actionChains[action] || Promise.resolve();
    const run = prior.catch(() => {}).then(() => this._sendCommandOnce(action, payload, timeout));
    // Keep the chain alive regardless of outcome; clear when this is the tail.
    this._actionChains[action] = run.catch(() => {}).finally(() => {
      if (this._actionChains[action] === chainRef) this._actionChains[action] = null;
    });
    const chainRef = this._actionChains[action];
    return run;
  }

  _sendCommandOnce(action, payload, timeout) {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        cleanup();
        reject(new Error(`Command ${action} timed out`));
      }, timeout);

      const handler = (envelope) => {
        if (envelope == null || envelope.data === undefined) {
          console.warn('OrchestratorClient: non-conforming gm:command:ack envelope');
        }
        const data = envelope?.data ?? envelope;
        if (data.action === action) {
          cleanup();
          resolve({ success: data.success, message: data.message || '' });
        }
      };

      const cleanup = () => {
        clearTimeout(timeoutId);
        this.socket.off('gm:command:ack', handler);
      };

      this.socket.on('gm:command:ack', handler);
      this.socket.emit('gm:command', {
        event: 'gm:command',
        data: { action, payload },
        timestamp: new Date().toISOString(),
      });
    });
  }
```

> This merges the WS-7 ack-envelope warn (P4d.8) into `_sendCommandOnce`. If P4d.8 already edited the inline handler, move that logic here. The `chainRef` self-clear avoids unbounded chain growth.

**Step 4 — Run + expect PASS.**

```bash
cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/ALNScanner
npx jest tests/unit/network/orchestratorClient.test.js
```

Expected: PASS — serialization test green; existing single-command `sendCommand` tests unaffected (a lone command's `prior` is a resolved promise).

**Step 5 — Commit.**

```bash
git add ALNScanner/src/network/orchestratorClient.js ALNScanner/tests/unit/network/orchestratorClient.test.js
git commit -m "fix(gm-scanner): serialize same-action gm:commands (WS-6 interim)

Acks correlate only by action name, so rapid same-action commands could
cross-resolve during reconnect churn. Chain same-action sends so each
waits for the prior to settle. Full requestId correlation deferred to a
coordinated contract change.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

# Execution & Verification

**Per-task:** follow the RED → GREEN → COMMIT loop in each task. Never skip the "run and confirm it fails" step — that's what proves the test is real.

**Per-phase:** after a phase, run the affected component's full suite and coverage ratchet:
- `cd ALNScanner && npm test && npm run coverage:check`
- `cd backend && npm test && npm run coverage:check`

**Before merge to `main`:**
1. `cd ALNScanner && npm run build` (refresh `dist/` so the symlinked `backend/public/gm-scanner` serves current code).
2. Backend integration: `cd backend && npm run test:integration`.
3. E2E (rebuild first): `cd backend && npm run test:e2e` and `cd ALNScanner && npm run test:e2e`.
4. Confirm the Phase-0 RED tests are now GREEN (P0.2 after P4d; P0.4 after the contract reconciliation; P0.5 after P1b).

**Contract changes** (P2.1, P4a.3/.5/.7) must be reflected in `backend/contracts/*.yaml` AND backed by a backend contract test, committed before the scanner consumer.

**Suggested commit/PR grouping:** one PR per phase (Phase 1 may split into 1a/1b/1c), so reviewers can reason about the churn fix, the durability fix, and the long tail independently.
