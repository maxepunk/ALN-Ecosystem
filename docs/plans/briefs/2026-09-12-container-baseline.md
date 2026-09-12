# Brief: container baseline before the Block 2/3 build

You establish this container's green baseline before any code changes. Everything you run leaves the tree unchanged; the only file you write is your output file. Work only under `/home/user/ALN-Ecosystem/` (parent repo, branch `claude/nice-curie-hescfv` at commit `e87f8c5`).

## Steps

Read every exit code directly from the command; a pipe into `tail` or `head` hides it.

1. **Workspace state.** `git status --porcelain` (expect empty) and the HEAD commit; `git submodule status --recursive`; `node_modules` present in `backend`, `ALNScanner`, `aln-memory-scanner`, `config-tool`; `ALNScanner/dist/index.html` present (if absent: `cd ALNScanner && npm run build`, and record that you did).
2. **Fast suites.** In this order, recording pass/fail counts, duration and exit code for each: `backend`: `npm test -- --coverage`, `npm run coverage:check`, `npm run lint`. `ALNScanner`: `npm test -- --coverage`, `npm run coverage:check`, `npm run lint`. `aln-memory-scanner`: `npm test`. `config-tool`: `npm test`, `npm run lint`. If a Python test suite exists under `scripts/` (look for `pytest` config or a `tests` directory), run it. If `pio` is on PATH, run `cd arduino-cyd-player-scanner && pio test -e native`; if not, record "pio absent".
3. **Integration suite.** `cd backend && npm run test:integration` (sequential, several minutes). Counts, duration, exit code.
4. **Toolchain probe.** `which` for: cvlc vlc mpd mpc pactl pw-play pipewire wireplumber dbus-daemon dbus-send dbus-monitor Xvfb docker bluetoothctl xdotool wmctrl python3 pio; `python3 -c "import dbusmock"`. Read `backend/tests/rung1/probe.sh` and `backend/tests/rung1/up.sh` first; run `probe.sh` only if it starts nothing and stops nothing; otherwise record what it would probe.
5. **CI workflows.** For `.github/workflows/test.yml`, `rung1.yml`, `capability-probe.yml`: triggers, jobs, timeouts, matrix legs, every use of `E2E_PACK_PATH` and `E2E_PROFILE_PATH`; whether the E2E helpers under `backend/tests/e2e` and `backend/tests/rung1/provision.js` honor `E2E_PROFILE_PATH` (show the grep).
6. **Record.** Per suite: exact counts, duration, exit code; the first 40 lines of any failure verbatim; every log line containing `LEGACY SHIM`, `LEGACY MODE`, or `drift`.

## Output

Write `/tmp/claude-0/-home-user/84692604-1422-5e48-a295-cc91e6bc4a0e/scratchpad/2026-09-12-container-baseline.md` with one heading per step. Final message: one line per suite (counts, exit code), every failure, and every toolchain gap.
