# P1 brief — the installation profile check at boot (implementer)

Read this first; it is your single source of requirements, with the
exact values to use verbatim. Vocabulary: `CONTEXT.md` §2 (the gate,
one truth), §4 (dormant vs fault, alarm integrity), §5 (preflight, paper
vs live). Model: Opus. You dispatch no subagents; review arrives from
the orchestrator after your report.

## What this buys, and for whom

The one truth: the pack says what the show needs, the installation
profile says what the venue has, one pure resolution produces every
verdict. A profile file that fails its own schema makes every verdict
wrong, and today it does so silently: the boot check reads only the
envelope (`kind`, `schemaVersion`), and a broken profile behaves exactly
like a venue that owns no equipment — every family dormant, grey on the
dashboard, no signal anywhere. That is the alarm-integrity failure this
block exists to prevent. After this task the GM's loop gets the truth:
the session start refuses with a NO-GO that names the broken field, the
typed override still works, and the identity on the wire says `valid`.

## Where you work

`/home/user/ALN-Ecosystem/` on the task branch the dispatch names, cut
from the designated branch `claude/nice-curie-hescfv`. Backend only
(`backend/`), plus the two contract files. Never touch `ALNScanner/`,
`ALN-TokenData/`, or `.worktrees/`. Push nothing. Commit per seam with
a message that names the pin it lands.

## The facts you build on (fact sheet: `.superpowers/sdd/2026-09-12-block2-hardening-plan/p1-factsheet.md`)

- `backend/src/services/profileService.js`: `_readProfile()` (lines
  67–98) checks JSON parse, object, `kind`, `schemaVersion` and returns
  `null` on each failure; `activateProfile()` (105–122); `getProfile()`
  (129–154); `getProfileInfo()` (198–202) returns `{profileId,
  forPack}` or `null`. Consumers: `preflightService.js:94,114`,
  `dormancyService.js:190`, `syncHelpers.js:157`, `healthRoutes.js:45`.
- `backend/config/profiles/installation-profile.schema.json` closes
  every object level (`additionalProperties: false`); `instaled` in
  `display.main` fails twice (unknown key, missing required).
- AJV has zero uses under `backend/src/`; it lives in `devDependencies`
  (`backend/package.json:112`, `ajv-formats` at 113). The contract test
  `backend/tests/contract/profile/installation-profile-schema.test.js`
  compiles the schema with `Ajv2020` from `ajv/dist/2020`, options
  `{allErrors: true, strict: true}`.
- `backend/src/services/preflightService.js` `evaluate({live})` (83–129)
  builds rows from `collectPackNeeds(pack)` only; row shape `{id, kind,
  verdict, depth, reason, severity, verbs}`; `severityOf` (139–146).
- `backend/src/gameRules/resolution.js`: `resolve(needs, profile,
  inventory)` (31–38); `rollUp()` (216–254) with the closure comment
  "exactly two rules can produce a no-go" (216–232); `sessionService.js:273`
  repeats it. `startGame()` is `sessionService.js:284–314`;
  `commandExecutor.js:245–272` turns `PreflightNoGoError` into
  `{success: false, message: 'NO-GO: ' + blocking.join('; ')}`.
- Contracts: `backend/contracts/openapi.yaml` `/health` `profile`
  (642–657); `backend/contracts/asyncapi.yaml` `sync:full` `profile`
  (333–348). Health contract test: `tests/contract/http/resource.test.js:139–146`.
- `dormancyService.recompute()` (188–194) passes a `null` profile to
  `dormantServicesFor`, which marks every declared family not installed
  (`endpointServices.js:92–102, 136`). Unchanged by this task.
- Fixture profiles: `backend/tests/e2e/fixtures/profiles/toy-dormant-lighting.json`,
  `toy-test-rig.json`; no broken fixture exists. Tier L legs pass
  `E2E_PROFILE_PATH`; a flow may pin `options.profilePath` per call
  beside `packPath` (`test-server.js:123–125,150`).
- Existing tests: `tests/unit/services/profileService.test.js` (15),
  `tests/unit/services/preflightService.test.js` (12),
  `tests/contract/http/resource.test.js` (19),
  `tests/contract/profile/installation-profile-schema.test.js` (18).

## Requirements (the plan's pins P17–P20, verbatim)

- **P17. The check.** `profileService.activateProfile()` validates the
  parsed file against `installation-profile.schema.json` with one
  compiled AJV validator (Ajv2020, `strict: true`, `allErrors: true`,
  the options the contract test already uses) exported from one module
  under `backend/src/` that the contract test imports too, so boot and
  test never drift. `ajv` and `ajv-formats` move to `dependencies`. The
  check runs after the existing envelope checks. Any failure of the
  file — unreadable, unparseable, not an object, wrong `kind`, wrong
  `schemaVersion`, schema errors — yields one validity record
  `{valid: false, reason}` where `reason` names the file and up to
  three `path: message` errors plus a count of the rest, capped so the
  NO-GO ack stays readable (200 characters). One `logger.error` line
  carries the same reason. A valid file yields `{valid: true}`.
- **P18. What a failed check means for the loaded content.** The
  content that parsed is still loaded (bindings and endpoints resolve
  exactly as today), so after an override the venue runs on whatever
  the file gets right. The profile identity is never null once
  activation ran: `{profileId, forPack, valid}` with `profileId` the
  file's `profileId` when it is a string, else the file's base name,
  and `forPack` null when absent. A profile absent on disk is a failed
  check, not a silent "no profile". (Before activation, selective-init
  harnesses keep today's behavior.)
- **P19. The row and the gate (owner ruling 2026-09-12: a failed check
  blocks `session:start`, typed override available).** `evaluate()`
  prepends one synthetic need `{kind: 'profile', id: 'schema'}` and
  passes `inventory.profileValidity`; `resolve()` gains the case:
  `runs` when valid, `no-go` with the P17 reason when not, depth
  `paper` (a file against its schema is a paper fact). `blocking`
  therefore widens from two rules to three by this ruling; the closure
  comments in `gameRules/resolution.js` and `sessionService.js` are
  rewritten to name the three rules and cite the ruling. No other arm
  may widen it. The require gate, the override, the stamp, and the
  scanner's typed dialog need no change: the NO-GO message already
  carries `blocking`.
- **P20. Identity on the wire, contract-first.** `/health.profile` and
  `sync:full.profile` gain `valid` (required boolean); `profileId`
  stays required; the session `preflight` stamp is unchanged (the
  blocking list already carries the reason). Two contract sites, the
  health contract test, and `sync:full` completeness.

Exact values: the new need is `{kind: 'profile', id: 'schema'}` and its
row id is `profile:schema`; the validator module is
`backend/src/services/profileValidator.js` exporting
`validateProfile(parsed) → {valid, errors: string[]}` and
`formatValidityReason(filePath, errors) → string`; the reason format is
`installation profile <basename> fails its check: <path>: <message>; <path>: <message>; <path>: <message> (+N more)`
truncated to 200 characters; a wrong-envelope failure uses the same
format with a single message (`not a JSON object`, `kind must be
installation-profile`, `schemaVersion must be 1`, `unreadable: <error>`).
The broken fixture is
`backend/tests/e2e/fixtures/profiles/toy-broken-profile.json`: a copy of
`toy-dormant-lighting.json` whose `endpoints["display.main"]` carries
`instaled` instead of `installed` and nothing else changed.

## Deliverables (tests first at every seam: red, then green)

1. `profileValidator.js` (P17) and the contract test importing it in
   place of its own compile; `package.json` dependency move.
2. `profileService.js` (P17, P18): the validity record, the loaded
   content on a schema failure, the identity shape; the existing 15
   unit tests re-pinned where P18 changes a `null` into an identity
   with `valid: false` — list each re-pinned case in the report.
3. `resolution.js` `profile` case and the three-rule comment (P19);
   `preflightService.js` synthetic need and inventory; the
   `sessionService.js` comment. Unit tests: the case both ways, the
   reason text, `rollUp` blocking with three rules.
4. Contracts (P20) first, then `healthRoutes.js` and `syncHelpers.js`
   through `getProfileInfo()`; the health contract test and the
   `sync:full` completeness test (find it by grepping
   `buildSyncFullPayload` under `backend/tests/`) cover `valid`.
5. One contract-level boot test (contract tests call `initializeServices()`
   — full init): with `PROFILE_PATH` at the broken fixture and
   `profileService._resetForTesting()`, `GET /health` shows
   `profile.valid === false` and a reason-bearing `blocking` in a fresh
   `preflightService.evaluate({live: false})`.
6. One E2E flow `backend/tests/e2e/flows/32-profile-check-gate.test.js`,
   modelled on `31-preflight-require-gate.test.js`, that starts its
   orchestrator with `packPath` pinned to `tests/e2e/fixtures/packs/toy-heist`
   and `profilePath` pinned to the broken fixture (per call, so it runs
   the same on every leg), creates a session, sees `session:start`
   refused with a NO-GO whose message contains `profile:schema` or the
   reason text, then starts with a typed reason and reads the override
   stamp.

## Proof runs (paste each command and its summary line)

From `backend/`: the RED run for each seam before its fix and the GREEN
run after; `npm test`; `npm run coverage:check`; `npm run lint`;
`npm run test:integration`; the new flow on the toy leg locally
(`E2E_PACK_PATH=tests/e2e/fixtures/packs/toy-heist npx playwright test
tests/e2e/flows/32-profile-check-gate.test.js --workers=1`) and once
more on the require leg (`E2E_PACK_PATH=tests/e2e/fixtures/packs/toy-heist-require
E2E_PROFILE_PATH=tests/e2e/fixtures/profiles/toy-dormant-lighting.json`,
same command) to prove the per-call pin wins; then, if
`backend/scripts/merge-gate.sh` exists, run it and paste its verdict.

## Guardrails

Contract-first: the two contract edits land before the code that
serves them. `gameRules/` stays pure: `resolution.js` reads only its
three arguments. No new discrete WebSocket event; `MESSAGE_TYPES`
untouched; no scanner change; no change to `dormancyService`,
`endpointServices`, the stamp shape, or the override. Winston logger.
The ratchet never lowers. Push nothing.

## Report

Write `/home/user/ALN-Ecosystem/.superpowers/sdd/2026-09-12-block2-hardening-plan/p1-report.md`:
Status (DONE / DONE_WITH_CONCERNS / NEEDS_CONTEXT / BLOCKED); Commits;
TDD evidence per seam (RED and GREEN commands with their lines); Proof
runs; Files changed; the re-pinned profileService cases; Deviations
(anything you did differently from a pin, and why); Concerns. Reply
with at most 10 lines: status, commits, one-line test summary, report
path.
