# Container Baseline — ALN-Ecosystem

Branch `claude/nice-curie-hescfv`, commit `e87f8c5fbebc6a8a0bad3f6fb27b26186e139971`.
All commands run under `/home/user/ALN-Ecosystem/`. Nothing in the git tree was
modified by this run (`git status --porcelain` was empty before and after).

## 1. Workspace state

- `git status --porcelain`: empty (clean tree). Exit 0.
- HEAD: `e87f8c5fbebc6a8a0bad3f6fb27b26186e139971` — "chore(claude): declare mattpocock-skills plugin - process.md depends on it [skip ci]"
- Branch: `claude/nice-curie-hescfv` (matches brief).
- `git submodule status --recursive`: exit 0.
  ```
   d9e37bea2a654f78eb6d52914578a118217407ae ALN-TokenData (remotes/origin/HEAD)
   5653a3e5dc07a8604bdf0913dec475db8d983c66 ALNScanner (music-cutover-2026-05-20-174-g5653a3e)
   5e71c865d9dc155bf089bd243cba0ca5ea00f2c3 ALNScanner/data (remotes/origin/claude/phase3-train-fixes)
   e0bf2992c4af19780655d452ead5bafa16b0ee0d aln-memory-scanner (remotes/origin/HEAD)
   15d8d2e300873027ce8cf2a778887ba01d8dee8e aln-memory-scanner/data (remotes/origin/feature/dry-scoring-config-7-g15d8d2e)
   f81aba5737baf9e3697403c29eb0902ef12287fc arduino-cyd-player-scanner (remotes/origin/HEAD)
  ```
  No `-` (uninitialized) or `+` (out-of-sync-with-index) prefixes — all submodules initialized and checked out at the recorded commit. `ALNScanner/data` and `aln-memory-scanner/data` are on non-default branches (`claude/phase3-train-fixes`, `feature/dry-scoring-config-7-g15d8d2e`) — noted, not corrected (out of scope; workspace-state read-only check).
- `node_modules` presence: `backend` PRESENT, `ALNScanner` PRESENT, `aln-memory-scanner` PRESENT, `config-tool` PRESENT.
- `ALNScanner/dist/index.html`: PRESENT. No rebuild needed/performed.

## 2. Fast suites

### backend

| Command | Exit | Duration | Result |
|---|---|---|---|
| `npm test -- --coverage` | 0 | 109s (Jest-reported: 107.733s) | Test Suites: 145 passed, 145 total. Tests: 2868 passed, 2868 total. |
| `npm run coverage:check` | 0 | <1s | "✓ All 85 files meet coverage thresholds" |
| `npm run lint` | 0 | 10s | `eslint . --quiet` — no output (clean) |

No failures. `LEGACY SHIM`/`LEGACY MODE`/`drift` line count in the unit+contract log: **25** (all are test names / expected log lines from drift-tripwire and legacy-shim-path tests, e.g. "DRIFT TRIPWIRE: the baked legacy tables mirror the real ALN game.json scoring block", "LEGACY MODE TABLE ACTIVE (debt ledger L6): the active pack ships no game.json modes block..." — this is the parent repo's own test suite exercising `backend/src/services/packService.js`'s baked-shim fallback path against a packless/scoring-absent test pack, not a runtime warning about this container's own active pack). Full list saved at `/tmp/backend_drift_lines.txt`.

### ALNScanner

| Command | Exit | Duration | Result |
|---|---|---|---|
| `npm test -- --coverage` | 0 | 36s (Jest-reported: 34.215s) | Test Suites: 87 passed, 87 total. Tests: 1681 passed, 1681 total. |
| `npm run coverage:check` | 0 | <1s | "✓ All 66 files meet coverage thresholds" |
| `npm run lint` | 0 | 2s | `eslint .` — no output (clean) |

No failures. `LEGACY SHIM`/`LEGACY MODE`/`drift` line count: **51** — same pattern as backend: these are the scanner's own vendored-shim/drift-tripwire unit tests exercising `src/core/scoring.js`'s and the modes-loader's baked-fallback path (`[modes] LEGACY SHIM ACTIVE (debt ledger L6)...`, `[scoring] LEGACY SHIM ACTIVE: pack has no usable game.json scoring block...`, "DRIFT TRIPWIRE" assertions), console.warn output captured by the tests that intentionally trigger the shim, not evidence of the shim being live against a real pack. Full list saved at `/tmp/alnscanner_drift_lines.txt`.

### aln-memory-scanner

| Command | Exit | Duration | Result |
|---|---|---|---|
| `npm test` | 0 | 2s (Jest-reported: 1.479s) | Test Suites: 4 passed, 4 total. Tests: 165 passed, 165 total. |

No failures. No `LEGACY SHIM`/`LEGACY MODE`/`drift` lines in this suite's output.

### config-tool

| Command | Exit | Duration | Result |
|---|---|---|---|
| `npm test` | **1** | 2s (reported: 1283.779628 ms) | tests 172, suites 35, pass 168, **fail 1**, **cancelled 3**, skipped 0, todo 0 |
| `npm run lint` | 0 | 1s | `eslint .` — no output (clean) |

**FAILURE — first 40 lines verbatim (draftBar suite, hook failure cascading to 3 cancelled subtests):**
```
# Subtest: draftBar
    # Subtest: renders the draft identity (id + base hash prefix) with Publish and Discard
    not ok 1 - renders the draft identity (id + base hash prefix) with Publish and Discard
      ---
      duration_ms: 0
      type: 'test'
      location: '/home/user/ALN-Ecosystem/config-tool/tests/draftBar.test.js:31:3'
      failureType: 'cancelledByParent'
      error: 'test did not finish before its parent and was cancelled'
      code: 'ERR_TEST_FAILURE'
      ...
    # Subtest: clicking Publish / Discard fires the handlers
    not ok 2 - clicking Publish / Discard fires the handlers
      ---
      duration_ms: 0
      type: 'test'
      location: '/home/user/ALN-Ecosystem/config-tool/tests/draftBar.test.js:40:3'
      failureType: 'cancelledByParent'
      error: 'test did not finish before its parent and was cancelled'
      code: 'ERR_TEST_FAILURE'
      ...
    # Subtest: renders empty when there is no draft
    not ok 3 - renders empty when there is no draft
      ---
      duration_ms: 0
      type: 'test'
      location: '/home/user/ALN-Ecosystem/config-tool/tests/draftBar.test.js:51:3'
      failureType: 'cancelledByParent'
      error: 'test did not finish before its parent and was cancelled'
      code: 'ERR_TEST_FAILURE'
      ...
    1..3
not ok 6 - draftBar
  ---
  duration_ms: 0.221003
  type: 'suite'
  location: '/home/user/ALN-Ecosystem/config-tool/tests/draftBar.test.js:23:1'
  failureType: 'hookFailed'
  error: |-
    Cannot find module 'jsdom'
    Require stack:
    - /home/user/ALN-Ecosystem/config-tool/tests/draftBar.test.js
```

**Second failure — `toolAuth.test.js` (counted as the "fail 1" in the tally; draftBar's 3 subtests above account for "cancelled 3"; the draftBar suite-level failure itself is a `type: 'suite'` entry and isn't counted in the "tests" tally):**
```
# node:internal/modules/cjs/loader:1386
#   throw err;
#   ^
# Error: Cannot find module 'jsonwebtoken'
# Require stack:
# - /home/user/ALN-Ecosystem/config-tool/tests/toolAuth.test.js
#     at Function._resolveFilename (node:internal/modules/cjs/loader:1383:15)
#     at defaultResolveImpl (node:internal/modules/cjs/loader:1025:19)
#     at resolveForCJSWithHooks (node:internal/modules/cjs/loader:1030:22)
#     at Function._load (node:internal/modules/cjs/loader:1192:37)
#     at TracingChannel.traceSync (node:diagnostics_channel:328:14)
#     at wrapModuleLoad (node:internal/modules/cjs/loader:237:24)
#     at Module.require (node:internal/modules/cjs/loader:1463:12)
#     at require (node:internal/modules/helpers:147:16)
#     at Object.<anonymous> (/home/user/ALN-Ecosystem/config-tool/tests/toolAuth.test.js:22:13)
#     at Module._compile (node:internal/modules/cjs/loader:1705:14) {
#   code: 'MODULE_NOT_FOUND',
#   requireStack: [ '/home/user/ALN-Ecosystem/config-tool/tests/toolAuth.test.js' ]
# }
# Node.js v22.22.2
# Subtest: tests/toolAuth.test.js
not ok 15 - tests/toolAuth.test.js
  ---
  duration_ms: 60.067728
  type: 'test'
  location: '/home/user/ALN-Ecosystem/config-tool/tests/toolAuth.test.js:1:1'
  failureType: 'testCodeFailure'
  exitCode: 1
  signal: ~
  error: 'test failed'
  code: 'ERR_TEST_FAILURE'
```

**Root cause (confirmed, not fixed):** `config-tool/package.json` declares `jsonwebtoken` (dependency) and `jsdom` (devDependency), but neither is present under `config-tool/node_modules` (187 packages present, including `express`, `multer`, `supertest`, `eslint`, but not `jsonwebtoken` or `jsdom`) — an incomplete `npm install` for this component. This is a pre-existing environment gap in the container, left untouched per the brief (tree must stay unchanged).

No `LEGACY SHIM`/`LEGACY MODE`/`drift` lines in this suite's output.

### Python scripts suite (`scripts/`)

A pytest suite exists: `scripts/tests/` (`conftest.py` + 5 test files: `test_sync_notion_to_tokens.py`, `test_sync_pipeline.py`, `test_sync_groups.py`, `test_build_pack_manifest.py`, `test_generate_asset_manifest.py`).

| Command | Exit | Duration | Result |
|---|---|---|---|
| `pytest` (from `scripts/`) | **2** | <1s | collected 18 items / 3 errors → "Interrupted: 3 errors during collection" — **0 tests actually ran** |

**Failure, verbatim (one of three identical-cause collection errors):**
```
============================= test session starts ==============================
platform linux -- Python 3.11.15, pytest-9.0.2, pluggy-1.6.0
rootdir: /home/user/ALN-Ecosystem/scripts
collected 18 items / 3 errors

==================================== ERRORS ====================================
__________________ ERROR collecting tests/test_sync_groups.py __________________
ImportError while importing test module '/home/user/ALN-Ecosystem/scripts/tests/test_sync_groups.py'.
Hint: make sure your test modules/packages have valid Python names.
Traceback:
/usr/lib/python3.11/importlib/__init__.py:126: in import_module
    return _bootstrap._gcd_import(name[level:], package, level)
           ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
tests/test_sync_groups.py:10: in <module>
    from sync_notion_to_tokens import (  # noqa: E402
sync_notion_to_tokens.py:26: in <module>
    import requests
E   ModuleNotFoundError: No module named 'requests'
_____________ ERROR collecting tests/test_sync_notion_to_tokens.py _____________
ImportError while importing test module '/home/user/ALN-Ecosystem/scripts/tests/test_sync_notion_to_tokens.py'.
[... same ModuleNotFoundError: No module named 'requests' ...]
_________________ ERROR collecting tests/test_sync_pipeline.py _________________
ImportError while importing test module '/home/user/ALN-Ecosystem/scripts/tests/test_sync_pipeline.py'.
[... same ModuleNotFoundError: No module named 'requests' ...]
=========================== short test summary info ============================
ERROR tests/test_sync_groups.py
ERROR tests/test_sync_notion_to_tokens.py
ERROR tests/test_sync_pipeline.py
!!!!!!!!!!!!!!!!!!! Interrupted: 3 errors during collection !!!!!!!!!!!!!!!!!!!!
============================== 3 errors in 0.20s ===============================
```

**Root cause (confirmed, not fixed):** the `pytest` binary on PATH (`/root/.local/bin/pytest`) is a `uv tool`-installed isolated environment (`#!/root/.local/share/uv/tools/pytest/bin/python`) that has neither `requests` nor the other `scripts/requirements.txt` deps installed. The main interpreter (`/usr/local/bin/python3`) DOES have `requests` (2.33.1) installed but has no `pytest` module at all (`python3 -c "import pytest"` → `ModuleNotFoundError`). No single Python environment in this container has both `pytest` and `requests`/`Pillow`/`python-dotenv`, so the scripts suite cannot run as-is. (For contrast: `.github/workflows/test.yml`'s `scripts-tests` job installs `-r scripts/requirements.txt pytest` into one environment, so this gap is container-specific, not present in real CI.)

### ESP32 (arduino-cyd-player-scanner)

`pio` is **absent** from PATH (`which pio` → exit 1). Per brief instruction, recording "pio absent" — `pio test -e native` was not run.

## 3. Integration suite

`cd backend && npm run test:integration` (`jest --config jest.integration.config.js --runInBand`).

| Command | Exit | Duration | Result |
|---|---|---|---|
| `npm run test:integration` | 0 | 246s (Jest-reported: 245.86s) | Test Suites: 37 passed, 37 total. Tests: 348 passed, 348 total. |

No failures. Notable non-fatal log noise during the run (expected, given the toolchain gaps in §4): `[DisplayDriver] Browser process error ... spawn chromium-browser ENOENT` recurs repeatedly (no headless Chromium binary in this container; the scoreboard-kiosk launch path degrades gracefully and tests still pass).

`LEGACY SHIM`/`LEGACY MODE`/`drift` line count: **14**, saved to `/tmp/backend_integration_drift_lines.txt` — same pattern as §2/§6: all are the `[modes] LEGACY SHIM ACTIVE (debt ledger L6): the loaded pack ships no game.json modes block...` console output from tests that deliberately load a modes-absent pack, not evidence of the container's real pack running degraded.

## 4. Toolchain probe

`which` results:

| Tool | Status | Path |
|---|---|---|
| cvlc | ABSENT | — |
| vlc | ABSENT | — |
| mpd | ABSENT | — |
| mpc | ABSENT | — |
| pactl | ABSENT | — |
| pw-play | ABSENT | — |
| pipewire | ABSENT | — |
| wireplumber | ABSENT | — |
| dbus-daemon | PRESENT | `/usr/bin/dbus-daemon` |
| dbus-send | PRESENT | `/usr/bin/dbus-send` |
| dbus-monitor | PRESENT | `/usr/bin/dbus-monitor` |
| Xvfb | PRESENT | `/usr/bin/Xvfb` |
| docker | PRESENT (binary) | `/usr/bin/docker` |
| bluetoothctl | ABSENT | — |
| xdotool | ABSENT | — |
| wmctrl | ABSENT | — |
| python3 | PRESENT | `/usr/local/bin/python3` |
| pio | ABSENT | — |

`python3 -c "import dbusmock"` → `ModuleNotFoundError: No module named 'dbusmock'` — **ABSENT**.

**`backend/tests/rung1/probe.sh` and `up.sh` — read first, per instruction:**
- `probe.sh` is read-only: it runs `docker info`, `pactl info` (against `$RUNG1_DIR/xdg` as a scratch `XDG_RUNTIME_DIR`, no daemon launch), `mpc status` against a socket path (fails harmlessly if absent), a single `dbus-send` query against a scratch session-bus address, two `curl` probes against `127.0.0.1:8123`, and (only if `btvirt` is on PATH, which it is not here) `timeout 5 btvirt -l1`. It starts no daemon and stops nothing — confirmed safe to run, and it was run.
- `up.sh` clearly **starts** things (creates a `rung1vlc` system user, sweeps stale `/tmp/aln-*` artifacts, launches `provision.js` which brings up a session D-Bus, Xvfb, pipewire null sinks, dockerized Home Assistant, and a Bluetooth mock) — **not run**, per instruction ("run `probe.sh` only if it starts nothing and stops nothing; otherwise record what it would probe"). What it would have set up: the shared "rung-1" harness arms (D-Bus session bus, `XDG_RUNTIME_DIR`, Xvfb display, PipeWire null sinks, a Home Assistant Docker container, and — if `btvirt`/`dbusmock` are available — a mocked Bluetooth controller), writing `env.sh` for a subsequently-booted engine (`engine.sh start`) to source.

**`probe.sh` output (run; writes only to `/tmp/rung1/runner-manifest.json`, outside the repo tree):**
```json
{
  "runner": "6.18.44-fc-v24",
  "capabilities": {
    "docker": {"ok": false, "reason": "daemon unreachable"},
    "pipewire": {"ok": false, "reason": "pactl cannot reach a pipewire session"},
    "mpd": {"ok": false, "reason": "engine-owned: engine self-hosts mpd on /tmp/aln-mpd.sock (engine not running?)"},
    "vlc": {"ok": false, "reason": "engine-owned: engine self-hosts cvlc on the shared bus (engine not running?)"},
    "ha": {"ok": false, "reason": "no HTTP on :8123"},
    "btvirt": {"ok": false, "reason": "btvirt not installed (package: bluez-test-tools)"},
    "dbusmock": {"ok": false, "reason": "python-dbusmock not importable"}
  }
}
```
Exit 0. All 7 rung-1 capabilities are `false` in this container — consistent with the per-tool `which` results above (no pipewire/vlc/mpd binaries, no docker daemon, no HA, no btvirt/dbusmock).

## 5. CI workflows

### `.github/workflows/test.yml`

- **Triggers:** `push` (branches `[main]`), `pull_request` (branches `[main]`), `workflow_dispatch`.
- **Concurrency:** group `test-${{ github.ref }}`, `cancel-in-progress: true`.
- **Jobs:**
  | Job | Timeout | Notes |
  |---|---|---|
  | `backend-unit-contract` | 10 min | checkout (submodules recursive) → Node 22 → install `pulseaudio-utils` (pactl) → `npm ci` (backend) → `npm run lint` → `npm test -- --coverage --maxWorkers=2` → `npm run coverage:check` |
  | `backend-integration` | 15 min | same setup + `npm run test:integration` |
  | `scanner-tests` | 20 min | single serial job: ALNScanner `npm ci && npm test -- --coverage` + `coverage:check`; PWA `npm ci && npm test`; backend `npm ci` (only, for the cue-vocabulary linkage test used by config-tool); config-tool `npm ci && npm test` + `npm run lint`. Comment notes worst observed ~14 min. |
  | `esp32-tests` | 5 min | Python 3.11 → `pip install platformio` → `pio test -e native` |
  | `scripts-tests` | 5 min | checkout submodules recursive (needed for `ALN-TokenData/pack-manifest.json`) → Python 3.11 (pip cache keyed on `scripts/requirements.txt`) → `pip install -r scripts/requirements.txt pytest` (single env, unlike this container) → `python3 -m pytest tests/ -v` in `scripts/` |
  | `backend-e2e-tier-l` | 30 min | **matrix:** `pack: [production, toy-heist]`, `fail-fast: false`. checkout → Node 22 (cache keyed on backend+ALNScanner lockfiles) → backend `npm ci` → `npx playwright install chromium --with-deps` → ALNScanner `npm ci && npm run build` (dist rebuild for the `backend/public/gm-scanner` symlink) → install rung-1 stack (`vlc-bin vlc-plugin-base dbus xvfb xdotool pipewire pipewire-pulse wireplumber pulseaudio-utils bluez python3-dbusmock python3-dbus`) → `npm run test:e2e:tier-l` with `E2E_PACK_PATH` set to `tests/e2e/fixtures/packs/toy-heist` for the `toy-heist` leg, empty/unset (defaults to production `ALN-TokenData`) for the `production` leg → on failure, upload the Playwright report artifact. |
  | `summary` | — | `needs` all six jobs above; `if: always() && !cancelled()`; fails loudly (named per-job) if any needed job's result isn't `success`. |

  **`E2E_PACK_PATH` usage:** exactly one place — the `backend-e2e-tier-l` job's matrix-driven `env:` on the "Run Tier L E2E" step (line ~288).
  **`E2E_PROFILE_PATH` usage:** none in `test.yml` (no CI job overrides the profile; the E2E harness's own default applies).

### `.github/workflows/rung1.yml`

- **Triggers:** `workflow_dispatch`; `push` on paths `backend/tests/rung1/**` and `.github/workflows/rung1.yml` (self-scoped — `workflow_dispatch` only registers once merged to default branch, so push-on-self-path is the practical trigger pre-merge).
- **Concurrency:** group `rung1-${{ github.ref }}`, `cancel-in-progress: true`.
- **Jobs:** single job `rung1` (**timeout 20 min**), no matrix. Steps: checkout (submodules recursive) → Node 22 → backend `npm ci` → install rung-1 stack (`vlc-bin vlc-plugin-base mpd mpc pipewire pipewire-pulse wireplumber pulseaudio-utils xvfb xdotool wmctrl dbus python3-dbusmock bluez-test-tools`, then stop the runner's own system `mpd`/`mpd.socket`) → bring up harness as root with `RUNG1_USER=runner` (`up.sh`) → capability probe (`probe.sh`) → boot engine non-root (`engine.sh start`) → live-flow audit (`audit-flows.js`, "13 assertions, zero mocks") → on failure, dump `runner-manifest.json` + engine/arm logs → teardown (`down.sh`) always.
- **`E2E_PACK_PATH` / `E2E_PROFILE_PATH`:** neither referenced.

### `.github/workflows/capability-probe.yml`

- **Triggers:** `workflow_dispatch`; `push` on path `.github/workflows/capability-probe.yml` only (self-scoped, same rationale as rung1.yml).
- **Concurrency:** none declared.
- **Jobs:** single job `virtual-bluetooth` (**timeout 10 min**), no matrix. Steps (every step tolerates failure by design — "the log is the deliverable"): kernel/`hci_vhci` modprobe + `/dev/vhci` check → install `linux-modules-extra-$(uname -r)` and retry modprobe → install `bluez`/`bluez-test-tools` → launch `btvirt -l2` in background → start `bluetoothd`, list adapters (`bluetoothctl list`, `btmgmt info`, each `timeout`-bounded) → power-on/scan test via piped `bluetoothctl` commands.
- **`E2E_PACK_PATH` / `E2E_PROFILE_PATH`:** neither referenced.

### Do the E2E helpers honor `E2E_PACK_PATH` / `E2E_PROFILE_PATH`?

**Yes, for `backend/tests/e2e`** — both env vars are read as defaults, with an explicit caller-supplied value always winning:

```
$ grep -n "E2E_PACK_PATH\|E2E_PROFILE_PATH" backend/tests/e2e/setup/test-server.js
122: *   defaults from E2E_PACK_PATH, explicit caller value WINS (dual-pack gate).
124: *   (PROFILE_PATH); defaults from E2E_PROFILE_PATH, caller wins — always
141:    // inherit E2E_PACK_PATH, so one env var re-runs the whole suite
145:    packPath = process.env.E2E_PACK_PATH || null,
150:    profilePath = process.env.E2E_PROFILE_PATH || null

$ grep -n "E2E_PROFILE_PATH" backend/tests/e2e/setup/session-env.js
129:  const explicit = profilePath || process.env.E2E_PROFILE_PATH || null;
```

**No, for `backend/tests/rung1/provision.js`** — it does not reference either `E2E_`-prefixed variable at all; it takes pack directories via a `--pack <dir>` CLI flag instead (invoked by `up.sh` as `node provision.js ... --pack "$PACK_DIR"`, where `PACK_DIR` itself defaults to the repo's `ALN-TokenData` or a CLI positional arg to `up.sh`, not an env var):

```
$ grep -n "E2E_PACK_PATH\|E2E_PROFILE_PATH\|PACK_PATH\|PROFILE_PATH" backend/tests/rung1/provision.js
(no matches)

$ grep -n "PACK_PATH\|PROFILE_PATH\|--pack\b" backend/tests/rung1/provision.js
750://   node provision.js --rung1-dir /tmp/rung1 --pack <dir> [--pack <dir>]
761:    argv.forEach((a, i) => { if (a === '--pack') packs.push(argv[i + 1]); });
```

The rung-1 harness's *engine* (as opposed to the harness provisioner) does read plain `PACK_PATH`/`PROFILE_PATH` (no `E2E_` prefix) — see `up.sh`'s generated `env.sh` (`export PACK_PATH="$PACK_DIR"`, `export PROFILE_PATH="$RUNG1/simulation-profile.json"`) — but that is a different, non-`E2E_`-prefixed variable pair consumed by the orchestrator server itself, not by the E2E/rung1 test harness code the brief asked about.

## 6. Summary of drift/legacy-shim log lines

Full grep hits (`-n -i "LEGACY SHIM\|LEGACY MODE\|drift"`) saved to:
- `/tmp/backend_drift_lines.txt` (25 lines, backend unit+contract log)
- `/tmp/alnscanner_drift_lines.txt` (51 lines, ALNScanner unit log)

Both sets are exclusively test names and console output belonging to the pack's own drift-tripwire / legacy-shim unit tests (deliberately exercising the packless/scoring-absent fallback code paths in `packService.js`, `ALNScanner/src/core/scoring.js`, and the modes loader) — none indicate the container's actual active pack is running in legacy/shim mode.

## 6b. Post-brief environment fixes (same day; the brief forbade changes, the session applied them after)

- config-tool: `npm ci` restored the missing `jsonwebtoken` and `jsdom`
  packages (the session-start hook now re-runs `npm ci` when
  `package-lock.json` is newer than `node_modules/.package-lock.json`).
  Re-run fresh after the compaction: `npm test` → tests 182, pass 182,
  fail 0.
- scripts: `pip install -r scripts/requirements.txt pytest`. Re-run
  fresh after the compaction: `python3 -m pytest -q` → 76 passed.
- Record provenance: the brief for this run is
  `briefs/2026-09-12-container-baseline.md`; this file is the RESULT
  (moved from the session scratchpad at checkpoint 1 per process rule
  7b — it had been left there).


## 7. Addendum (checkpoint 1, owner-directed): the rung-1 rig is provisioned in this container

Owner asked for the tools to be installed. Done 2026-09-12, recipe =
`.github/workflows/rung1.yml` + `bluez` (for `bluetoothctl`):

```
apt-get install -y vlc-bin vlc-plugin-base mpd mpc pipewire pipewire-pulse \
  wireplumber pulseaudio-utils xvfb xdotool wmctrl dbus python3-dbusmock \
  bluez bluez-test-tools
bash backend/tests/rung1/up.sh        # dockerd, witness HA (pulled through the proxy), bus, Xvfb, pipewire, BT mock
bash backend/tests/rung1/probe.sh
bash backend/tests/rung1/engine.sh start && node backend/tests/rung1/audit-flows.js
```

Result: `up.sh` exit 0, all five shared arms up (bus, display,
pulseServer, ha, bt=mock). Live-flow audit **13/13 PASS** (real VLC
played `kai001.mp4`, real pw-play on the null sink, engine-spawned MPD,
HA witness register one-hot through both standing cues). Engine stopped
afterwards; the harness arms and the HA container stay up for the Tier L
legs. Probe manifest: docker ok, ha ok, dbusmock ok (python3.12), btvirt
NOT ok (`/dev/vhci` container wall — expected; the dbusmock arm is the
ceiling here as in hosted CI), pipewire reported NOT ok **as root only**:
the probe runs `pactl` as root while the arm runs as `rung1vlc`; as the
harness user `pactl info` answers (PipeWire 1.0.5, sinks `rung1_hdmi`,
`rung1_bt`). A root-only false negative of the probe, not of the arm.

A container restart loses all of this (packages, dockerd, the HA image,
`/tmp/rung1`); re-run the recipe above. `pio` is still absent (ESP32
native tests remain unrun in this container).
