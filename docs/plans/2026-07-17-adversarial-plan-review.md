# Adversarial Five-Phase Plan Review — Findings of Record

**2026-07-17 · six independent adversarial lenses (consistency, sequencing,
estimates, operations, Phase-4/5 shape, thesis falsification) run against
the amended plan corpus + code. Owner-requested. Companion to the same-day
forward audit and BILL scoping.**

Every finding was verified against doc:line or file:line evidence by its
reviewer. Convergent findings (found independently by ≥2 lenses) are
marked ⊗. Resolution status: FIXED (applied to the planning docs same
day), SLICE (folded into a named slice's scope in program §3), OWNER
(genuine decision recorded in STATUS awaiting the owner).

## Critical

**R1 ⊗ — One-auth three-way contradiction; backend substrate homeless.**
Program §7 said "paper only"; the one-auth doc §5 says Phase 3 implements
the operator subset; STATUS F4 said Phase 4. Track B's B0.3 (Phase 3)
requires the backend issuance/grant substrate that NO slice owned, and the
slice-3a scoreboard-token pre-fix silently depended on Phase-4 projection.
→ FIXED: §7 now names the Phase-3 operator-tier v1 subset (config-tool
auth + backend function-check/grant substrate as a B0.3-backend item +
scoreboard token with a PLAIN read scope, projection deferred to E4);
STATUS F4 corrected.

**R2 — No rollback path once slice 2 retires the dual-source net; preflight
§4.4 goes stale.** DEPLOYMENT_GUIDE has zero rollback content; the
preflight checklist still REQUIRES the file slice 2 deletes.
→ SLICE 2 scope: pack-rollback runbook (TokenData checkout last-good +
restart, or PACK_PATH pin) + preflight §4.4 rewrite ship in the SAME
commit that retires ledger L1/L2.

## High

**R3 — Slice-1 mode-UI scope trap (gate-blocking).** The GM scanner's mode
surface is a hardwired binary toggle over two literal strings; the toy
pack declares three modes; the dual-pack gate cannot pass slice 1 without
a data-driven selector — and no scope boundary existed, making slice 1
unbounded (Track-D-shaped UX risk).
→ FIXED: boundary statement added to §3 slice 1 (segmented selector
rendered from gameConfig.modes + displayBehavior-driven surfaces; count
ergonomics beyond ~3, theming, and the four-domain redesign stay Track D).

**R4 — Slice 4 (cues→roles) before any resolver/bindings exist would turn
off live lighting.** lightingRoles is read by zero code; unbound role =
disabled cue by design; C4 (binding page) is sequenced AFTER slice 4.
→ FIXED: §3 slice 4 now requires (a) a backend role→scene resolver,
(b) an in-repo fully-bound ALN installation profile, (c) a concrete-id
fallback retained until C4 ships — with a debt-ledger row.

**R5 — tokens.schema v2 was dropped AND falsely claimed as landed.** The
pack-schemas doc asserted "lands as ONE A1 slice with the toy pack
authored natively in v2"; the repo is v1 everywhere ("(xN)" microformat
enforced, toy pack authored in v1); no slice or ledger row owned it.
→ FIXED (false claim corrected) + OWNER: park-vs-slice decision recorded,
bundled with R11 (schema genericization) since both re-open the same file.

**R6 ⊗ — engine.minVersion + schemaVersion enforced by NOTHING; no
migration story.** Found independently by ops and consistency lenses.
→ SLICE 0 scope: version/schema compare joins the capability-gate
skeleton (loud refusal); migration ownership noted in the pack-schemas
addendum (sync pipeline + B0 pack manager).

**R7 ⊗ — Honest estimates ≈2–2.5× the stated numbers.** Calibrated
against A2's actual cost (~2.3–2.7× its estimate — the only track with an
execution record) AND bottom-up slice costing (two methods converge):
remaining Phase 3 ≈ 12–18 sessions vs the stated 5.5–7.5; §7.5 also
arithmetically dropped B0's +1. A disciplined cut set (defer slices 4, 6,
7, 3c-tail; trim B to 3 pages) recovers ≈5–7 sessions → ≈8–11 "gate-
first" without touching the DoD.
→ FIXED (program §9 re-priced with both ranges + the cut-set pointer;
BILL §7.5 corrected) + OWNER: accept honest timeline vs adopt cut set.

**R8 — E2/S2 critical-path trap.** C2's preflight hard-checks a cert only
E2 produces; E2 is gated on the unrun S2 spike; the program never states
whether E2 gates the DoD (asserts both readings).
→ FIXED (default adopted: preflight cert line is WARN-ONLY until E2
lands; E2 remains Phase-3 Track-C infra but does NOT gate the toy-pack
DoD) + OWNER: run S2 (top of owner list), veto the default if E2 should
be a hard gate.

**R9 — No coherence validation (gate ≠ coherence; thesis attack BROKEN).**
The capability gate catches UNSUPPORTED single-field shapes; nothing
planned catches INCOHERENT combinations of supported values (e.g.
scoringPolicy:none + countsTowardGroups:true). The toy pack already
ships a coherence-ambiguous mode (appraise: ledger/none/consuming).
→ SLICE 1/2 scope: named "mode/rule coherence validator" workitem
(dependentSchemas where expressible + contract-suite rule table);
resolve appraise's intent when slice 1 lands.

**R10 — "Editor per slice" contradicted "B0 after slices".** Program §3/§4
said each slice lands WITH its editor; STATUS sequenced B0 after all of
A3; B0 must precede any page.
→ FIXED: the per-slice GATE is the toy pack + dual-pack Tier L; editor
pages follow in Track B after B0. §3/§4 wording amended.

**R11 — tokens.schema.json is overfit to ALN (thesis attack: 1 BROKEN
artifact).** Closed 5-value SF_MemoryType enum + mandatory 1–5
SF_ValueRating + Notion SF_ prefix: a third game's tokens FAIL validation
outright; the BILL scoping itself missed this. The capability-matrix
row marking SF_* "engine-fixed" is the first row to re-litigate.
→ OWNER (bundled with R5): schema genericization (pack-declared category
vocabulary) as a named backlog item; standing BILL-as-review-consumer
gate on every schema change adopted (see R13).

## Medium

**R12 — Fleet skew policy absent during A3.** ⊗ (ops + sequencing).
→ SLICE 0 scope + policy lines adopted: ALN pack keeps mode ids
{blackmarket, detective} through Phase 3; scoring-config.json deletion
ships in the same TokenData pin bump as the slice-2 backend deploy;
assume SW-cached GM scanners lag the backend by up to one event.

**R13 — Extraction has brakes but they're a dead artifact.** The 62-row
engine-fixed list exists and is defended, but no process consults it.
→ FIXED: program §3 gains the living-gate rule — no new slice opens
without citing its capability-matrix rows; reclassification is an
explicit logged decision.

**R14 — A2→main landing process unstated** (foundations is 33+ commits
ahead across 5 repos; "rebase onto main" conflates landing A2 with
cutting slices).
→ FIXED: §11 gains the landing order — submodule PRs first (TokenData →
ALNScanner → PWA → ESP32), then the parent PR bumping all pins to merged
SHAs, then slice branches cut from main.

**R15 — Program §1/§7 oversell the thesis.**
→ FIXED: §1 restated honestly — ALN-class games are data with zero
engine changes (the Phase-3 gate); new mechanical CLASSES ship small
generic pack-parameterized modules; per-game code trends toward zero as
the module library grows.

**R16 — CYD-as-BILL-scanner hardware wrinkle.** Compound-scan accumulation
wants the RF field live exactly when the GPIO-27 mitigation says to kill
it (speaker beeping); compound-scan is new firmware (no_ota = USB
reflash), not pack content.
→ FIXED: recorded in the BILL scoping F8/scanner register.

**R17 — Non-ALN content authoring was a three-word hand-wave.**
→ FIXED: BILL scoping §7.4 now states the real fallback (hand-edit
tokens.json + game.json category block; BYO assets — the NeurAI BMP
generator is ALN-specific) and that SF_* vocabulary remains ALN-flavored
pending R11.

**R18 — Kit network unsized for Phase-4 phone counts.**
→ OWNER note (C1/E2 scope): capacity clause + preflight client-count
check before E3 real load; verify rate-limiter per-IP keying vs NAT.

**R19 — D-track wireframe walkthrough untracked.**
→ FIXED: added to the STATUS owner list (schedulable now; moot if
Phase 4 runs E-first).

**R20 — Backups single-disk; B0 draft store uncovered.**
→ FIXED (DEPLOYMENT_GUIDE off-device data/ rsync line) + B0 requirement
recorded (draft-store location + backup/export in the B0 design).

## Low / cosmetic (all FIXED)

R21 program §6.2 "three ad-hoc systems" → four (matches one-auth doc).
R22 STATUS F2/F4 slice-0-vs-1 self-contradiction corrected.
R23 Ledger L3 trigger clarified (PWA strings scope named).
R24 One-auth: band = game-layer actor selector, not an auth credential
(enrolled station is the auth boundary; band swap = within-ceiling
acts-as, not escalation); §2 session-tier ↔ addendum cross-linked.

## What survived every attack (worth stating)

The A+B+C+toy-gate DoD structure; the A2 as-built architecture (second
consecutive review with zero required changes); the debt-ledger mechanism
(L1's tripwire is load-bearing in three findings); the platform-vs-game-
projects framing; the PACK_PATH seam (now load-bearing for testing,
preview, AND rollback); the capability-gate concept (it needed R6/R9
widening, not replacement).

## Owner decisions (recorded in STATUS)

1. **Timeline posture (R7):** accept honest 12–18 remaining, or adopt the
   cut set (defer slices 4/6/7 + 3c-tail, B to 3 pages) → ≈8–11.
   Note: the cut set defers slice 4, which R4 just made MORE expensive —
   deferral is now the cheaper AND safer option unless pack-authored
   cues are needed for a near-term event.
2. **E2/S2 (R8):** run S2 next (cheap, owner-run, twice-flagged "do
   early"); veto the warn-only-cert default if E2 should hard-gate DoD.
3. **tokens.schema v2 + genericization (R5+R11):** park as a named
   backlog item (recommended — keeps Phase 3 lean; ALN + toy run fine on
   v1) or add as an A3 slice now.
