# T1a follow-up (CI) brief — the kiosk must launch on the hosted rung-1 runner

Read this first; it is your single source of requirements. Vocabulary:
`CONTEXT.md` §5 (environment ladder: rung 1 = real software stack, fake
physics). Model: Sonnet. You dispatch no subagents.

## Where you work

The git worktree `/home/user/ALN-Ecosystem/.worktrees/t1a-ci/` on branch
`claude/nice-curie-hescfv-t1a-ci` (cut from the designated branch at
`3345b6d`). It has NO node_modules and needs none: you edit two files
and the proof is a CI run. Never edit anything under
`/home/user/ALN-Ecosystem/` outside that worktree (another agent works
there). Push ONLY the branch `claude/nice-curie-hescfv-t1a-ci` (an
orchestrator ruling allows pushing this task branch so the workflow can
prove the fix; the orchestrator merges and deletes it).

## The defect

Rung-1 Harness run 13 on `c222dbe`
(https://github.com/maxepunk/ALN-Ecosystem/actions/runs/34698470523)
failed 12/13: `FAIL: service health (8 real services) — healthy:
audio,bluetooth,cueengine,gameclock,lighting,music,sound,vlc`. The
missing service is `display` (T1a's ninth service): `displayDriver`
spawns `process.env.CHROMIUM_BIN || 'chromium-browser'`;
`backend/tests/rung1/up.sh:96` hardcodes
`export CHROMIUM_BIN="/opt/pw-browsers/chromium"`, which exists in the
dev container (a symlink to Playwright's
`/opt/pw-browsers/chromium-<build>/chrome-linux/chrome`) but not on a
hosted runner, and `.github/workflows/rung1.yml` never installs a
browser. So the kiosk launch fails and `display` reports `down` — the
honest answer, and the audit is right to demand `healthy` on rung 1 (a
kiosk under Xvfb IS real software on fake physics).

## Deliverables

1. `.github/workflows/rung1.yml`: after "Install backend dependencies",
   add a step "Install Playwright Chromium (the rung-1 kiosk)" that
   installs Playwright's Chromium into `/opt/pw-browsers` and creates
   the same symlink the container has:
   ```
   sudo mkdir -p /opt/pw-browsers && sudo chown "$USER" /opt/pw-browsers
   (cd backend && PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers npx playwright install chromium --with-deps)
   ln -sfn "$(ls -d /opt/pw-browsers/chromium-*/chrome-linux/chrome | head -1)" /opt/pw-browsers/chromium
   test -x /opt/pw-browsers/chromium
   ```
   (`playwright` is a backend devDependency, installed by the `npm ci`
   step above it; `xvfb` is already installed by the stack step.)
2. `backend/tests/rung1/up.sh`: replace the hardcoded export with a
   resolution chain, in this order: an already-set `CHROMIUM_BIN` env
   value; `/opt/pw-browsers/chromium` if executable; else the path
   `node -e "process.stdout.write(require('playwright').chromium.executablePath())"`
   prints when run from `$BACKEND` (honoring `PLAYWRIGHT_BROWSERS_PATH`
   if set); if none is executable, `note "no Chromium found — the
   display service will report down"` and write an empty
   `CHROMIUM_BIN=` line. Write the resolved value into `env.sh` as
   today. Keep the script idempotent and `set -u`-clean.
3. Prove it on CI: commit (message names "Block 2 T1a follow-up: the
   rung-1 kiosk launches on hosted runners"), push the branch
   (`git push -u origin claude/nice-curie-hescfv-t1a-ci`). The Rung-1
   workflow self-triggers on pushes touching `backend/tests/rung1/**`
   or its own file. Poll the run with `gh` if available, else with
   `curl` against the public Actions API for the repo (read-only), or
   report the run URL and let the orchestrator read it. Done when the
   run's "Live-flow audit" step prints `PASS: service health (8 real
   services)` and `13/13 passed`. If it fails, read the failing step's
   log, fix, and push again — at most three pushes; then report BLOCKED
   with the log excerpt.

## Guardrails

Edit only the two files named. Do not change the audit's expectations
(`audit-flows.js`), the engine, or any test. Do not touch the main
checkout outside the worktree. No empty commits.

## Report

Write `/home/user/ALN-Ecosystem/.superpowers/sdd/2026-09-12-block2-hardening-plan/t1a-ci-report.md`:
Status; Commit(s); the run URL(s) with the audit lines quoted; Files
changed; Deviations; Concerns. Reply with at most 10 lines: status,
commit, run URL + verdict, report path.
