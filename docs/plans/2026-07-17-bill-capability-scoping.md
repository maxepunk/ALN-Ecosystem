# B.I.L.L. Constellation Game — Engine Capability Scoping

**2026-07-17 · input: owner's macro design doc v0.1 · companion to the
2026-07-17 forward audit (PHASE3-STATUS) and the Phase 3 program.**

Purpose: walk BILL's locked machine against what the engine + pack format
can express today, what the roadmap already covers, and what is genuinely
new — so Phase 3/4 build the capabilities a real second game needs, and so
"new code per game" trends toward zero. Verdict up front:

> **BILL is ~40% expressible with Phase 3 as planned, ~35% covered by
> Phase 4 tracks that BILL sharpens into concrete requirements, and ~25%
> genuinely new engine capability — all of it buildable as GENERIC,
> pack-parameterized modules rather than a fork.** Nothing in BILL's
> locked machine contradicts the engine architecture; several Phase 3/4
> designs should absorb small amendments now (listed in §5).

## 1. What runs on the engine as-is (or after planned Phase 3 work)

| BILL element | Engine mapping | Status |
|---|---|---|
| Token corpus (id · category · title · snippet) | tokens.json — category ≈ memory-type axis; title/snippet ≈ summary/lore text | **Today** (tokens v2 structured fields make it cleaner) |
| Category compatibility chart ("the domino") | A pure lookup table — pack DATA (new `game.json` block) | **Schema addition, trivial** — pure data once the grammar is decided |
| Anonymous read (tap token → lore) | The player-scanner flow, verbatim | **Today** (add per-verb tracking-policy flag: BILL reads are untracked; ALN player scans are tracked) |
| Bands (player # + role, NFC) | NFC tokens of a "band" class; existing tag-writer tooling programs them | **Today** (physically); actor identity model is §3 |
| Role NAMES, department naming, corruption fiction, activity designs, escalation tone | Strings/theme/content — pack content | **A3 strings slices** |
| One-hour clock, phases, fixed end | `gameClock` block (already in schema; engine consumption = A3 slice 5 + capability gate) | **Planned** |
| Escalation script, reveal-ceremony staging | CUES — requires the F7 decision (cues become pack content, referencing roles not concrete assets) | **Planned IF F7 lands as "yes"** — BILL is the argument for yes |
| Kit: 3–5 scanners, actor stations, one public screen | The kit/installation-profile model (C1), capability profiles per venue | **Planned** |
| Pack distribution, staleness, session stamping | A2 pack channel, verbatim | **Done** |
| Sessions, WebSocket, device health, show control (music/lighting/sound), persistence | The "venue OS" layer — game-agnostic already | **Done** |

Also worth stating: **BILL is networked-only by nature** (hidden server-side
state + a live public screen require the hub). That is a capability-profile
statement, not a problem — C2's planning view expresses it ("this game
requires the orchestrator tier").

## 2. Where BILL sharpens ALREADY-PLANNED Phase 3/4 work

1. **Modes are proto-verbs (A3 slice 1).** ALN's two transaction modes and
   BILL's eight verbs are the same concept at different sizes: named
   actions with per-action semantics. Slice 1's migration from
   string-matching to semantics flags must keep the flag vocabulary OPEN
   (an extensible `scoringPolicy`/effects model), not re-hardcode a
   two-mode shape with nicer names.
2. **The capability gate (audit F2) is BILL's enabling mechanism.** A BILL
   pack will declare capabilities this engine version lacks
   (`scoring.model: graph`, `contagion`, compound-scan verbs). The gate is
   what makes that SAFE — old engine refuses loudly instead of silently
   running ALN rules on a constellation game. Amendment: add a
   `requires`/capability-declaration block to game.schema.json now (cheap
   schema headroom) so packs can state needs and the gate has one thing to
   read.
3. **Interaction primitives (E5/P6) now have their requirements doc.**
   BILL's tap grammar IS the concrete primitive list Phase 4 was waiting
   on: (a) a compound-scan session (accumulate 1–3 identified objects →
   validate against pack-declared legality → commit atomically),
   (b) actor-role gating, (c) refusal-with-reason feedback. The CYD
   firmware primitive set (P6) should be evaluated against exactly these.
4. **One-auth (E4) needs actor-centric function resolution.** BILL's
   stations are identical; WHO may weave is decided by the scanned BAND,
   not the device. E4's grant model is currently device-centric
   ({tier, class, deviceId, functions}) — amend the design so function
   resolution can take the actor identity presented IN the interaction
   (band scan) as the grant subject, with the device as transport. This is
   a design-doc amendment now, implementation later.
5. **B9 session bundle needs per-game state namespaces.** BILL's session
   state is a graph + epidemic state, not a transaction list. The bundle
   schema (A1/D) should reserve a namespaced per-game-state section rather
   than assuming ALN's shapes.
6. **Server-side per-surface projection.** ALN's scoreboard receives full
   transaction data and filters CLIENT-side. That is fatal for any
   hidden-information game — a browser dev-tools reader could see node
   health and weaver identities. The display/observe path must gain
   server-side projection (each surface receives only what its function
   grants). Belongs to the one-auth/display designs; BILL makes it
   mandatory, and it is good hygiene for ALN too.

## 3. Genuinely NEW engine capabilities BILL requires

All four are generic modules with pack-supplied parameters — none are
BILL-only code, and the capability gate governs their availability.

1. **Compound-scan interaction engine.** Multi-object tap sequences with a
   pack-declared verb table: actor requirement, object-sequence spec,
   legality checks (data-driven where possible: category chart, not-own-
   node, not-revealed-hollow), atomic commit, refusal-with-reason. ALN
   becomes the degenerate case (single-object verbs).
2. **Hidden-state / contagion module.** Per-player and per-token hidden
   flags, transmission rules on interactions (deterministic handling +
   cumulative exposure ramps), seeds, SIRS re-infection, cursed-resource
   mechanics (Healer charges), corrupted-instrument display policies
   (mis-clear / silent-fail as parameterized LIES in role-scoped
   feedback). Parameterized: curve, seed count, which roles can turn.
   Generalizes to any status-propagation mechanic (curses, blessings,
   traits).
3. **Graph game-state + graph scoring model.** Nodes/edges/health,
   largest-connected-component scoring, hollow-zeroes-edges, apparent-vs-
   true score split. Lands as a SECOND scoring model in the gameRules
   library, selected by the pack (`scoring.model`) — the pure-function
   seam built in Phase 2 is exactly the right home.
4. **Constellation renderer.** A new display surface in the renderer
   library (nodes, edges, greyed audited-hollows, component highlight,
   apparent score; never hidden data — fed by §2.6 projection). Selected
   and themed by the pack via B12's surface mechanism.

## 4. On "fork the code for that game"

Recommend against forking — the plugin/library shape above is strictly
better and is what the Phase 2/3 architecture was built for:

- A fork freezes BILL out of every future engine fix (the live-state
  parity fixes, the pack channel, health machinery — all would need
  manual re-porting).
- The engine already has the seams: gameRules is pure and pluggable,
  renderers are a library, cues/functions are declared in the pack, and
  the capability gate makes "this engine can't run that pack" loud
  instead of dangerous.
- "Minimize new code per game" then converges to: **one renderer + zero
  or more rules modules** — and each module built for one game becomes
  free for the next (a third game reusing contagion + tabular scoring
  ships with ZERO new engine code).

## 5. Concrete amendments to adopt now (small, cheap, high-leverage)

1. A3 slice 1: design mode/verb semantics flags as an open vocabulary
   (§2.1).
2. game.schema.json: add the capability-declaration block; wire the F2
   gate to read it (§2.2).
3. E4 one-auth doc: actor-centric function resolution amendment (§2.4).
4. E5 primitive list: adopt BILL's tap grammar as the requirements input
   (§2.3).
5. B9 bundle schema: per-game state namespace (§2.5).
6. Display/one-auth designs: server-side per-surface projection becomes a
   named requirement (§2.6).
7. F5–F8 decisions informed by BILL: **F7 cues-in-pack = YES** (BILL's
   escalation script demands it); F6 music likely YES eventually (Bureau
   soundscape); F5 videos = lower priority for BILL (its public screen is
   live-rendered, not video — though the reveal ceremony may want one);
   F8 ESP32 rebrand matters IF CYDs serve as BILL's scanners (they are
   the natural private-ish feedback stations — P6 firmware primitives +
   a strings-from-SD mechanism would then be worth scoping).

## 6. Toy-pack implications

Keep midnight-heist ALN-shaped for Phase 3 — its job is gating the
extraction of EXISTING mechanics, and overloading it would stall the A3
grind. The BILL-class capabilities get their own second toy when they are
built (a "toy-constellation" pack exercising compound scans, contagion
parameters, and graph scoring at miniature scale — same methodology,
next capability generation). Near-term additions to midnight-heist that
BILL already justifies: grow it to ≥10 distinct-owner tokens (also fixes
the flow-27 audit casualty) and keep its 2-phase clock as the first thing
the slice-5 gate makes real.

## 7. Open questions back to the design

Engine realities that may usefully feed the design's ⬚ registers:
- **Scanner hardware:** CYDs as the identical scanners? Their affordances
  (RFID + small screen + touch, no keyboard) fit the tap grammar; the
  "private-ish screen" is naturally theirs. If instead phones-as-scanners
  (Phase 4 tap-to-web), privacy of feedback changes character.
- **Simultaneous scans (parked edge case):** the compound-scan session
  makes multi-tap sequences per-station serialized; cross-station races
  reduce to ordinary transaction ordering the backend already handles.
- **Band writes:** infection state should live SERVER-side keyed by band
  id (bands stay dumb ids) — supports "carriers don't know," survives
  band swaps/failures, and requires no NFC re-writing mid-game.
