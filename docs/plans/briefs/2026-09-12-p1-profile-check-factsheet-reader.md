# P1 fact sheet brief — the installation profile check at boot (reader)

You read; you write one file, the fact sheet named under Output. Change
nothing else. Vocabulary: `CONTEXT.md` §2 (the gate), §4 (dormant vs
fault, alarm integrity), §5 (preflight, paper vs live). Model: Sonnet.
You dispatch no subagents.

## Where you work

Work only under `/home/user/ALN-Ecosystem/`. The top-level
`/home/user/ALNScanner` and `/home/user/ALN-TokenData` directories are
stale clones: never read them.

## Why

Block 2 will add a boot-time check of the installation profile file
against its schema, a preflight row for a profile that fails the check,
and a `valid` flag in the profile identity. The orchestrator writes that
brief from your facts, never from memory. Every claim you make cites a
file and a line.

## Questions (answer every one; "not found" plus the grep you ran is an answer)

1. `backend/src/services/profileService.js`: the full load path at boot.
   Name the function, list what it checks today (JSON parse, object,
   schemaVersion), what it logs, what state it keeps, what
   `getProfileInfo()` returns, and every consumer of `getProfileInfo()`
   and `getProfile()` under `backend/src/` (grep; list file:line).
2. `backend/config/profiles/installation-profile.schema.json`: the
   required top-level keys; `additionalProperties` at every level; the
   `endpoints` interior; any `$defs`. State exactly which misspelled keys
   the schema rejects and which it lets through (for example `instaled`
   inside `display.main`).
3. AJV under `backend/src/`: every runtime use (file:line), the Ajv
   options (strict, allErrors, formats), and how validation errors become
   messages. Say whether `ajv` sits in `dependencies` or
   `devDependencies` (package.json line).
4. `backend/src/services/preflightService.js`: how `evaluate({live})`
   builds rows; the row shape; the `rollup` and `blocking` shapes; where a
   row for a profile that fails the check would attach;
   `PreflightNoGoError`; `getLast()`.
5. The session-start gate: where `session:start` reads the evaluation
   (file:line in sessionService or commandExecutor); how `startAnyway`
   and `reason` are handled; what the session metadata stamps hold.
6. Contracts: every place the profile identity appears in
   `backend/contracts/openapi.yaml` (`/health`) and
   `backend/contracts/asyncapi.yaml` (`sync:full`, session metadata),
   with line numbers and the current property list; the contract test
   that validates the health response (file:line).
7. Consumers of the profile identity on the wire: `syncHelpers.js`,
   `healthRoutes.js`, the GM scanner (`ALNScanner/src/`, if it shows the
   profile anywhere), and the config-tool. File:line each.
8. The config-tool: does it validate profiles against the same schema
   file? Grep `config-tool/` for the schema filename and for Ajv. If yes,
   give file:line and the message format, so both sides can share
   wording.
9. Tests today: the test files for profileService, preflightService and
   the health route. Run each with `npx jest <file>` from `backend/` and
   paste the summary line.
10. E2E: how `E2E_PROFILE_PATH` reaches the orchestrator
    (`tests/e2e/setup/test-server.js`, `session-env.js`, file:line); the
    four Tier L legs' profile values (`.github/workflows/test.yml`
    matrix); the fixture profiles under `backend/tests/e2e/fixtures/`
    (list them), so a flow can point at a deliberately broken one.
11. `backend/src/services/dormancyService.js`: what it does with a
    profile it cannot read. Does an absent profile mean every family is
    dormant? File:line. This decides what "fails the check" must mean
    for dormancy.

## Completion criterion

All eleven questions answered with file:line evidence. Every count
(consumers, tests, fixtures) verified by a raw grep or a test run whose
command and summary line you paste. Unknowns stated as unknown with the
grep that failed.

## Output

Write `/home/user/ALN-Ecosystem/.superpowers/sdd/2026-09-12-block2-hardening-plan/p1-factsheet.md`
with sections numbered 1 to 11 as above, then "Risks the orchestrator
should know", then "Commands run". Reply with at most five lines:
status, the path, and the three facts most likely to change the design.
