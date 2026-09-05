# ROADMAP r4 — DRAFT for the owner grill (revision r4.1)

**Status: DRAFT (r4.1, 2026-09-05). Not ratified. `ROADMAP.md` (r3)
stays authoritative until the owner grills this document and ratifies
it; on ratification this text replaces `ROADMAP.md` in place and the
r3 text survives in git history.**

Inputs: the owner's four 2026-09-04 directives (plain domain language;
a readiness ladder instead of phase walls; work re-sequenced by what
improves running the game; "Deploy" as the config tool's word for its
show-night stage), and the two audits committed beside this draft
(`2026-09-04-recharter-audit-corpus.md`,
`2026-09-04-recharter-audit-dependencies.md`). A two-leg adversarial
review of the first revision produced 74 findings; all are folded
here. Every open decision is a numbered question in §9.

Writing rule (binding on this document and its successors): plain
language per `docs/agents/process.md` §4; domain vocabulary per
`CONTEXT.md`. Historical code names appear only in parentheses on
first mention and in Appendix A.

---

## 1. Why this rewrite exists

Three problems, all owner-diagnosed 2026-09-04:

1. **Two vocabularies.** The plans speak in accreted code names
   ("Track D", "B9", "E10") while the product design speaks the
   ratified production lifecycle — Author, Rehearse, Run, Review
   (CONTEXT.md §5b) — plus "Deploy", the owner's ruled word for the
   config tool's show-night stage (its formal CONTEXT.md entry is
   Q10). The owner should never need the letters.
2. **Phase walls instead of decision points.** Seven statements in
   the corpus tie all hardware and deployment work to "after Phase-3
   close"; one statement already cracks that wall (audit §1). That
   was a default, not a decision. What the owner needs is the set of
   points where the system is ready for hardware testing, for
   deployment, or for sharing — so timing becomes informed calls.
3. **Sequence by architecture, not value.** The ratified queue
   orders work by dependency history. Re-examined against what
   improves running the game, the order changes substantially (§3).

The owner's four show-night pains drive the value ordering. They are
listed at the top of §3, where the ordering uses them.

---

## 2. The readiness ladder (the new organizing axis)

Five readiness states, named in plain words and used by those names
throughout. Each has a technical gate. Deployment and sharing
decisions are made AT states, not at phase boundaries.

One standing rule bridges the states: the frozen-production rule
(CONTEXT.md §7) holds until the owner's show-ready decision — nothing
deploys to the live venue machine; the merge train changes only
`main`. If a cutover happens, r3 §7.2's steady-state rule takes over
(engine updates only between events; pack updates any time).

**Coherent on main.** The merge train (the ordered PR table in
PHASE3-STATUS) extended with the newer vehicles and walked in order;
`main` green on the full suites; the dual-pack end-to-end run green
on `main`. Today `main` is still identical to the July production
release; everything this program built lives on chained branches.
Two honesty notes: the recorded train table ends at the theme unit —
the current branch (the tooling foundation through this draft) must
be added as a vehicle before the walk, and one older vehicle's CI has
never been observed (the record itself flags it: "watch it"). The
train's ratified timing ("owner-driven, post-run") is superseded into
an owner decision by §8.

**Hardware-proven.** A second machine ("green") built from the
deployment docs and passing the home hardware pass (the testing
ladder's Stage B, r3 §3b): real video decode and output, real audio
and speaker routing, lighting scenes on a real bulb, NFC over HTTPS
on the tablet, a full hardware-scanner asset sync, on-device pack
activation, and the preflight — meaning today's hand-run preflight
checklist document; the in-panel preflight instrument arrives later,
with the hardening block, and upgrades the show-ready gate, not this
one. The docs are the proven blocker (audit, claim 5: only 2 of the
7 required machine-state areas are fully documented; one area — Home
Assistant — is entirely absent); hardware readiness itself is
untested in both directions. The repair is bounded — scope in
Appendix C — and is this draft's first proposed unit. The
certificate spike (S2) runs during this same setup, as r3 §3b
already directs.

**Show-ready.** The state in which deploying for ALN is a live
choice. Gate, quoted identically in Q5: (1) hardware-proven; (2) the
hardening block and the truth sweep landed; (3) one full venue
rehearsal done (the testing ladder's Stage C — an off-day machine
swap, which r3 already defines as a full cutover rehearsal including
the swap back); (4) the owner has reviewed the visible-change list
(Appendix B) as the GM. On the calendar: the run occupies
Fridays–Sundays 2026-09-18 → 10-18; Mondays–Thursdays are the only
candidate swap windows, with the old machine as the physical
rollback. Whether a mid-run swap is allowed is an explicit owner
decision (Q5); the r3 rule it replaces is recorded in §8.

Why the gate is strict: tests lock the engine's outputs byte-for-byte
at eleven comparison points, but nothing captures what a GM screen or
the scoreboard actually draws — and the sixteen visible changes
between production and the new system (Appendix B) sit exactly in
that untested area. Deploying hands the GM a changed instrument; the
venue rehearsal is where the GM meets it, not opening night.

**Previewable.** A designer friend can sit down with the tool, open
the toy pack, change something, and rehearse it. Contents of the
slice that reaches this state: Q7 (it is constrained by the UX
foundation's still-open structure decisions — see Block 5). This
milestone does not exist in r3 at all; it is the earliest
external-feedback point. An open safety question rides it: the
committed env file with a live Home Assistant token is a MUST-FIX
currently anchored to open-sourcing — should rotation happen before
the first outside person touches the system? (Q12.)

**Adoptable.** A stranger can stand the platform up and learn it:
the guided setup path, the first-run experience, human-facing
designer and operator docs, the secrets fix executed, a license, the
privacy defaults stated. r3 held these as a bare gate list (§7.4);
this draft charters them as a block of work with an owner.

---

## 3. The work, re-sequenced by value

**The four pains** (owner, 2026-09-04), with the handles used below:
- **the panel-drift pain** — the GM scanner's admin panel drifting
  out of sync with real state (audio routing is the named example);
- **the is-it-working pain** — verifying every component works (the
  venue TV scoreboard and the browser scoreboard named);
- **the reconstruction pain** — juggling photos and notes while
  operating, then reconstructing the night afterward;
- **the scanner-UX pain** — the GM scanner's information
  architecture being unhelpful mid-game.

**The clock:** the run opens 2026-09-18 and closes 10-18;
Mondays–Thursdays are the only swap windows.

**Next actions if this draft ratifies:** first unit — the
deployment-docs repair (agent half ≈1–1.5 work sessions; Q9), with
the owner task it splits off (capturing the seven lighting-scene
definitions from the live machine) scheduled at the owner's pace.
In parallel, owner-paced: extending and walking the merge train.

Estimating rule for every figure below: a unit shows its cost only
where a ratified estimate exists; otherwise it says "unpriced" and
gets an estimate when its block opens, which the owner approves
before build (the standing pricing rule: program §12.3, reaffirmed
at the tooling-foundation and pages sign-offs). Every dependency
claim below was checked against code (audit, claims 1–2), not taken
from documents.

**Block 1 — the unlock block.** → coherent on main, hardware-proven.
- Extend the merge train table (add the current branch's PR as the
  final vehicle) and walk it (owner-paced).
- **The deployment-docs repair** (new unit): the Appendix C scope.
  Agent half ≈1–1.5 work sessions. The owner half — capturing the
  seven lighting-scene definitions that exist only inside the live
  machine's Home Assistant volume — is an operation against the
  production machine, governed by the frozen-production rule and the
  borrow/restore protocol (r3 §3b); it is the owner's hands, priced
  as owner time, not agent sessions.
- The home hardware pass itself (owner hardware time,
  agent-supported), including the certificate spike.

**Block 2 — the hardening block.** → feeds show-ready. Serves the
is-it-working pain and part of the panel-drift pain. (Historical
name: CS.2–CS.5.) This block delivers:
- The health-state change: the third health word (dormant) joins
  healthy/down at 42 places in 14 engine files, 3 contract sites, 3
  scanner sites, and 1 test helper.
- The supervisor: restart a crashed service a bounded number of
  times, detect restart loops, then stop and escalate with a verb
  on the fault row. Today the engine retries every 3 seconds,
  forever, silently.
- Sticky dormancy with its two doors, and the session-start gate
  with a typed, logged override.
- The GM scanner healing its own stale pack.
- The preflight, shown in the GM scanner's admin panel and runnable
  from the command line, plus the short human checklist for what
  machines cannot see. The command-line half does not exist today.
- A plain host-config file for restart strategies (a tool editor for
  it is later, optional work).
- The block close: the dual-pack end-to-end run and the rig CI both
  green, review, records.
Cost: derived, not separately ratified — the ratified whole-unit
figure is ≈5.5–7 work sessions with roughly 2 spent in the closed
rig-and-core stage; the remainder is re-priced at block open. One
transfer to note: under the old order the pages landed first and
this block inherited the pack-reload integration; this draft
reverses that, so the integration cost moves to the preview block
and this block gets slightly cheaper. Verified: nothing here touches
the authoring tool.

**Block 3 — the truth sweep.** → the panel-drift pain directly.
(New unit: the scanner state-truth sweep.) Audit every path from
engine event to what the admin panel shows, and fix every place the
panel shows something false; each fix gets a test on the rig. Scope
is the store-fed path only — the three renderers that draw from the
transaction path instead are explicitly OUT, or the unit is
unbounded (audit, claim 4). The audit counted the surface: 10
service-state domains; 55 places the backend produces state; the 10
reconnect-restore paths (today an empty section leaves stale state
on screen, and the section-to-domain key mapping is non-uniform —
a real drift risk); the 5 places the client reshapes data (one
renderer drops unknown fields on purpose; one domain has no renderer
at all); the 22 event types the client accepts, checked against the
contract; one forwarded event with no consumer at all. The 5
recorded desync bugs are re-tested, not re-derived: the frozen
panel, the volume-slider cache, the stopped-player volume edge, the
sync-payload omission class, and the health-word change landing
under this sweep. Unpriced pending its census; the audit's guidance:
price on the 5 reshaping adapters and 10 restore guards, not the
domain count. Ordering relative to Block 2 is a stated choice, not
a necessity — recommendation: after the health-state change, so the
sweep pins the final vocabulary (the reverse order is arguable; it
is part of Q2).

**Block 4 — the capture block.** → the reconstruction pain.
(Historical name: the intake half of Track D.) Three deliverables,
not one (audit, claim 1 and its headline surprise):
1. **Capture**: roster before the game; one-tap dictation-friendly
   notes and photo capture during; accusation and whiteboard at the
   end. Touches: the GM scanner (five files, including the event
   ingress list where an unregistered event silently never arrives);
   the game-session model and its validation schema (which today
   silently strips undeclared fields — a known hazard to defuse);
   persistence across restart; delivery in the reconnection payload
   plus its completeness test; the engine's permission tables (the
   pack-side grant exists; the engine side does not); and three
   contracts. Verified: nothing touches the authoring tool.
2. **The session-bundle emitter**: the structured bundle contract
   exists and is tested, but nothing in the engine writes bundles —
   the emitter is owned by no document anywhere. It becomes owned
   here. (Its landing also starts the clock on the report pipeline's
   migration, still owner-paced.)
3. **A photo store**: the engine has no binary upload path at all;
   one must be designed under the privacy defaults (data stays on
   the kit; retention is the owner's per game).
Unpriced. The audit's decisive point, folded into Q3: until
deliverables 2 and 3 are priced, this block's position in the order
cannot be honestly chosen. Wireframes can start any time (already
ratified precedent).

**Block 5 — the preview block.** → previewable. The scanner-UX
pain's design work starts here too.
The Design-workspace pages re-cut, sliced so the preview milestone
comes first. Candidate slice contents (Q7): the pack manager; the
mechanics editor with live verdict badges AND hot-apply — the
ratified floor says the editor and hot-apply are one deliverable,
neither shipped without the other; the rehearse affordance on a
running preview engine; the first-run threshold with the toy pack.
Two governing constraints, stated honestly:
- The UX foundation (`2026-09-04-ux-foundation.md`) has its strategy
  and scope layers ratified, but its structure layer is mid-grill
  with four open decisions (the nav words; Rehearse's shape —
  button, page, or both; Review's first contents; the new-pack
  threshold) and three open map rows (hosted demo; the tech-rider
  view's export; first-run landing). This slice's final contents
  follow that grill; Q7 ratifies the candidate, not the answers to
  those questions.
- The ratified pages rules still bind: all five pages ship in the
  era; every deferred feature gets a named registry row the owner
  approves before build; the re-cut re-prices the unit (the old
  ≈6–7.5 figure predates the foundation and the owner's added
  pages) and the owner signs the new figure before the first page
  builds.
Alongside: the **GM-scanner redesign** (new registry row, §6)
enters design under the same foundation and method — wireframes
against the owner's real show flows; its build is priced and slotted
by its own grill.
This block also inherits the pack-reload integration noted in
Block 2, and the pack-manager stage executes the already-decided
retirement of the last venue-hardware literal in pack content
(ledger row L8 — decision made, debt still in the tree until this
executes).

**Block 6 — the depth-and-close block.**
The rest of the pages set: the strings and theme editor with the
real-device preview the owner ruled IN scope; the show designer with
the true-duration timeline (also ruled IN); the content view; the
hardware/roles editor and the tech-rider view (both owner-ruled into
the era; the rider's export question is one of the foundation's open
rows). The venue side's ratified minimum: the bindings page AND the
thin profile-manager page (list/open/save/version/export-import).
The two loud-fallback retirements the bindings work owns; the pages
unit close (the dual-pack run exercised through the pages); the
ledger sweep; the bounded doc-triage; and the era close record under
the restructured completion gate (Q4).

**Block 7 — later blocks**, chartered in one line each; details at
their own entry grills:
- **Players' phones** (historical: Track E): tap-to-web on the real
  domain and certificate (productionizing what the Block-1 spike
  proves), the receiving experience, device-tier auth, the
  interaction primitives.
- **The second game's modules** (historical: the BILL block):
  compound-scan, contagion, graph scoring, the constellation
  display.
- **Content tooling** (historical: Phase 5): eliminate Notion; the
  full-corpus authoring surface; the media-upload experience; the
  report pipeline moves onto the structured bundle.
- **The release block** → adoptable (§2).

The standing constraints (r3 §2.1–2.6: identity and privacy;
growth without corners; the media model; the design-iteration loop;
platform parity; the engine holds no opinion) carry forward with
their substance unchanged; their wording is modernized to plain
names as one of the §8-authorized edits — never re-adopted as r3's
bytes, which carry the retired shorthand.

---

## 4. What deploying actually buys the run

Against the pinned production system:

| Owner pain | What serves it | Where |
|---|---|---|
| Panel drift | the truth sweep; partial mitigations already on the branch (re-tested, not assumed fixed) | Block 3 (groundwork in Block 2) |
| Is it working | preflight in the panel + human checklist; the supervisor; health verbs; scoreboard liveness as a first-class check | Block 2 |
| Reconstruction | capture + bundle emitter + photo store | Block 4 |
| Mid-game scanner UX | the GM-scanner redesign | design in Block 5, build after its grill |

The honest asymmetry (audit, claim 3): deploying even before the
hardening block buys three production-failure fixes that are already
on the branch — the wall display's typefaces actually rendering (the
CDN silently failed at the offline venue), scoreboard recovery by
page reload (retiring the blank-TV-after-restart failure), and two
score-adjustment bugs fixed. Everything else the run gains comes
from Blocks 2–4. And any deployment, whenever it happens, carries
the sixteen visible changes (Appendix B) with no screen-level tests
covering them — which is what Q8 exists to fix and the venue
rehearsal exists to absorb.

---

## 5. Conflicts adjudicated

The corpus audit found seven internal conflicts. Proposed
resolutions, each an edit this ratification authorizes:

1. **The flat queue line** (r3 §3) is replaced by §3's blocks.
2. **The completion-gate text.** Program §7 still says the
   tier-ladder proof belongs to the era's completion; three later
   records moved it to the next era. Fix: an amendment note on
   program §7 (a note, not a rewrite of the record). The ratified r4
   carries the full completion definition, including the rule r3
   left out: work is not done while any ledger row lacks a named
   executor (see Q4 for where that rule now attaches).
3. **The estimate rollup** (program §9) is superseded by §3's
   per-block figures; §9 gets a pointer note.
4. **The dangling GM-scanner-redesign deferral** becomes a real
   registry row (§6).
5. **"Deploy".** The owner ruled the word for the config tool's
   show-night stage. It is the tool's fourth navigation item, not a
   fifth production-lifecycle stage — CONTEXT.md §5b's four ratified
   stages stand. At the grill, CONTEXT.md gains the Deploy entry
   (Q10) and the UX foundation's navigation question closes to
   match; that document's other open questions stay in its own
   grill.
6. **Ledger row L8** (the bluetooth cue literal): decision RETIRE is
   recorded; the debt itself stays open with its tripwire until the
   pack-manager stage executes it (Block 5). The two documents
   showing the decision as pending get the decided status.
7. **Ledger row L12** (the idle-loop fallback) is refreshed with its
   already-made taxonomy call (dormant) and its assigned flip owner
   (the bindings work, Block 6).

---

## 6. Registry and ledger re-homing

The sixteen rows the audit flagged (its own summary line miscounted
fifteen; the table has sixteen) move as follows:
- Renamed off retired shorthand: 8.1 (the pack-manager media page),
  8.6 (hot-apply → the mechanics-editor stage that owns it).
- Split done-from-remaining: 8.3 (the idle-loop's venue-channel half
  shipped when display surfaces closed; the pack half rides 8.1).
- Decision recorded, debt open: 8.2 / ledger L8 (§5.6).
- Refreshed: ledger L12 (§5.7).
- Trigger timing now follows the cutover decision instead of a
  fixed date: ledger L2, L6, L9.
- Follow moved work: 8.5 and ledger L7 (follow the hardening and
  bindings blocks); 8.10 (the report-pipeline migration clock starts
  at the capture block's bundle emitter — still owner-paced); 8.16
  (the scan-to-video ergonomic form stays with the interaction
  primitives; the standing-cue interim remains available today).
- Milestone homes instead of phase walls: 8.4 (the planning view),
  8.7 (the doc triage → Block 6), 8.13 (the later blocks' entry
  grills).
- New row: **8.17 — the GM-scanner redesign**, under the UX
  foundation's method and vocabulary; design opens in Block 5.

---

## 7. The documentation system (per block, binding forward)

Five parts, generalizing what the current era evolved and fixing its
two defects (code-name vocabulary; history as the only navigation):

1. **Charter** — in the ratified roadmap: who the block serves, what
   they can do after it, which readiness state it advances. Plain
   domain language only.
2. **A living current-state page** — one short document per active
   block, maintained in place, readable in one sitting: done,
   remaining, blocked-on-whom. The owner's entry point. Created for
   the remaining work at ratification (Q11).
3. **Unit design docs** — as today: census, decisions, owner rulings
   inline, execution record appended. This part works.
4. **The record** — the PHASE3-STATUS pattern continues: an
   accreting record whose ledger and registry tables are edited in
   place and whose close records append. Its header states plainly
   that it is the archive, not the entry point.
5. **The ledger** — carried per block, same doctrine and classes.

Vocabulary rule: forward-looking documents use plain domain
language; Appendix A is the alias table; CONTEXT.md carries the
retirement note so the archive stays readable.

---

## 8. Supersessions requiring explicit ratification

Each row overrides previously-ratified text. Ratifying this draft
authorizes the listed edits; the agent executes them at ratification.

| # | Superseded statement | Where it lives | Edit |
|---|---|---|---|
| 1 | "No green-Pi work until after Phase 3 is done"; "the testing ladder starts at Phase-3 close" | r3 §3b (two sites); program §13.8; PHASE3-STATUS final-cutover note | replace with the ladder's hardware-proven state |
| 2 | "No cutover happens mid-run" | r3 §3 | replace with the show-ready decision (Q5) |
| 3 | "D and E are Phase 4 — a clean phase of their own, NOT parallel tracks" | program §7 | amendment note: superseded by the value-ordered blocks |
| 4 | The single all-or-nothing gate on the GM-experience work | r3 §4 | split: capture (Block 4) and the scanner redesign (Blocks 5–6) reach readiness independently |
| 5 | The era's completion as one wall | program §7 + r3 §3 | restructured per Q4 |
| 6 | The roadmap's phase-first organizing axis | r3 authority statement | milestone-first |
| 7 | **The ratified stage order "rig-and-core first, then the pages, then the hardening stages"** | PHASE3-STATUS (C2+C3 ratification); both unit design docs | reversed: hardening before the pages (Q2) — the largest single re-order in this draft |
| 8 | "production is FROZEN until the program completes … ONE coordinated cutover" | program §12.1 | restated: frozen until the show-ready decision; the steady-state rule takes over after any cutover (§2) |
| 9 | The merge train's "owner-driven, post-run" timing | PHASE3-STATUS merge-train note | timing becomes the owner's call at coherent-on-main (Q2 context) |

---

## 9. Questions for the owner grill

**Q1 — The ladder.** Ratify the five readiness states — coherent on
main, hardware-proven, show-ready, previewable, adoptable — by those
names, with the gates as stated in §2?

**Q2 — The big re-order.** Ratify supersession 7: the hardening
block runs before the pages re-cut (reversing the order ratified on
2026-09-04), with the truth sweep after the health-state change
(recommendation; the reverse is arguable)? This is the largest
single change this draft makes to ratified sequence.

**Q3 — The capture block's position.** The audit's decisive point:
its second and third deliverables (the bundle emitter, the photo
store) are unpriced, so ordering it against the preview block now
would be guessing. Recommendation: wireframe and price the capture
block first (cheap, already-permitted work), then decide its slot.
Or: commit its position now and accept the pricing risk.

**Q4 — The completion gate.** Proposal: "Phase 3" remains the era
name for the record; its substantive gates distribute — engine
coherence and the dual-pack proof at coherent-on-main; the authoring
quality bar (all five pages, the ruled-in depth) and the toy-pack
proof close Block 6; and the ledger rule — no work is done while any
ledger row lacks a named executor — gates Block 6's era-close record
specifically, while remaining doctrine everywhere. Ratify or
reshape.

**Q5 — Mid-run deployment.** Ratify show-ready's gate (§2, quoted
criteria) as the standard a Monday–Thursday swap must meet, with the
decision itself remaining yours at that state? Otherwise the swap
waits for the run's end.

**Q6 — Capture sub-scope.** Land roster + notes + accusation first
(fast value, no new storage), photos second (they carry the new
binary store)? Or all four together?

**Q7 — The preview slice.** Ratify Block 5's candidate contents —
the pack manager; the mechanics editor with verdict badges and
hot-apply (one deliverable, per the ratified floor); the rehearse
affordance on the preview engine; the first-run threshold with the
toy pack — as the previewable milestone's slice, with final shape
following the UX foundation's grill and the re-priced estimate
returning for your signature before the first page builds?

**Q8 — Screen baselines.** No test captures what the GM scanner's
screens or the scoreboard draw — exactly where all sixteen visible
changes live. Proposal: capture baseline screen images from the
pinned production release NOW, before further change, then add
screen-capture tests as an add-on to the truth sweep (which already
touches every screen path). No capture infrastructure exists today,
so this gets priced at approval, not assumed cheap.

**Q9 — First unit.** Approve the deployment-docs repair as the first
agent unit (agent half, Appendix C scope, ≈1–1.5 work sessions) —
with its owner half (capturing the seven lighting-scene definitions
from the live machine, under the borrow/restore protocol) scheduled
at your pace? Note: the repaired guide describes the NEW system,
which only becomes deployable once the train is walked — intended,
since the guide's consumer is the green machine.

**Q10 — Vocabulary.** Ratify: the five readiness-state names; the
alias retirement (Appendix A); and the CONTEXT.md additions —
"Deploy" as the config tool's fourth navigation item (not a fifth
lifecycle stage), the readiness-state names, and the alias note?

**Q11 — The documentation system.** Ratify §7, including creating
the living current-state page for the remaining work at
ratification?

**Q12 — Secrets before outside eyes.** The committed env file with a
live Home Assistant token is a MUST-FIX currently anchored to
open-sourcing. Previewable is the first milestone that puts an
outside person in front of the system. Rotate before previewable?
(Recommended.)

---

## Appendix A — alias table (historical name → plain name)

| Historical | Plain name |
|---|---|
| Track A | the pack spine (engine/pack schema + extraction) |
| Track B | the Design-workspace pages (authoring tooling) |
| Track C | the venue layer (profile, resolution, dormancy, bindings) |
| Track D | the GM experience (the capture block + the GM-scanner redesign) |
| Track E | the players'-phones block |
| A1 / A2 / A3 | schemas / runtime pack loading / the extraction slices |
| B0 | the tooling foundation (store, auth, shell) |
| B1–B3, B8, B11, B12 | the game.json block decisions (modes, scoring, groups, lighting roles, clock, surfaces) |
| B4 / B10 | the team-management and player-interaction question batches |
| B9 | the session bundle |
| C1 | the installation-profile schema |
| C2 | the resolution mechanism (resolve()) |
| C3 | dormant-vs-fault semantics |
| "C2+C3" | the resolution-and-hardening unit (one build spanning both) |
| C4 | the venue bindings page |
| O1–O5 | the original open decisions (entity schema, device classes, one-auth, primitives, scan economy) |
| Track E's E1–E5 | spikes; trust plumbing; receiving experience; function-gated API; interaction primitives |
| decision E1/E2/E4/E5 | cue restore; video-completion margin; cues-suspend-at-session-end; the three-segment timeline (COLLIDES with Track E's numbers — always say which) |
| E10 | hot-apply (reload a pack without restarting) |
| slices 0–7, 2b, 3a–3c | the extraction steps (dual-pack gate; modes; rules; tokens v2; strings; formatting; CSS taxonomy; show-control content; clock phases; display surfaces; report wording) |
| the closers / the theme unit | the owner-ruled closer batch; the pack theme unit |
| CS.1–CS.5 | the resolution-and-hardening stages (rig + core; dormancy; supervisor; preflight; close) |
| PS.1–PS.6 | the authoring-pages stages (pack manager; mechanics + hot-apply; strings/theme; show designer; content view; close) |
| BS.1–BS.4 | the tooling-foundation stages |
| S1 / S2 | the NFC spike (passed); the certificate spike (open) |
| Stage A / B / C | the testing ladder: CI + containers / the home hardware pass / the venue rehearsal |
| BILL | the owner's second game (design track open now, owner-paced) |
| R1–R5, P-a–P-d | retired draft-internal codes from r4.0; the plain names above replaced them |

Caution for archive readers: the UX foundation's research section
uses B1–B7, O1–O9, H2–H12 as citation keys for three OUTSIDE
research reports (Blender, OBS, Home Assistant). Those are not these
codes. Full census with citations: the corpus audit §4.

## Appendix B — the visible-change list (production → new system)

Sixteen items in five classes. Honest split: thirteen are owner-ruled
changes; one is an unconfirmed regression candidate; two are
internal/non-visible and listed for completeness.

GM scanner wording and identity (ruled):
1. "Team" → "Account" across the interface
2. Award toast now "$150,000 awarded." (the word "points" is gone)
3. Star ratings hidden at three sites
4. Mode colors re-keyed to semantics
5. **Unconfirmed regression candidate:** the transaction-card accent
   border — the old per-mode rule was deleted and no one confirmed
   the replacement renders the same; this is the one item a screen
   test (Q8) would catch
6. New header chrome: mode selector + pack-identity line

Show control the GM operates by name (ruled):
7. Five backbone cues renamed (warning-90min … endgame)
8. Cue lighting is now role-indirect through the profile (degrades
   loudly if unbound)

Scoring behavior (ruled):
9. Negative team scores now legal and rendered
10. Two standalone score-adjustment bugs fixed

Wall scoreboard (ruled):
11. Typefaces now actually render (self-hosted; the CDN silently
    failed at the venue)
12. Auth is a serve-time token; recovery is a page reload (retires
    the blank-TV-after-restart failure)
13. The scoreboard no longer occupies a GM-station slot or device row
14. Kiosk window title changed (functional: the window-finding key)

Non-visible / internal (listed for completeness):
15. Evidence-page cadence now travels with the pack (same values —
    no visible change)
16. Preflight/doc truthfulness fixes (tree fixes, not runtime
    differences)

Checked and cleared — NOT differences (so they are not re-raised):
the session lifecycle's setup state (already in production); the
game-clock phase label (hidden for ALN); the claim announcements
(byte-identical); duplicate detection (unchanged for ALN); report
output (unchanged for normal session names). Full evidence: the
dependency audit, claim 3.

## Appendix C — deployment-docs repair scope (gates hardware-proven)

Write: the Home Assistant install procedure — container, volume, and
the seven scene definitions (OWNER TASK: capture them from the live
machine first; they exist in no repository). Write: the
media-transfer procedure (videos including the idle loop, music,
audio; inventory + verification). Write: the installation-profile
section (what it is, where it lives, what breaks loudly without it).
Write: the machine-preparation gaps (imaging/flash, the Pi-5 video
settings that currently live only in an agent doc, user creation).
Reconcile: ~28 env keys missing from the guide against the template,
plus 5 keys documented nowhere that must be authored from source
(the pack path, the profile path, the scoreboard window marker, the
idle-loop file, the browser binary). Fix: three stale
scoreboard-password sections in the deployment guide, plus one wrong
required-service check in the preflight checklist (a music daemon
the system does not use). Remove: the disable-Bluetooth instruction
that contradicts the system's own speaker support. Add: the
certificate spike's procedure home (the spike itself runs during the
home hardware pass). Full list with citations: the dependency audit,
claim 5.
