# Phase 3 — C2+C3: the resolution mechanism + dormant-vs-fault

**Status: OWNER RATIFIED 2026-09-04 ("ratify all") — §8 is the
NORMATIVE record** (architecture + rulings + r3 + re-sequenced
stages + final estimate). Build OPEN: CS.1 (rung-1 harness + pure
resolve core) runs FIRST, before the pages build — the badges consume
the core, and the owner directed all environment rungs as early as
possible. Prior sections are the design history (census → r1 →
red-team §5 → r2 §6 → batch §7, superseded by §8 where they differ).
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
  touch; the packHash warn→enforce decision is §4 Q-C2-1 — with the
  pages' preview EXEMPTION honored under either answer (the preview
  orchestrator's own hash IS its served pack's hash — the mismatch
  warn keys on the LIVE orchestrator, so the exemption is structural;
  the design records it).

### D-C3.1 — the enum, contract-first

Reconciled enum everywhere: **`healthy | down | dormant`** — drop the
never-emitted `degraded` (the skew's third value; §4 Q-C3-2 confirms).
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
pointer (§4 Q-C2-2 confirms).

### D-C4 boundary

C3 CLASSIFIES the unbound idle-loop channel (§4 Q-C3-1); C4 later
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

## 4. Owner questions r1 (SUPERSEDED by §7; kept for the record)

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

## 5. Design red-team record + adjudications (2026-09-04)

Two Opus legs over r1 (mechanism/state; scope/rulings/coordination).
18 findings + one census correction; all survivors adjudicated.

**Census corrections (folded into §2.1's reading):** `setAutoDiscard`
IS called — cueEngineService registers the 10s timer for
`video_busy` holds (unit-tested); only the `service_down` cue-hold
path and videoQueueService's own `_holdVideo` lack timers, and
backend/CLAUDE.md is accurate for the video_busy case. Contract enum
sites are three (asyncapi:664, asyncapi:2597, openapi:1998) plus the
registry's own report() validator; the scanner cross-check test lives
in backend/tests/contract/scanner/client-contract-conformance.test.js.

| # | Sev | Finding | Adjudication (r2 §6) |
|---|-----|---------|----------------------|
| M1 | BLOCKING | Out-of-band `report()` calls (HA socket close, D-Bus monitors, mpd timeout, pactl) stomp the dormant mark; boot ordering (services report AFTER the profile activates) erases a boot-time mark within seconds | STICKY DORMANT: a dormant-marked entry ignores report() (debug-logged) until `clearDormant()`; the preflight feed runs AFTER initializeServices |
| M2 | BLOCKING | `system:reset` wipes dormancy (registry.reset re-reports all down; cueEngine reset clears disables; pack/profile deliberately not re-activated) | The reset's post-reset wiring RE-RUNS the preflight feed from the boot-frozen pack+profile (marks + disables re-populated). Profile changes still require a restart — the frozen-at-boot doctrine, recorded |
| M3 | BLOCKING | Quick-firing a disabled cue is SILENT and acks success (fireCue returns void; the executor acks "Cue fired") | fireCue returns a refusal with reason; the ack carries it — dormancy-disabled fires say "not installed tonight" |
| M4 | MAJOR | One GM-toggleable persisted Set gives dormancy-disables no provenance; restore re-resolve clobbers GM intent | TWO sets: the GM set stays as-is (persisted); dormancy-disables live in a separate NON-persisted set recomputed by the feed; both honored at match/fire; `cue:enable` on a dormancy-disabled cue is REFUSED with the dormant message |
| M5 | MAJOR | 10s auto-discard is wrong for service_down (kills the video:recoverable / stillDown recovery affordances; VLC/MPD restarts exceed 10s) | Auto-discard stays the video_busy policy ONLY. Fault holds keep their recovery affordances and expire at SESSION END (never survive the session). Dormant never holds — refused outright |
| M6+S1 | BLOCKING | r1's `endpoints: {serviceId: {onAbsent}}` contradicted ratified C1: §1 keys endpoints physically (display.main, audio.sinks, lighting.instruments, stations, personal) and §2 puts `onAbsent` on the PACK side; deviceClass-min had no input | RE-PINNED: profile endpoints = the C1 §1 interior formalized verbatim; pack-side `onAbsent` is authored in pack-manifest.hardware (optional `endpoints: {<family>: {onAbsent}}`, default degrade — the manifest is the design-statement block and already carries deviceClasses); resolve()'s pack input = collectPackNeeds + manifest.hardware; needs gain `{kind: 'device-class', id, min}` → NO-GO below min |
| M7 | MAJOR | Inventory circularity: scene lists need lightingService up; sinks need pactl — a down/dormant service reads as a fault storm | RULE: the SERVICE verdict gates its resource verdicts; unqueryable inventory ⇒ verdict UNKNOWN (listed, never fault). Pinned in resolution.js |
| M8 | MINOR | Enum blast radius list + old-session stamp restores | CS.3 enumerates and updates every `=== 'healthy'` / `'down'` consumer (incl. HealthRenderer counts, commandExecutor wording, e2e capabilities.js per S5); the session preflight stamp follows the A2 `undefined → null` restore precedent |
| S2 | BLOCKING | The unbound-lighting-role row (C1 §2 row 5) was mis-folded into cue-LEVEL dormant-service disables — an unbound role is not a dormant service, and cue-level disable kills the cue's other commands | ROLE-UNBOUND is COMMAND-level: the resolver flags unbound roles; the executor's lighting normalization refuses a role with NO binding AND NO pack fallback ("role X unbound tonight"); a pack fallback still runs (degraded — L7's loud fallback stands). Cue-level disables remain the dormant-SERVICE mechanism only |
| S3 | MAJOR | Preflight missed §3 group 2 (network — kit-network checks are v1 per C1 §4) and group 6 (devices) | Both IN: the network arm (kit-network: router reachable, local DNS answers orchestratorName with orchestratorIp) and the devices arm (staffed ≥ manifest min via connected GM stations; stations synced via asset-manifest freshness; named sinks present). Venue-wifi stays E2 headroom |
| S4 | MAJOR | "Checklist ABSORBED" over-claimed — 1,682 lines are mostly host fundamentals resolve() cannot express | PARTIAL absorption: groups 4/5 + the cert line absorb into the mechanism; host fundamentals (§1-3, §6 of the checklist doc) remain hand-run, the doc restructured to point at the mechanism for what it covers. Q-C2-2 recast accordingly |
| S5 | MAJOR | e2e capabilities.js computes from `status === 'healthy'` (silently reclassifies dormant); PROFILE_PATH has no E2E plumbing — the toy dormant profile cannot reach a spawned harness | CS.3 updates capabilities.js (dormant = deliberately absent tier, its own capability state); CS.5 adds E2E_PROFILE_PATH inheritance + an npm script, the E2E_PACK_PATH pattern |
| S6 | MAJOR | CS.6 lacked named DoD pins | CS.6 pins ONE named flow on toy-pack + dormant-lighting profile: (a) lighting gm:command refused "not installed tonight" AND no hold; (b) the dependent cue in the dormancy-disabled set at create AND restore; (c) sync:full serviceHealth carries `dormant`; (d) HealthRenderer grey + collapsed (post dist rebuild) |
| S7 | MAJOR | Player-scan video bypasses the executor: videoQueueService's OWN hold store would hold forever on dormant vlc | IN SCOPE minimally: dormant vlc ⇒ the player-scan video path REFUSES via the existing "video unavailable" wire (no hold); videoQueueService's service_down holds gain the session-end expiry. Full store unification stays backlog |
| S8 | MINOR | Contract-site list imprecise | Fixed above (census corrections) |
| S9 | none | 8.5's two scanner tests ride CS.3's real scanner touch per 8.5's own re-homing; CS.5 must not gate the unit on them | Recorded: they land with the unit but are 8.5's debts, not gate criteria |
| S10 | MAJOR | Estimate never carried to a question; Q-C3-3 is doc-answerable | Estimate joins the batch (§7); Q-C3-3 dropped to a header note |

## 6. Design r2 — superseding decisions

r1's D-C2.1/D-C3.1/D-C3.2/D-C2.3 stand except as amended by the §5
adjudication column, which is NORMATIVE. The consolidated deltas:

- **resolve() inputs re-pinned** (M6+S1): pack side =
  `collectPackNeeds(pack)` + `pack-manifest.hardware` (deviceClasses
  min → no-go; optional per-family `onAbsent`, default degrade);
  profile side = the C1 §1 endpoints interior FORMALIZED into the
  schema (display.main / audio.sinks / lighting.instruments /
  stations / personal), `orchestrator`, `network`, bindings.
- **Sticky dormant lifecycle** (M1/M2): markDormant latches;
  report() ignored while latched; feed runs post-init at boot, at
  session create/restore, and inside the system-reset re-wiring.
  Profile is boot-frozen; mid-evening equipment changes wait for a
  restart (recorded posture).
- **Two disable sets + honest refusals** (M3/M4/S2): GM set
  (persisted) + dormancy set (recomputed); enable-on-dormant refused;
  fireCue returns reasons; role-unbound is command-level refusal with
  the pack-fallback degradation intact.
- **Hold policy** (M5/S7): video_busy = 10s auto-discard (existing);
  fault holds = recovery affordances + session-end expiry; dormant =
  never held, refused on the existing player-facing wire.
- **Preflight covers all six C1 §3 groups** (S3), with the
  service-gates-resources + unknown-never-fault inventory rule (M7);
  cert line WARN-ONLY (R8); checklist partially absorbed (S4).
- **Coordination** (M8/S5): CS.3 carries the full enum-consumer
  sweep incl. e2e capabilities.js + the scanner renderer + dist
  rebuild; CS.5 adds E2E_PROFILE_PATH plumbing; CS.6 pins the S6
  dormancy flow.

**Stage plan r2:** unchanged in shape (CS.1–CS.6), scope per the
folds. **Estimate r2 (honest): ≈ 3.5–4.5 sessions** — up from r1's
3–4 (the videoQueueService touch, the network+devices arms, the
role-refusal path, the E2E plumbing); the program priced C2–C4 at
1.5–3 and C4 is still outstanding. Carried to the owner (§7), not
squeezed.

## 7. Owner questions r2 (JOINS the pages batch — one sitting)

Header note: Q-C3-3 (GM-side minimum = render-safe dormant display
only, dashboard to Track D) is doc-answerable from §13.7/§7 and is
RECORDED as the design's position rather than asked.

**Q-C2-1 — packHash handshake: warn or refuse?** (unchanged from r1)
Recommendation: keep warn-only through the Sept–Oct run; the preview
orchestrator is structurally exempt either way.

**Q-C2-2 (recast) — the preflight checklist doc:** the mechanism
absorbs what it can express (pack refs, bindings, cert line,
services); the HOST fundamentals (node/disk/temps, orphan processes,
ports, submodules, .env) stay a hand-run list. Approve that split —
or name anything in the hand-run half you want mechanized this phase?

**Q-C3-1 — taxonomy call (unchanged):** unbound idle-loop channel =
DORMANT (my recommendation; matches the C1 absent-endpoint row; C4's
flip then refuses only `onAbsent: require`) or FAULT?

**Q-C3-2 — the enum (unchanged):** reconcile all sites to
`healthy | down | dormant`, dropping the never-emitted `degraded`
(my recommendation), or keep `degraded` reserved?

**Q-C3-4 (new) — estimate sign-off:** ≈ 3.5–4.5 sessions for C2+C3
(C4 additional), against the program's 1.5–3 for all of C2–C4. The
growth: the dormancy lifecycle hardening the red-team demanded, the
network+devices preflight arms C1 §3 always required, and the
coordinated contract change. Approve alongside the pages estimate
(its Q4)?

## 8. Owner ratification + design r3 (2026-09-04 — "ratify all")

The owner ratified, in one sitting after an extended grill: the
governing architecture ("one truth, three loops" — recorded in
CONTEXT.md §2, normative here), the five specific calls below, and the
price principle ("the design we grilled into shape gets built as
designed; the estimate follows the design"). This section supersedes
§6/§7 where they differ.

**Rulings (all ratified):**
- **R-C2-1 (supersedes Q-C2-1's warn-vs-refuse):** a GM scanner whose
  packHash mismatches SELF-HEALS — fetch the connected orchestrator's
  current pack, apply, re-handshake, one toast ("Rules updated to
  <version>"). Refusal survives only as the backstop when healing
  fails: a blocking screen with a plain instruction, not a dismissible
  banner. Each orchestrator (live or preview) is authoritative for its
  own connected stations — no preview exemption needed.
- **R-C2-2:** preflight machine-runs everything machine-observable,
  INCLUDING a Host arm (disk, temperature, load, processes, ports).
  The hand-run checklist shrinks to the physical room. Rows labeled
  paper/live + profile identity (CONTEXT.md §5).
- **R-C3-1:** unbound idle-loop channel = DORMANT. AND the require
  gate: `session:start` refuses while any `onAbsent: require` need is
  unresolved, with a typed, logged "start anyway" override. (This
  also fixes C4's `_resolveIdleLoopFile` flip: refuse only
  `onAbsent: require`.)
- **R-C3-2:** enum reconciled to `healthy | down | dormant` at the 3
  contract sites + registry validator; `degraded` deleted.
- **R-C3-3 (from the sitting, new):** the SUPERVISOR — bounded
  auto-restart with backoff for crashed software stack services,
  restart strategies in host config; escalation to a red row with a
  Restart verb only on exhaustion/flapping. Fault rows carry verbs
  (Restart / Re-route / Run-without-it / Release-Discard). Manual
  out-of-service = dormant's second door (GM-set, operator-gated),
  reusing the same latched state machinery.

**r3 additions (all ratified via the architecture):** profiles are
plural (venue/home/preview/CI — every environment partial, absences
dormant); paper/live verdict labeling with profile identity; the
witness-light register GENERATED from the pack's lighting roles
(one-hot; rung-1's lighting assertion); the rung-1 harness itself
(real software stack, fake physics — recipes and measured verdicts in
`2026-09-04-rung1-capability-research.md`, including the PROVEN
dbusmock-BlueZ rung and the pending modules-extra btvirt verdict);
per-runner capability manifests with probe-then-verdict honesty
(tests skip LOUDLY with recorded reasons, never silently).

**Re-sequenced stages (ratified order — rungs early; badges consume
the core, so the core precedes the pages build):**
- **CS.1 — rung-1 harness + the pure core.** Harness bring-up scripts
  (VLC/MPD/pipewire/HA per the research-doc recipes), simulation
  profile, witness-light generator, capability probe → runner
  manifest; `gameRules/packNeeds.js` (collectPackNeeds) +
  `gameRules/resolution.js` (the C1 §2 table verbatim), red-first ON
  the harness, both packs. Includes the existing-engine audit (first
  real-services run of current E2E flows) with findings triaged to
  fixes before further stages.
- *(Pages build PS.1–PS.6 runs next — see the pages doc §9.)*
- **CS.2 — dormancy lifecycle + enum.** Contract-first enum change,
  sticky dormant with both doors, session-start require gate + logged
  override, session-create/restore/reset feed points.
- **CS.3 — supervisor + verbs + self-heal.** Auto-restart engine
  (host-config strategies), fault-row verbs end-to-end, scanner
  pack self-heal + backstop screen, hold policy (fault holds expire
  at session end; dormant never held).
- **CS.4 — preflight presentation.** All six C1 §3 groups + Host arm,
  paper/live labels, GM panel + CLI twin, cert row WARN-only (R8).
- **CS.5 — close.** Dual-pack Tier L + rung-1 CI job green in both
  runners, ratchet, whole-unit adversarial review, records.

**Estimate (final, priced with the harness): ≈ 5.5–7 sessions** for
C2+C3 including CS.1's harness (C4 additional ≈ 1.5–2). Owner
ratified the price principle; this number is the fold's honest
statement of it.

## 9. CS.1 execution record (running — 2026-09-04)

**Increments pushed (each red-first, full backend suite green):**
1. `gameRules/packNeeds.js` — collectPackNeeds (`31bdca9`, 9 tests).
2. `gameRules/resolution.js` — the C1 §2 table, paper/live depths,
   graded rollup (`bf23ff0`, 14 tests).
3. `scripts/lib/witnessConfig.js` — one-hot witness register
   generated from pack roles; LIVE-PROVEN in real HA (`15b6afa`).
4. Harness: `tests/rung1/{up,probe,down}.sh` + generate-fixtures +
   onboard-ha + `scripts/lib/simulationProfile.js` (`993d85b` + the
   transport rework in the next commit) — brought up and probed by
   execution in the dev container.

**Engine-audit findings so far (first real-services boot ever;
each verified against code or by reproduction, none assumed):**
- **Transports the harness first got WRONG, corrected from the
  engine's code:** musicService connects to MPD via the Unix socket
  `/tmp/aln-mpd.sock` (mpd2.connect({path})), not TCP;
  vlcMprisService drives VLC over MPRIS on a D-Bus SESSION BUS by
  shelling out to `dbus-send` — the harness now runs one shared
  permissive bus (custom config; cross-uid proven) with
  `cvlc --control dbus`.
- **First boot connected three real services**: lighting → real HA
  (sceneCount 7 — the generated witnesses), music → MPD over the
  engine socket, vlc → D-Bus. The generated simulation profile
  loaded and froze (7 bindings).
- **VLC restarted 13 times in ~40s — root-caused by reproduction:**
  the engine spawns its OWN VLC (`_buildVlcArgs`) and owns its
  lifecycle; run as root, that exact command exits 1 ("VLC is not
  supposed to be run as root"), and the engine's built-in restart
  loop retried every 3s, unbounded, with no backoff growth, no flap
  detection, and no escalation — while the one-line diagnosis sat in
  the child's stderr. THREE consequences: (a) vlcMprisService already
  contains a per-service supervisor — C3's supervisor generalizes
  THIS prior art, it does not add a second mechanism; (b) the
  bounded-attempts + escalate-with-verdict design is now
  evidence-backed by our own engine's behavior; (c) the D-Bus monitor
  keys on the generic org.mpris.MediaPlayer2.vlc name and confused a
  stranger VLC for its child (health flapped healthy/down) — child
  identity is a supervisor requirement. ALSO: the audit engine must
  run NON-ROOT (the engine owns VLC's spawn), and "what user runs
  the engine" is host config.
- Engine honored the profile's surfaces binding (looked for the
  bound idle-loop file — harness owes a placeholder mp4); engine
  auto-start expects an HA container NAMED `homeassistant` (host
  assumption, benign, note for host config); DisplayDriver spawns
  `chromium-browser` (ENOENT in the container — shim to the
  Playwright chromium or accept); WirePlumber restore-rule warning
  (known deployment dependency).

**CI stabilization (same day):** the Test workflow gained a
per-ref concurrency group with cancel-in-progress after repeated
self-inflicted run pileups tripped job timeouts on superseded heads
(runs 222–238; the four red summaries on the post-ratification heads
were overlap cancellations/timeouts — Integration and Unit+Contract
passed on every head where they completed).

**Non-root audit + live-flow run (fifth increment).** The harness was
reworked to the venue-faithful process model and the audit completed
against it:

- **Single-user model:** on the venue Pi everything runs as one
  non-root user; the harness now mirrors that — session bus, pipewire,
  Xvfb all run AS the harness user, root does only docker/HA/user
  creation and the stale-artifact sweep. New `engine.sh start|stop|
  status` boots the engine itself as that user.
- **Engine-owned transports:** the harness no longer starts MPD or VLC
  at all — the engine SELF-HOSTS both (musicService spawns mpd,
  vlcMprisService spawns cvlc). A harness-owned instance CONTENDS with
  the engine's child (socket steal on /tmp/aln-mpd.sock, MPRIS
  bus-name collision — the child-identity confusion finding made
  concrete). probe.sh's mpd/vlc rows are labeled engine-owned.
- **down.sh drift finding:** the old teardown killed a pid file up.sh
  never wrote, which is exactly how two whole process generations
  accumulated across re-runs. Teardown now kills the EXACT pid files
  up.sh writes, plus engine children via /tmp/aln-pm-*.pid.
- **Non-root VLC spawn GREEN:** the engine's own VLC supervisor came
  up first try as the harness user — D-Bus connected, MPRIS monitor
  started, ZERO restarts (the root boot looped 13 times in 10 min).
  7 of 8 services healthy at boot (bluetooth honestly absent).
- **Two new physics gaps found by the first live-flow run, both now
  harness arms:** (1) headless VLC accepts the play command but every
  item lands `stopped` — no X display for the vout; fixed with an
  Xvfb arm (real X server, virtual screen — exactly "fake physics").
  (2) MPD's pulse mixer attaches only while the output is open:
  `setvol` while stopped fails with MPD's obscure "All outputs are
  disabled" — ALSO a venue-real GM-panel edge (volume slider while
  music stopped); recorded, not papered over.
- **One engine seam added (red-first, +1 test):** `CHROMIUM_BIN` env
  override in displayDriver (the hardcoded `chromium-browser` spawn
  got EACCES here; same seam class as PACK_PATH/DATA_DIR/LOGS_DIR).
- **Media placeholders:** generate-fixtures now seeds the idle-loop
  file and token-declared videos (kai001/rem001) from the committed
  E2E fixture mp4s, creates public/music with a 30s silence track,
  and loudly reports any missing cue-referenced sound file (real show
  content is never fabricated).
- **`tests/rung1/audit-flows.js` — 13/13 PASS, zero mocks:** admin
  auth → sync:full (pack identity + 7 healthy services) → session
  create/start → GM lighting role flips the REAL HA witness register
  one-hot → player scan of kai001 → engine VLC actually plays it under
  Xvfb → standing cue `attention-before-video` fires (sound + role
  `video-playback`, witness flips) → video completes →
  `restore-after-video` flips the register back to gameplay →
  pw-play sound → engine-spawned MPD play + setVolume → session end.
  The full "one truth" chain — pack cue to physical-stand-in light —
  proven end to end on rung 1.
- **dbusmock arm system-wide:** apt `python3-dbusmock` rides the
  python3.12 dbus bindings; probe now reports it ok with no venv.
- **packNeeds gap (for CS.2):** video FILES are not collected as needs
  (sound files are, via cues) — the harness had to derive token videos
  from tokens.json directly. A `video-file` need kind (token `video`
  fields + cue `video:queue:add` payloads incl. timelines) belongs in
  collectPackNeeds/resolve so preflight can live-check them.

Backend suite 2815/2815 after the seam.

**CI job port (sixth increment):** `.github/workflows/rung1.yml` —
the recurring automated rung-1 instance on hosted runners: apt the
measured recipe (VLC/MPD for the engine's own children, pipewire +
Xvfb + dbus arms, python3-dbusmock as the hosted-CI BT ceiling),
sudo bring-up with runner PATH preserved (secure_path hides
setup-node's toolcache node), probe, non-root engine boot, the
13-assertion audit, teardown always; self-scoped push trigger +
per-ref concurrency. Run 1 failed at parse (unquoted step name
containing a colon — caught because the run's display name fell back
to the file PATH); fixed with a local yaml.safe_load verification
before re-push.

**Two-axis stage review (fixed point c9b30c8, parallel subagents):**

- *Standards axis:* clean — no hard violations; every changed file
  accounted for. One judgement-call smell noted (the `resolveOne`
  kind-dispatch switch = the ratified table design itself, matching
  `scoring.js` idiom).
- *Spec axis:* four findings, each verified against primary sources
  then dispositioned:
  1. **Rollup shape (CONFIRMED, fixed):** D-C2.1 names
     `{status, dormantServices[], disabledCueIds[], problems[]}`;
     only `status` was built. `dormantServices` (dormant
     service/endpoint ids) and `problems` (every fault/no-go reason)
     now produced, red-first. `disabledCueIds` is DEFERRED to CS.2
     with its true producer — C3's session-start disable walk — a
     resolve-time guess would duplicate that mechanism (recorded in
     the rollUp doc comment).
  2. **Tier zero (CONFIRMED, fixed):** the C1 §2 `orchestrator:
     false` row was unimplemented. Now: orchestrator-hosted need
     kinds (service, endpoint, lighting-role(+ref), surface-channel,
     sound) resolve DORMANT "by design" — never fault, even against
     live down-health (nothing was promised to run); capabilities and
     device-class minimums are standalone-capable and resolve
     normally.
  3. **Dual-pack gap (CONFIRMED, fixed):** resolution.test.js never
     ran the toy pack through resolve(). Added: real toy-heist needs
     against the real toy-test-rig profile (which binds BOTH roles,
     fallback-less `all-clear` included) → rollup `go`, empty
     dormant/problems.
  4. **Unbound-role fault-vs-dormant (ADJUDICATED: fault stands).**
     The reviewer argued dormant per CONTEXT.md §4. Rejected on three
     grounds: dormant's two doors both require someone to have CHOSEN
     the absence (a missing binding with no authored fallback is a
     configuration hole nobody chose); the C1 §2 row itself says
     "preflight flag", pointedly not the DORMANT label it gives
     endpoints; and alarm integrity cuts both ways — grey-hiding a
     will-refuse-mid-show condition is the miss-a-real-alarm failure.
     The reviewer's REAL catch was the reason string ("role unbound
     tonight" read dormant-ish): it now carries consequence + verbs
     ("its cues will refuse; bind the role in the profile or author a
     fallback") per Loop 3, pinned by test.
- Also batched: Test Summary now skips on cancelled runs
  (`always() && !cancelled()`) — the concurrency guard's cancellations
  were producing a red summary + failure notification on every push
  (observed runs 238/240/241).

Backend suite 2818/2818, ratchet clean. CS.1 exit state: harness +
CI port + audited engine + reviewed core. Remaining before unit close
(CS.5): none for this stage — CS.1 CLOSED pending the rung1.yml CI
run's first green verdict (in flight at fold time).

**CS.1 CLOSE CONFIRMED 2026-09-04.** Both held verdicts landed:
rung1.yml runs 4 AND 5 GREEN on hosted runners (the recurring rung-1
environment instance: non-root engine, 13/13 zero-mock audit), and
the main-suite Test run 259 GREEN on `5d41b9b` (all jobs — the first
COMPLETED full-suite run since 239; runs 243–258 were all cancelled
by the per-ref concurrency guard under the session's design-push
cadence, a process cost recorded above). Close record written to
PHASE3-STATUS (C2+C3 section); task #32 marked complete. CS.2 next
per the ratified order, sequenced behind the pages build.
