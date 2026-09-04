# Phase 3 — C2+C3: the resolution mechanism + dormant-vs-fault

**Status:** census recorded; design r1 DRAFTED; red-team next; owner
batch (§5) queued to JOIN the pages batch — one owner sitting covers
both units. Build waits on that batch (and sequences behind the pages
build on the shared branch).
**Unit:** C2 (one resolution mechanism, preflight presentation only —
program §13.7/§14.4) + C3 (dormant-vs-fault semantics — the health
enum contract change, session-start disables, down-vs-not-installed
rejections). C4 (bindings page) stays queued behind this unit's
taxonomy.

## 1. Scope and inputs

C2 = `resolve()`: pack requirements × capability profile →
runs / degrades / unavailable, presented as PREFLIGHT only (planning
view is post-Phase-3 per the C1 §4 headroom table; a CLI/JSON
presentation is permitted, never owed; the certificate line runs
WARN-ONLY until E2 — R8). C3 = the health enum gains
expected/dormant (contract-first, GM-dashboard-coordinated);
endpoint-less game elements disabled AT SESSION START via the
standing evaluator's existing disabledCues seam (never held-forever);
SERVICE_DEPENDENCIES rejections distinguish "down" from "not
installed tonight". Inputs: the RATIFIED C1 resolution table (its §2
IS the semantics contract), program §13.7/§14.4/R8, ROADMAP 8.4/8.5,
the pages design's D-P1r2 (Media & needs — a future consumer of the
same resolve()) and D-P3r2 (the preview exemption that must survive
8.5), CONTEXT.md dormancy vocabulary.

## 2. Census record (2026-09-04 — two legs)

### 2.1 Surface (leg A; file:line in the leg record)

- **Pack needs are scattered, nothing aggregates them**: game.json
  `requires` (gated at activation), cue actions + their media/role/
  playlist fields (cues.json via CUE_ACTIONS), lightingRoles +
  fallbacks, `surfaces.idleLoop` channel; playlists resolve against
  VENUE config. packService explicitly punts venue-resource checks
  "at preflight".
- **The profile schema already speaks C2/C3**: `orchestrator: true`
  ⇒ stack service absence is a FAULT; `endpoints` — "absent endpoint
  makes its features DORMANT… never an error"; the endpoints INTERIOR
  is open — "C2 pins it". profileService today reads only
  kind/schemaVersion/profileId/forPack/bindings; the ALN profile has
  NO endpoints/network blocks yet.
- **Health substrate is a hard binary**: serviceHealthRegistry
  accepts exactly `healthy|down` (report() rejects others); contract
  SKEW already exists — asyncapi DomainStateHealth says
  `[healthy, degraded, down]` (degraded never emitted) while
  sync:full serviceHealth and openapi GameState say `[healthy, down]`.
  GM HealthRenderer renders binary (`!== 'healthy'` ⇒ red) and stays
  expanded unless ALL healthy — a dormant service would pin the
  dashboard red forever (the exact "red that is always red" failure).
- **Enforcement points**: commandExecutor SERVICE_DEPENDENCIES
  rejection has one wording for down-and-not-installed alike;
  `validateCommand` (health + resource existence — the preflight
  proto) is EXPORTED WITH NO PRODUCTION CALLER; the cue/video
  service_down HOLDS register NO auto-discard timer
  (`registerAutoDiscard` is caller-less — backend/CLAUDE.md's
  "auto-cancel after 10s" is STALE) so holds persist until GM action;
  the `disabledCues` seam EXISTS (Set + enable/disable + evaluator
  honor + persistence) but nothing populates it at session start.
- **Preflight protos**: GM "Check Now" = health probes only; the
  "C1 preflight" in packService is only the contentHash-staleness
  compare; the pages' Media & needs panel (D-P1r2) is the SAME
  needs×bindings join at AUTHORING time — one resolve(), two
  presentations.

### 2.2 Constraints (leg B; 10 bindings + 5 named questions)

The load-bearing ones: the RATIFIED C1 §2 table binds resolve()
verbatim (orchestrator:true absence = FAULT; orchestrator:false =
tier zero; `onAbsent: degrade` + not-installed = DORMANT, disabled at
session start, "not installed tonight"; `onAbsent: require` =
preflight NO-GO; unbound lighting role = flagged + disabled;
deviceClass below min = NO-GO); C1 §3 fixes the six preflight check
groups; §14.4 scope (preflight presentation only, CLI permitted);
R8 (cert line WARN-ONLY until E2); ROADMAP 8.5 re-homed HERE — owes
the packLoader behavioral-timeout + staging-race tests (ALNScanner)
and the packHash warn→enforce DECISION, under which the pages'
preview EXEMPTION must survive; the L12/S-M6 boundary (pages =
visibility; C4 = the hard-refusal flip; C3 = the taxonomy call);
contract-first at FOUR sites with the skew to reconcile; NO new
discrete WS event (service:state is the sole push — MESSAGE_TYPES
untouched); the full dormant-aware dashboard is Track D (Phase 4) —
Phase-3 GM obligation is render-safe handling; the
docs/preflight-checklist.md refresh rides C2; the videoQueueService
duplicate-hold backlog sits under C3's never-held-forever;
CONTEXT.md: dormant = deliberately unequipped (never an error),
fault = should-run-but-isn't, "down" today conflates them.

## 3. Design r1 (2026-09-04)

### D-C2.1 — one resolve(), pure, two Phase-3 presentations

- **`gameRules/packNeeds.js` (pure)**: `collectPackNeeds(pack)` — the
  aggregator the census shows nobody has: walks the activation
  snapshot (cues' actions → service families + media/playlist/role
  fields, lightingRoles, `surfaces.idleLoop`, `requires`) into a
  typed needs list `{kind: 'service'|'video'|'sound'|'playlist'|
  'lighting-role'|'surface-channel'|'capability', id, sources[]}`.
  Pure over the pack snapshot — unit-testable on both packs.
- **`gameRules/resolution.js` (pure)**: `resolve(needs, profile,
  inventory)` applying the C1 §2 table verbatim → per-need verdicts
  `{need, verdict: 'runs'|'dormant'|'fault'|'no-go', reason}` plus
  the rollup `{status: 'go'|'go-degraded'|'no-go', dormantServices[],
  disabledCueIds[], problems[]}`. `inventory` = the venue-side facts
  (asset dirs listing, playlist ids, HA scenes when available,
  bindings) gathered by the CALLER — the pure core never does I/O.
  The endpoints INTERIOR (the schema's open point) is pinned here:
  `endpoints: {<serviceId>: {onAbsent: 'degrade'|'require'}}` with
  service ids = the registry's 8 (a service absent from the block
  defaults per `orchestrator` — true ⇒ expected, false ⇒ tier zero).
- **Preflight presentation (the ONE owed face)**: at BOOT (after
  activation + profile load) and at SESSION CREATE, the orchestrator
  runs collect+resolve with live inventory and (1) logs the
  certificate block — WARN-ONLY severity per R8, (2) stores the
  verdict as the session's preflight stamp (beside the pack stamp),
  (3) feeds C3 (dormant registry marks + session-start disables).
  `validateCommand` becomes the per-command resource arm of the same
  sweep — its first production caller. The CLI presentation:
  `backend/scripts/preflight.js <packDir> [profile]` — the free JSON
  face of the same resolve() (permitted-not-owed; it exists because
  the harness and the pages' Media & needs panel both want the same
  JSON later).
- **8.5 lands here**: the two owed ALNScanner tests (packLoader
  behavioral timeout; staging-cache race) ride this unit's scanner
  touch; the packHash warn→enforce decision is §5 Q-C2-1 — with the
  pages' preview EXEMPTION honored under either answer (the preview
  orchestrator's own hash IS its served pack's hash — the mismatch
  warn keys on the LIVE orchestrator, so the exemption is structural;
  the design records it).

### D-C3.1 — the enum, contract-first

Reconciled enum everywhere: **`healthy | down | dormant`** — drop the
never-emitted `degraded` (the skew's third value; §5 Q-C3-2 confirms).
Registry: `markDormant(serviceId)` set by the preflight feed;
`report()` accepts the three values; revalidation SKIPS dormant
services (probing what isn't installed re-creates the always-red).
Contract sites updated together: asyncapi DomainStateHealth +
sync:full serviceHealth + openapi GameState (the /health orchestrator
`online` line untouched). GM side (ALNScanner, one coordinated
bump): HealthRenderer renders dormant as NEUTRAL "not installed
tonight" (grey, never red), collapse rule becomes
"all healthy-or-dormant"; contract cross-check test updated. The
full dormant-aware dashboard stays Track D.

### D-C3.2 — disables, rejections, and the end of held-forever

- **Session-start disables**: the preflight feed populates the
  EXISTING `disabledCues` seam with `disabledCueIds` (cues whose
  commands need dormant services), at session create and on restore;
  `cue:status`/service:state already carry the disabled set to the GM.
- **Rejection wording**: SERVICE_DEPENDENCIES gains the dormant
  branch — a dormant dependency refuses with "«service» is not
  installed tonight (dormant)" vs the fault wording "«service» is
  down: «message»". Same choke point, one new branch.
- **Never-held-forever**: holds are created ONLY for FAULTS — a
  command refused for a DORMANT service is refused outright (no hold:
  nothing will recover). And the stale auto-discard claim is made
  TRUE: the cue/video hold paths register the existing caller-less
  `registerAutoDiscard` (the F-SHOW-16 timer, 10s per the documented
  intent) so fault-holds self-discard instead of pinning the GM
  queue. The videoQueueService duplicate-hold backlog is NOT unified
  here (out of scope; recorded).

### D-C2.3 — profile completion (the input side)

The ALN profile gains its `endpoints` block (the D-C2.1 interior) and
the toy fixture profile gains a contrasting one (a dormant service —
e.g. lighting absent — so the dual-pack gate exercises DORMANT for
real). The preflight-checklist doc: ABSORBED — the mechanism's
certificate replaces the hand-run list, the doc becomes a short
pointer (§5 Q-C2-2 confirms).

### D-C4 boundary

C3 CLASSIFIES the unbound idle-loop channel (§5 Q-C3-1); C4 later
implements the L12 hard-refusal flip per that answer. Nothing in this
unit touches `_resolveIdleLoopFile`.

### Stage plan r1

CS.1 pure core (packNeeds + resolution, red-first on both packs) →
CS.2 preflight wiring (boot/session-create sweep, cert log, session
stamp, validateCommand caller, CLI script) → CS.3 the C3 contract
change (enum ×4 sites + registry + revalidation skip + GM renderer
coordinated bump + dist rebuild) → CS.4 disables/rejections/holds →
CS.5 profiles + 8.5's two scanner tests → CS.6 unit close (dual-pack
Tier L with the toy profile exercising dormant, panel, records).
**Estimate r1 (honest):** CS.1 0.5–0.75 · CS.2 0.5–0.75 · CS.3
0.75–1 (submodule-coordinated) · CS.4 0.5 · CS.5 0.25–0.5 · CS.6 0.5
→ **≈ 3–4 sessions** vs the program's C2-C4 ≈1.5–3 (C4 excluded
here; the growth is the contract coordination + the 8.5 debts).

## 4. (reserved: red-team record + r2)

## 5. Owner questions (queued to JOIN the pages batch)

**Q-C2-1 — packHash handshake: warn or refuse?** Today a GM scanner
whose loaded pack mismatches the orchestrator's gets a LOUD WARN and
connects anyway. Options: (a) keep warn-only through the Sept-Oct run
(my recommendation — a mid-show false refusal is worse than a warn,
and E2's cert story isn't landed); (b) refuse at handshake now. The
preview orchestrator is structurally exempt either way (it serves the
pack it warns against — recorded in D-C2.1).

**Q-C2-2 — the hand-run preflight checklist**: absorb it into the
mechanism's certificate (my recommendation — one source) or keep a
refreshed hand-run doc alongside?

**Q-C3-1 — taxonomy call**: a pack names idle-loop channel X and the
profile has NO binding for it. DORMANT ("venue chose not to equip
it" — my recommendation: it matches the C1 table's absent-endpoint
row, and C4's flip then refuses only `onAbsent: require` channels) or
FAULT (pack demands it, profile fails it)?

**Q-C3-2 — the enum**: reconcile all contract sites to
`healthy | down | dormant`, DROPPING the never-emitted `degraded`
(my recommendation — it has no producer and no renderer), or keep
`degraded` reserved?

**Q-C3-3 — GM-side minimum**: Phase-3 C3 GM work = render-safe
dormant handling only (grey "not installed tonight", collapse rule) —
the full dormant-aware dashboard stays Track D/Phase 4. Confirm.
