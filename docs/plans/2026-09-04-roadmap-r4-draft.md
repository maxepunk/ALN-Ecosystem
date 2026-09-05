# ROADMAP r4 — DRAFT for the owner grill

**Status: DRAFT (2026-09-04). Not ratified. `ROADMAP.md` (r3) stays
authoritative until the owner grills this document and ratifies it; on
ratification this text replaces `ROADMAP.md` in place and the r3 text
survives in git history.**

Inputs: three owner directives from the 2026-09-04 re-charter sitting
(domain language only; a readiness ladder instead of phase walls;
work re-sequenced by run-value), the four show-night pains the owner
named, and two audits whose full findings are committed beside this
draft: `2026-09-04-recharter-audit-corpus.md` (conflicts, staleness,
the alias census) and `2026-09-04-recharter-audit-dependencies.md`
(code-verified dependency claims). Every open decision is a numbered
question in §9. Nothing here is silently defaulted.

Writing rule (binding on this document and all successors): plain
domain language per `docs/agents/process.md` §4 and CONTEXT.md.
Track letters and item codes are historical names; they appear here
only in parentheses on first mention and in Appendix A.

---

## 1. Why this rewrite exists

Three problems, all owner-diagnosed 2026-09-04:

1. **Two vocabularies.** The plans speak in accreted code names
   (Track D, B9, E10) while the product design speaks the production
   lifecycle (Author, Rehearse, Deploy, Run, Review). The owner
   should never need the letters.
2. **Phase walls instead of decision points.** The corpus assumes
   everything after Phase 3 waits until after the Oct-18 run (eight
   statements, audit §1). That was a default, not a decision. What
   the owner needs is the set of points at which the system is
   technically ready for show-conditions testing, for deployment,
   or for sharing — so timing becomes a series of informed calls.
3. **Sequence by architecture, not value.** The ratified queue
   orders work by dependency history. Re-examined against what
   actually improves running the game versus the frozen production
   machine, the order changes substantially (§3).

The owner's show-night pains, which drive the value ordering:
(P-a) the GM panel drifting out of sync with real state (audio
routing is the named example); (P-b) verifying every component works
(the HDMI scoreboard and the networked scoreboard named); (P-c) the
after-night reconstruction burden — juggling photos and notes while
operating; (P-d) the GM scanner's IA/UX being unhelpful mid-game.

---

## 2. The readiness ladder (the new organizing axis)

Five readiness states. Each has a technical gate. Work advances the
system up the ladder; deployment and sharing decisions are made AT
states, not at phase boundaries.

**R1 — Coherent on main.** The merge train (PHASE3-STATUS, "Merge
train") walked in order; main green on the full suites; the dual-pack
end-to-end run green on main. *Technically ready today*: every train
vehicle is green; the walk is owner-paced. Until R1, `main` ==
`production-2026-07` and the entire program exists only on chained
branches.

**R2 — Show-proven on hardware.** A second machine ("green") built
from the deployment docs and passing Stage B: real video decode and
output, real audio and speaker routing, lighting scenes on a real
bulb, NFC over HTTPS on the tablet, a full hardware-scanner asset
sync, on-device pack activation and preflight. **Blocked today by
the docs, not the code** (audit, claim 5 REFUTED): the deployment
guide has one total gap (Home Assistant — including seven scene
definitions that exist in no repository, only in the venue machine's
container volume), no media-transfer procedure, no installation-
profile section, roughly 28 missing env keys, four sections that
instruct edits to code that no longer exists, and one instruction
that disables Bluetooth on a system that requires it. The repair is
bounded (Appendix C) and is this draft's first proposed unit.

**R3 — Show-deployable for ALN.** R2 plus a full venue rehearsal
(Stage C: an off-day machine swap that is itself a cutover
rehearsal) plus the owner's deployment decision. Two honesty items
gate the decision:
- **The change surface is real.** Sixteen GM- and audience-visible
  differences between production and the new system, in five classes
  (Appendix B) — all owner-ruled improvements ("Account" vocabulary,
  the reworded award toast, hidden star ratings, renamed cues, the
  restyled wall display, negative scores now legal, and more). The
  engine logic is pinned byte-for-byte at eleven tiers, but **no
  golden master exists for any GM screen or the scoreboard's
  rendered output** — the changes live exactly where the pins do not
  reach. Deploying means the GM meets a changed instrument; Stage C
  is where that is rehearsed, not opening night.
- **The mid-run window question.** The run occupies Fridays–Sundays,
  2026-09-18 → 10-18; Mondays–Thursdays are candidate swap windows,
  with the old machine as the physical rollback. The r3 rule "no
  cutover happens mid-run" is superseded by this draft into an
  explicit decision with criteria (§9 Q4).

**R4 — Designer-previewable.** A designer friend can sit down with
the tool, open the toy game, change something, and rehearse it: the
pack manager, the mechanics editor with live verdict badges, the
rehearse button running the preview engine, and the new-pack
threshold. This milestone does not exist in r3 at all. It is the
earliest external-feedback point and is deliberately sequenced ahead
of finishing the full authoring surface.

**R5 — Adoption-ready.** A stranger can stand the platform up and
learn it: the guided setup path, the first-run checklist experience,
the tech-rider export, human-facing designer and operator docs, the
secrets MUST-FIX executed (untrack and rotate the committed env
file), a license, and the privacy defaults stated. This is the
release block — the work the owner's open-source goal gates on
(r3 §7.4), now chartered as a real block instead of a gate list.

---

## 3. The work, re-sequenced by value

Blocks replace the flat queue. Costs are honest per-unit figures
where ratified estimates exist; unpriced units say so and get priced
at block open under the standing price principle. Dependencies are
code-verified (audit, claims 1–2), not doc-claimed.

**Block 1 — Make the ladder climbable.** → R1, R2.
- The merge-train walk (owner-paced; ready).
- **Deployment-docs repair** (new unit): the Appendix C list — one
  Home Assistant install procedure including the seven scenes, one
  media-transfer procedure, one installation-profile section, the
  env-key reconciliation, the four stale sections, the Bluetooth
  contradiction. Est. ≈1–1.5 sessions. Gates R2; should land before
  the green machine is on the bench.
- Stage B itself (owner hardware time, agent-supported).

**Block 2 — The show survives its faults.** → hardens R3. Pains
P-a (partially), P-b. (Historical name: CS.2–CS.5.)
The dormancy lifecycle and health-state change (42 literal sites
across 14 engine files, 3 contract sites, 3 scanner sites); the
supervisor — bounded auto-restart with flap detection, replacing
"retry every 3 seconds forever, silently"; fault rows that carry
verbs; scanner pack self-heal; the preflight presented in the GM
panel and a CLI, with the Host arm for human checks. Ratified
est. ≈2.5–3.5 sessions remaining. **Zero authoring-tool
dependencies** (verified). One ordering coupling, not a dependency:
hot-apply's client reload and self-heal rewrite the same scanner
pack-loading path; whichever lands second does the integration.

**Block 3 — The panel tells the truth.** → P-a directly. (New unit:
the scanner state-truth sweep.) Audit every wiring path from engine
event to rendered pixel and fix the liars, pinning each with an
assertion on the real-services rig: 10 state domains, 55 producer
edges, the 10 restore guards (a falsy section leaves stale state),
the 5 reshaping adapters (one renderer strips unknown fields by
design; one domain has no renderer at all), the 22-entry message
ingress list checked against the contract, and the 5 recorded desync
classes re-tested rather than re-derived (the frozen-panel class,
the volume-slider cache, the stopped-player volume edge among them).
Bounded and enumerable (audit, claim 4). Est. ≈1–2 sessions.
Sequencing: after Block 2's health-state change, since both touch
the health path. Candidate addition: screen-level golden masters for
the GM panel and scoreboard ride this sweep cheaply (§9 Q7).

**Block 4 — The night records itself.** → P-c. (Historical name:
the intake half of Track D.) The audit's biggest correction: this
is **three deliverables, not one** (claim 1 + the surprise):
1. **Capture**: roster before, one-tap dictation-friendly notes and
   photos during, accusation and whiteboard at the end — scanner UI
   plus session fields, with a known validation hazard to defuse
   (the session schema silently strips undeclared fields), grants,
   and three contract amendments. The pack-side grant is already
   authored; nothing touches the authoring tool (verified).
2. **The session-bundle emitter**: the structured bundle contract
   exists and is tested, but **nothing in the engine writes bundles
   today** — the emitter is owned by no phase document. It becomes
   owned here.
3. **A photo store**: the engine has no binary upload path at all;
   one must be designed under the privacy defaults (data stays on
   the kit; retention is the owner's per game).
Unpriced honestly; wireframes first (they can start any time —
that precedent is already ratified). A sub-scope decision is §9 Q5:
roster + notes + accusation land value fast; photos carry the new
store's cost.

**Block 5 — The authoring tool reaches hands.** → R4. Pain P-d's
design work starts here too.
The Design-workspace pages re-cut under the ratified UX foundation,
sliced so the preview milestone comes first: pack manager, mechanics
editor with live badges (the resolve core it consumes is done),
the rehearse button on the preview engine, the new-pack threshold
with the toy game. Alongside: the **GM-scanner IA/UX redesign**
enters design under the same foundation and method (wireframes
against the owner's real show flows) — its build slots after the
grill prices it. The pages unit's ratified estimate (≈6–7.5
sessions) predates the foundation re-cut and the owner-ruled
additions (hardware/roles editor, rider view); the re-cut re-prices
it and the owner re-signs (standing rule).

**Block 6 — Authoring depth and venue close-out.**
The rest of the pages set (strings and theme editor, show designer,
content view, the hardware/roles editor, the tech-rider view with
its export); the venue bindings page with the two loud-fallback
retirements it owns; the ledger sweep; the bounded doc-triage; and
the restructured completion gate (§9 Q3).

**Block 7 — Later blocks, chartered in one line each** (details at
their own entry grills, per the standing method):
- **Players' phones** (historical: Track E): tap-to-web on a real
  domain and certificate, the receiving experience, device-tier
  auth, and the interaction primitives — the certificate spike (S2)
  remains its gate and stays on the owner list.
- **The game-logic modules for the second game** (historical: BILL
  block): compound-scan, contagion, graph scoring, the
  constellation display — after the primitives.
- **Content tooling** (historical: Phase 5): eliminate Notion; the
  full-corpus authoring surface; the media-upload experience; the
  report pipeline moves onto the structured bundle.
- **The release block** → R5 (§2).

Standing constraints carry forward unchanged: the identity and
privacy defaults, growth-without-corners, the media model, the
design-iteration loop, platform parity, and the engine-holds-no-
opinion rule (r3 §2.1–2.6 — re-adopted verbatim into the ratified
r4).

---

## 4. What deploying actually buys the run

Honest summary against the frozen production machine:

| Owner pain | What serves it | Block |
|---|---|---|
| Panel out of sync with reality | state-truth sweep; music/audio self-healing already banked | 3 (2) |
| "Is everything working" | preflight in the GM panel + Host arm; supervisor; health verbs; scoreboard liveness as a first-class line | 2 |
| After-night reconstruction | capture + bundle + store | 4 |
| Mid-game IA/UX | GM-scanner redesign under the foundation | 5→6 |

And the flip side (audit, claim 3): the swap itself delivers a
changed instrument (Appendix B) with no screen-level pins. The
run-value case for deploying during the run is therefore: Blocks
2–3 landed, Stage C rehearsed, change surface walked. Deploying
before Block 2 buys the run almost nothing and carries the change
surface anyway.

---

## 5. Conflicts adjudicated

The corpus audit found seven internal conflicts. Proposed
resolutions, each an edit this ratification authorizes:

1. **The flat queue line** (r3 §3) is replaced by §3's blocks. It
   already contradicted the ratified interleaving before this draft.
2. **The completion-gate text**: the program document's §7 sentence
   still literally contains the tier-ladder clause that three other
   sources agree moved to a later phase. §7 gets the reconciling
   edit (an amendment note, not a rewrite of the record), and the
   ratified r4 carries the full completion definition including the
   ledger-linkage clause that r3 omitted.
3. **The estimate rollup** (program §9) is superseded by §3's
   per-block figures; §9 gets a pointer note.
4. **The dangling GM-scanner-UX deferral** becomes a real registry
   row (§6).
5. **"Deploy"** as the tool's stage word (owner-ruled) enters
   CONTEXT.md §5b at the grill; the UX foundation's nav question
   closes to match (its remaining halves — Design-as-room and
   Review's presence — stay in that document's grill).
6. **Ledger row L8** (the bluetooth cue literal) reads RETIRED —
   the owner already ruled it; two documents still show it open.
7. **Ledger row L12** (the idle-loop fallback) is refreshed with its
   already-made taxonomy call and its assigned flip owner.

---

## 6. Registry and ledger re-homing

The fifteen rows the audit flagged move as follows (historical row
numbers kept for traceability; full reasoning in the audit):
- Rows renamed off retired shorthand: 8.1 (pack-manager media page),
  8.6 (hot-apply → the mechanics-editor stage that owns it).
- Rows already answered: 8.2/L8 → RETIRED; L12 refreshed.
- Rows whose trigger timing follows the cutover decision instead of
  a fixed date: L2, L6, L9.
- Rows that follow moved work: 8.5 and L7 (follow the hardening and
  bindings blocks), 8.10 (the report-pipeline migration trigger now
  fires when Block 4's bundle emitter lands — still owner-paced),
  8.16 (the scan-to-video ergonomic form stays with the interaction
  primitives; the standing-cue interim remains available).
- Rows needing milestone homes instead of phase walls: 8.4 (planning
  view), 8.7 (doc triage → Block 6), 8.13 (the entry grills of the
  later blocks).
- New row: **8.17 GM-scanner IA/UX redesign** — under the UX
  foundation's method and vocabulary; design opens in Block 5.

---

## 7. The documentation system (per block/phase, binding forward)

Five parts, generalizing what Phase 3 evolved and fixing its two
diseases (code-name vocabulary; history-as-navigation):

1. **Charter** — lives in the ratified roadmap: who the block
   serves, what they can do after it, which readiness state it
   advances. Domain language only.
2. **A living current-state page** — one short document per active
   block, maintained in place, readable in one sitting: what is
   done, what remains, what is blocked on whom. The owner's entry
   point. (For the remaining Phase-3-era work, this page gets
   created at ratification.)
3. **Unit design docs** — as today: census, decisions, owner
   rulings inline, execution record appended. This part works.
4. **An append-only record** — the PHASE3-STATUS pattern continues
   for continuity and audits; its header states plainly that it is
   the archive, not the entry point.
5. **The ledger** — carried per block, same doctrine, with the
   class rules already ratified.

Vocabulary rule: forward-looking documents use domain language;
Appendix A is the alias table; CONTEXT.md carries the retirement
note so the archive stays readable.

---

## 8. Supersessions requiring explicit ratification

Named loudly because each overrides a previously-ratified statement:

1. "No green-Pi work until after Phase 3 is done" and "the testing
   ladder starts at Phase-3 close" → replaced by R1/R2 as
   independently reachable states.
2. "No cutover happens mid-run" → replaced by the R3 decision point
   with criteria (§9 Q4).
3. "D and E are Phase 4 — a clean phase of their own, NOT parallel
   tracks" (program §7, ratified 2026-06-12) → superseded by the
   value-ordered blocks; the capture work moves ahead of the
   remaining authoring-tool work.
4. The single all-or-nothing gate on the GM-experience work →
   split: capture (Block 4) and the scanner redesign (Blocks 5–6)
   reach readiness independently.
5. The Phase-3 Definition of Done as one wall → restructured per
   §9 Q3.
6. The roadmap's own organizing axis: phase-first → milestone-first.

---

## 9. Questions for the owner grill

**Q1 — The ladder.** Ratify R1–R5 as the organizing axis, with the
gates as stated in §2?

**Q2 — Block order.** Ratify Blocks 1–7 in §3's order? The one
genuinely contestable call: Block 4 (capture) before Block 5
(designer preview) — capture serves every show night; preview
serves external feedback. Both orderings are defensible; state your
priority.

**Q3 — The completion gate.** The Phase-3 Definition of Done
("Tracks A+B+C plus the toy gate") no longer matches the value
order. Proposal: keep "Phase 3" as the era name for the record;
its substantive gates distribute — engine coherence and the
dual-pack proof at R1, the authoring bar and toy-pack gate close
Block 6, the ledger-linkage clause binds the whole ladder. Ratify
or reshape.

**Q4 — Mid-run deployment posture.** Proposal: a Monday–Thursday
swap is entertainable only when ALL of: R2 complete; Blocks 2–3
landed; one full Stage-C rehearsal done including the rollback
drill; the change surface (Appendix B) reviewed by you as the GM.
Otherwise the swap waits for the run's end. Ratify, tighten, or
loosen.

**Q5 — Capture sub-scope.** Land roster + notes + accusation first
(fast value, no new storage), photos second (they carry the new
binary store)? Or all four together?

**Q6 — Designer-preview content.** Ratify Block 5's R4 slice (pack
manager, mechanics + badges, rehearse button, threshold + toy)?

**Q7 — Screen pins.** Zero golden masters exist for GM screens and
the scoreboard's rendered output, which is where the change surface
lives. Add screen-snapshot pins as a small rider on Block 3?
(Recommended.)

**Q8 — First unit.** Approve the deployment-docs repair as the
first agent-built unit of the new order (it gates R2 and is
Appendix-C bounded)?

**Q9 — Vocabulary.** Ratify the alias retirement (Appendix A) and
the CONTEXT.md captures (Deploy; the readiness-state names; the
alias note)?

**Q10 — The documentation system.** Ratify §7, including creating
the living current-state page for the remaining work at
ratification?

---

## Appendix A — alias table (historical name → plain name)

Track A → the pack spine (engine/pack schema and extraction) ·
Track B → the Design-workspace pages (authoring tooling) ·
Track C → the venue layer (installation profile, resolution,
dormancy, bindings) · Track D → the GM experience (capture +
scanner redesign) · Track E → the players'-phones block ·
A1/A2/A3 → schemas / runtime pack loading / the extraction slices ·
B0 → the tooling foundation (store, auth, shell) · B1–B3, B8, B11,
B12 → the game.json block decisions (modes, scoring, groups,
lighting roles, clock, surfaces) · B4/B10 → the team-management and
player-interaction question batches · B9 → the session bundle ·
C1 → the installation-profile schema · C2 → the resolution
mechanism (resolve()) · C3 → dormant-vs-fault semantics · C4 → the
venue bindings page · O1–O5 → the original open decisions (entity
schema, device classes, one-auth, primitives, scan economy) ·
Track E's E1–E5 → spikes, trust plumbing, receiving experience,
function-gated API, interaction primitives (NOTE: collides with the
decision-record series E1–E5 — say which) · E10 → hot-apply ·
slices 0–7, 2b, 3a–3c → the extraction steps (dual-pack gate;
modes; rules; tokens v2; strings; formatting; CSS taxonomy;
show-control content; clock phases; display surfaces; report
wording) · the closers / theme unit → the owner-ruled closer batch;
the pack theme unit · CS.1–CS.5 → the resolution-and-hardening
stages (rig + core; dormancy; supervisor; preflight; close) ·
PS.1–PS.6 → the authoring pages stages · BS.1–BS.4 → the tooling-
foundation stages · S1/S2 → the NFC and certificate spikes.
Full census with citations: the corpus audit §4.

## Appendix B — the change surface (production → new system, GM/audience-visible)

1 "Team" → "Account" across the GM interface · 2 award toast now
"$150,000 awarded." (the word "points" is gone) · 3–5 star ratings
hidden at three GM sites; mode colors re-keyed; one unconfirmed
accent (transaction-card border) · 6 new header chrome: mode
selector + pack-identity line · 7 five spine cues renamed
(warning-90min … endgame) — the names the GM fires · 8 cue lighting
now role-indirect through the profile (degrades loudly if unbound) ·
9 negative team scores now legal and rendered · 10 two standalone
score-adjustment bugs fixed · 11 wall scoreboard typography now
actually renders (fonts self-hosted; the CDN silently failed at the
venue) · 12 scoreboard auth is a serve-time token; recovery = page
reload (retires the blank-TV-after-restart failure) · 13 the
scoreboard no longer occupies a GM-station slot or device row ·
14 kiosk window title changed · 15 evidence-page cadence now
pack-driven (same values) · 16 preflight/doc truthfulness fixes.
Verified list with citations: the dependency audit, claim 3.

## Appendix C — deployment-docs repair scope (gates R2)

Write: the Home Assistant install procedure (container, volume, the
seven scene definitions that exist in no repository). Write: the
media-transfer procedure (videos including the idle loop, music,
audio; inventory + verification). Write: the installation-profile
section (what it is, where it lives, what breaks loudly without
it). Reconcile: ~28 env keys missing from the guide's block (the
real template has ~40). Fix: four sections instructing edits to
deleted code (the scoreboard password era). Remove: the
`disable bluetooth` contradiction. Add: the certificate spike's
procedure home. Full list with citations: the dependency audit,
claim 5.
