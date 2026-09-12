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

## Requirements (the plan's pins P17–P20, verbatim; revised after the plan-and-brief review)

- **P17. The check.** `profileService.activateProfile()` validates the
  parsed file against `installation-profile.schema.json` with one
  compiled AJV validator (Ajv2020, `strict: true`, `allErrors: true`)
  exported from `backend/src/services/profileValidator.js`, which BOTH
  schema tests import in place of their own compile
  (`tests/contract/profile/installation-profile-schema.test.js` and
  `tests/unit/scripts/simulationProfile.test.js`), so boot and test
  never drift. `ajv` moves to `dependencies`; `ajv-formats` stays a
  devDependency (the schema declares no `format` keyword). The
  validator compiles once at module load inside a try; a compile
  failure yields `{valid: false, reason: 'profile validator
  unavailable: <error>'}` with a `logger.error`, never a throw (the
  service's never-throws rule stands). The check runs after the
  existing envelope checks. Every failure of the file — unreadable,
  unparseable, not an object, wrong `kind`, wrong `schemaVersion`,
  schema errors — yields one validity record `{valid: false, reason}`:
  `reason` is `installation profile <basename> fails its check: ` plus
  up to three `path: message` errors joined by `; `, the error list
  capped at 200 CODE POINTS with the P7 idiom (`[...s].slice(0, N).join('')`,
  never a UTF-16 slice), then `(+N more)` appended AFTER truncation and
  never itself truncated; an envelope failure carries one message
  (`unreadable: <error>`, `not a JSON object`, `kind must be
  installation-profile`, `schemaVersion must be 1`). One `logger.error`
  line carries the same reason. A valid file yields `{valid: true}`.
- **P18. What a failed check means for the loaded content.** A file
  that passes the envelope checks but fails the schema is still LOADED
  (its bindings and endpoints resolve exactly as today), so after an
  override the venue runs on whatever the file gets right. An envelope
  failure keeps today's behavior: `getProfile()` returns null and
  nothing binds, because a document that is not an installation profile
  must not half-bind (the assertions at `profileService.test.js:244,249`
  stand). The profile identity `{profileId, forPack, valid}` always
  carries `valid`: after activation it is the activation's validity;
  before activation it is the validity of the live read, so
  selective-init harnesses keep today's content and gain the flag.
  `profileId` is the file's `profileId` when it is a string, else the
  file's base name without its extension; `forPack` is null when
  absent. A profile absent on disk is a failed check, not a silent "no
  profile".
- **P19. The row and the gate (R12).** `evaluate()` prepends one
  synthetic need `{kind: 'profile', id: 'schema'}` (row id
  `profile:schema`) and passes `inventory.profileValidity`; `resolve()`
  gains the case: `runs` when valid; `no-go` with the P17 reason when
  not; `runs` at depth `paper` with reason `profile validity unverified`
  when the record is absent (the unknown-never-faults rule every other
  case follows); depth `paper` throughout (a file against its schema is
  a paper fact). The `profile` kind never joins `ORCHESTRATOR_KINDS` (a
  broken file's verdict cannot depend on a field inside the broken
  file). `resolve`'s `inventory` docstring widens from "live facts the
  caller gathered" to "facts the caller gathered, live unless the
  verdict says otherwise". `blocking` widens from two rules to three by
  R12; the closure comments in `gameRules/resolution.js` and
  `sessionService.js` are rewritten to: "Exactly three rules can produce
  a no-go: the endpoint `onAbsent: require` rule, the device-class
  minimum, and the installation profile FILE's own validity against
  `installation-profile.schema.json` (P19, R12). The third rule is the
  file-versus-schema fact ONLY — no other profile-derived finding,
  including a binding that names an undeclared role, may join it; those
  are faults. NO OTHER ARM MAY ADD TO IT." `preflightService.LIMITS.verifies`
  gains "the installation profile file against its schema (paper)" and
  `cannotVerify` gains "bindings that name roles or channels the pack
  never declares (T4)" (P8: the honesty face moves with the arm). The
  require gate, the override, the stamp, and the scanner's typed dialog
  need no change: the NO-GO message already carries `blocking` (reasons
  only; the row id is never in the message). — cost if wrong: a venue
  with a broken profile needs a typed reason to start; the reason names
  the field to fix.
- **P20. Identity on the wire, contract-first (supersedes P15's
  two-field statement of the same object).** `/health.profile` and
  `sync:full.profile` gain `valid` (required boolean); `profileId` stays
  required; the session `preflight` stamp is unchanged (its `profileId`
  is already string-or-null and `blocking` carries the reason).
  Coverage: the health contract test, a nested assertion in
  `tests/contract/websocket/session-events.test.js`, the hand-written
  `profile` fixture at `tests/contract/scanner/event-handling.test.js:44`
  updated; the `sync:full` completeness test pins top-level keys only
  and stays untouched.

Exact values: the new need is `{kind: 'profile', id: 'schema'}` and its
row id is `profile:schema` (the row id never appears in the NO-GO
message, which carries reasons only); the validator module is
`backend/src/services/profileValidator.js` exporting
`validateProfile(parsed) → {valid, errors: string[]}` and
`formatValidityReason(filePath, errors) → string`; the reason format is
`installation profile <basename> fails its check: <path>: <message>; <path>: <message>; <path>: <message> (+N more)`
with the error list capped at 200 code points BEFORE the `(+N more)`
suffix is appended; a wrong-envelope failure uses the same prefix with a
single message. The broken fixture is
`backend/tests/e2e/fixtures/profiles/toy-broken-profile.json`: a copy of
`toy-dormant-lighting.json` with `profileId` set to `toy-broken-profile`
and one key ADDED inside `endpoints` — `"display.main": { "instaled": true }`
— which the schema refuses twice (`additionalProperties: false` at
`endpoints["display.main"]`, and its `required: ["installed"]`). Nothing
else differs. The toy-heist manifest declares no `display.main`, so the
addition changes no dormancy verdict and the flow's NO-GO has exactly
one cause.

## Deliverables (tests first at every seam: red, then green)

1. `profileValidator.js` (P17): the module, with unit tests that it
   refuses `instaled` (as an added `display.main` key), a wrong type, a
   missing required key, an unknown family, and that it accepts
   `config/profiles/aln-full-kit.json`, both fixture profiles, and the
   generated simulation profile (generate it the way
   `tests/unit/scripts/simulationProfile.test.js` does); a test that a
   compile failure yields the `profile validator unavailable` record
   without throwing. BOTH schema tests
   (`tests/contract/profile/installation-profile-schema.test.js` and
   `tests/unit/scripts/simulationProfile.test.js`) import the module in
   place of their own compile. `ajv` moves to `dependencies`;
   `ajv-formats` stays where it is.
2. `profileService.js` (P17, P18): the validity record for each failure
   class; the loaded content on a schema failure; null on an envelope
   failure (the two `toBeNull()` assertions at
   `profileService.test.js:244,249` STAY — only `getProfileInfo()`
   changes for those cases); the identity shape for valid,
   schema-invalid, envelope-invalid, absent-on-disk, and pre-activation.
   List every re-pinned existing case in the report.
3. `resolution.js` `profile` case (valid, invalid, record-absent), the
   `ORCHESTRATOR_KINDS` exclusion, the docstring, the three-rule
   comment (P19); `preflightService.js` synthetic need, inventory, and
   the two `LIMITS` lines; the `sessionService.js` comment. Unit tests:
   the case all three ways with the reason text and the depth; `rollUp`
   blocking with three rules; `sessionService.startGame` refuses with
   `PreflightNoGoError` on a failed check, starts and stamps
   `preflightOverride` with a typed reason, and a fault never refuses.
4. Contracts (P20) first, then `healthRoutes.js` and `syncHelpers.js`
   through `getProfileInfo()`. Coverage for `valid`: the health contract
   test (`tests/contract/http/resource.test.js:139–146`), a nested
   assertion in `tests/contract/websocket/session-events.test.js`, and
   the hand-written `profile` fixture at
   `tests/contract/scanner/event-handling.test.js:44` updated. The
   `sync:full` completeness test pins TOP-LEVEL keys only and stays
   untouched.
5. One contract-level boot test (contract tests call `initializeServices()`
   — full init): with `PROFILE_PATH` at the broken fixture and
   `profileService._resetForTesting()`, `GET /health` shows
   `profile.valid === false` and a fresh
   `preflightService.evaluate({live: false})` carries the reason in
   `blocking` and the row `profile:schema` in `rows`.
6. One E2E flow `backend/tests/e2e/flows/32-profile-check-gate.test.js`,
   modelled on `31-preflight-require-gate.test.js`, that starts its
   orchestrator with `packPath` pinned to `tests/e2e/fixtures/packs/toy-heist`
   and `profilePath` pinned to the broken fixture (per call, so it runs
   the same on every leg), creates a session, DRIVES `session:start`
   ITSELF (never through `startSessionViaWebSocket` or any helper that
   auto-overrides when `E2E_PACK_PATH` ends with `toy-heist-require` —
   `session-helpers.js:65` keys on the env var, not the running pack),
   sees the refusal with a NO-GO whose message contains `fails its
   check`, asserts the row id `profile:schema` against
   `preflightService.getLast().rows` or the `/health` view, then starts
   with a typed reason and reads the override stamp.

## Proof runs (paste each command and its summary line)

From `backend/`: the RED run for each seam before its fix and the GREEN
run after; `npm test`; `npm run coverage:check`; `npm run lint`;
`npm run test:integration`; the new flow on the toy leg locally
(`E2E_PACK_PATH=tests/e2e/fixtures/packs/toy-heist npx playwright test
tests/e2e/flows/32-profile-check-gate.test.js --workers=1`) and once
more on the require leg (`E2E_PACK_PATH=tests/e2e/fixtures/packs/toy-heist-require
E2E_PROFILE_PATH=tests/e2e/fixtures/profiles/toy-dormant-lighting.json`,
same command) to prove the per-call pin wins — this second run is only
meaningful because the flow drives `session:start` itself; then run
`backend/scripts/merge-gate.sh` (it exists once P2a merged) and paste
its verdict.

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
