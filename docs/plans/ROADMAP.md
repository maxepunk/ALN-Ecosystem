# ROADMAP — the full program, Phase 3 through open source

**Status: DRAFT r1 for owner review — 2026-08-29.**
Produced from the 2026-08-29 owner grill (four rounds + corrections, run
under the ratified grilling process) and a full read of the post-Phase-3
corpus (workflows `wf_f2fb3614` ambiguity sweep, `wf_284511f8` corpus
read). Owner rulings recorded here are dated 2026-08-29 unless cited
otherwise.

**Authority.** This document frames the WHOLE arc: what phases exist,
their charters, their audiences, and where every deferral lands. For
Phase 3 internals, `2026-06-11-phase3-program.md` + `PHASE3-STATUS.md`
remain authoritative; on conflict about Phase-3 content, they win. For
everything after Phase 3, THIS document is the index; each phase gets its
own program doc at entry (§9.3).

**Standing rule (new, owner-ratified):** every deferral recorded anywhere
in the corpus must point at a NAMED entry in this roadmap (§8). A
deferral aimed at a phrase ("the media story", "a later slice") is a
defect. The 2026-08-29 ambiguity sweep found four such dangling chains;
§8 re-homes them.

---

## 1. The final outcome (what "done" means)

**The endgame is an open-source show platform** (owner, 2026-08-29):
released to the community as a resource — accessible enough that
game designers who are not particularly technical can author and run
games, with room for technically capable people to extend it further.
Everything below serves that. Interim state: one production (the owner's),
one kit, growing a library of its own games.

What the finished platform looks like, per person:

- **A game designer** authors a complete game as a *pack* — mechanics,
  economy, strings, theme, show cues, content — in the design tool,
  without touching code or config files. They playtest by the
  **design-iteration loop** (§2.4): adjust a parameter, apply, play,
  observe, repeat. ALN's black-market economy and a contagion game's
  seed curves are tuned the same way — they are both just pack blocks.
- **A venue operator / installer** receives a kit (production-owned
  hardware + the pack), fills in an *installation profile* (which
  speakers, which lights, network), binds the pack's abstract roles to
  real instruments on one page, and runs a **one-button preflight**
  that says go/no-go, each line traceable. A *planning view* answers
  "what does bringing X unlock" before packing the van.
- **A GM** runs the show from the scanner's four domains (Game Ops /
  Show Control / Environment / Game Admin), and the post-game report
  assembles itself from intake captured during play instead of being
  reconstructed afterward.
- **A player** taps tokens — on their own phone or on a station —
  with no account, no login, no app install, and no identity unless
  the game's design deliberately creates an identification moment.

**Business shape** (owner, 2026-08-29): one production, one kit,
multiple games on it. A second kit / another operator is a named
possibility, deliberately unplanned — protected by §2.2 so it never
becomes a rewrite. Open-sourcing is the endgame, gated by §7.4.

## 2. Standing constraints (owner-ratified, cross-phase)

These bind every phase and every future design doc.

### 2.1 Identity and player data
1. Players never have accounts. Nothing player-facing ever gets a
   user-facing login — phones and scanners included (2026-08-29,
   reaffirming one-auth P8).
2. The engine's only built-in identity is the device/session id (the
   existing deviceId system, extended to phone sessions in Phase 4).
   **Person-level identity is game policy, never an engine default**:
   a design may add identification moments through whatever its kit
   affords — typed name on personal phones, scanned selector objects
   (bands, character tokens) on shared stations — or omit them
   entirely. "Claim credit" is ONE optional pattern for
   personal-device kits, not a platform posture (2026-08-29
   untangling: a phone is a personal device whose id ≈ a person; a
   CYD is a shared station whose id ≈ equipment — attribution
   affordances legitimately differ by hardware class).
3. Game data stays on the kit unless the owner moves it.
4. Retention of past session data is the owner's call, per game.
These are the privacy defaults every future open-source operator
inherits.

### 2.2 Growth without corners
Phases 3–5 must not hard-code single-kit / single-pack / single-
production assumptions where avoiding them is cheap (owner,
2026-08-29). Checklist for every design doc: pack chosen by path/id
(never assumed singular), profile chosen by path/id, no kit-unique
identifiers baked into engine code, per-kit A-record model, media
bundles portable between orchestrators (§2.3). Multi-pack/multi-kit
FEATURES are operations-era (§7); the SEAMS are now.

### 2.3 The media model
**Media files never live in git packs** (owner, 2026-08-29 — already
the repo's lived convention: videos and music are gitignored,
"deployed/copied separately"). The pack NAMES its media (with hashes);
a managed **media bundle** carries the files — uploadable through the
design tool, portable between orchestrator installs, verified against
the pack's manifest (the ESP32 asset-sync channel is the existing
in-family precedent). Requirements the final tool must meet: (a) a
designer can work through and upload the files their pack needs; (b)
bundles move easily between/onto different orchestrator hardware for
different game instances. Reference-level validation arrives with the
B-pages pack-manager page (§8.1); the full bundle/upload UX is Phase 5
tooling territory (§5); file carriage is OUT of Phase 3 (2026-08-29,
Q10).

### 2.4 The design-iteration loop (first-class platform property)
Making games playtestable without code or config files IS the point of
the engine work (owner, 2026-08-29): edit pack parameters in the tool →
apply → playtest → repeat. Consequences: the B-pages mechanics editor
is the loop's surface; **E10 hot-apply** (re-activate a pack without
orchestrator restart) is named here as the piece that makes the loop
tight rather than restart-per-tweak — scheduled with the B pages era,
design-doc'd when picked up (§8.6).

### 2.5 Platform parity (capabilities, not affordances)
Phone/web clients and CYD/ESP32 scanners maintain parity of ENGINE
CAPABILITIES: both drive the same pack-declared interactions (E5
primitives included — CYD firmware work is committed platform
engineering, not conditional on any one game's design). Parity does
NOT force affordance identity where hardware differs (keyboard,
screen, personal-vs-shared); a game's KIT declares which device
classes players use and each class's role (P3 device-class roles).
Everything a designer iterates on is **pack data, never firmware** —
"never design a mechanic whose iteration loop requires fleet
reflashing" (P6) holds permanently. (2026-08-29; reaffirms the
2026-07-18 "ESP32 is a first-class platform" ruling.)

### 2.6 The engine holds no opinion
Game-design choices (identification, rosters, station scarcity,
tracking policy, more-engagement-is-better) are pack/kit parameters,
never engine defaults (engine-design-notes P1/P3/P8, reaffirmed via
the 2026-08-29 claim-credit untangling).

## 3. Phase 3 — pack spine (IN FLIGHT)

Charter: make ALN-class games data, not code. Authority:
`2026-06-11-phase3-program.md` + `PHASE3-STATUS.md`. Remaining queue:
slice 4 (open, design r2 red-teamed; OQ1–OQ7 answered 2026-08-29) →
slice 6 (minimal reading ratified 2026-08-29: packs select/parameterize
the built-in three surfaces; pack-defined surfaces stay BILL headroom;
matrix row 2.4 reclassification logged at slice open) → slice 7
(bundle schema as engine contract artifact + structured report-wording
block, no template language — ratified 2026-08-29) → theme unit
(boundary ratified 2026-08-29: three GM-scanner display sites for the
star-drop; governed as a full A3 slice) → B0 → B pages → C2+C3 → C4 +
DoD close-out. Phase-3 gate = the dual-pack Tier L run (tier-ladder
proof moved to Phase 4 acceptance — 2026-08-29, Q14).

**Live operations constraint (owner, 2026-08-29):** a weekly Fri–Sun
ALN run is booked **2026-09-18 → 2026-10-18**, running on the
`production-2026-07` pins. The coordinated cutover targets AFTER
2026-10-18 unless the implementation is fully completed and tested in
production conditions sooner; no cutover mid-run. Slice development
continues on the frozen-production train throughout. The owner-driven
merge train (one grand train: submodule PRs → parent stack in slice
order, enumerated in PHASE3-STATUS's Merge-train block — 2026-08-29,
Q19) executes at the owner's pace before cutover.

## 4. Phase 4 — experience (Tracks D + E)

Ratified charter (2026-06-12, sub-gates unchanged since): a clean phase
after the foundation. **D — GM experience**: four-domain UX shipped +
report intake writing B9 bundles (roster at pregame; one-tap
dictation-friendly director notes + photo capture during play;
accusation + whiteboard capture at endgame). Includes the owner-ruled
manual GM phase-advance obligation (Q-5-1). **E — player platform**:
spikes evaluated → go/no-go on tap-to-web (S1 passed 2026-07-17; S2
Cloudflare DNS-01 still open, gates E2); if go: cert/domain (E2) +
receiving experience (E3) + E4 auth model shipped; E5 primitives v1
scoped — the compound-scan engine per BILL's tap grammar, targeting
BOTH platforms per §2.5.

Also in Phase 4: acceptance = the tier ladder (scripted capability
profiles — roster to be enumerated at Phase-4 entry); the L4
teamId→entity wire migration; server-side per-surface projection +
actor-centric resolution (E4 amendments, adopted 2026-07-17); kit
capacity engineering before phone load (R18). **Open by design:**
E-before-D ordering ("an option, not a decision"); and whether
invisible device-tier tokens are worth shipping at all — an owner
decision at Phase-4 entry, constrained by §2.1 (never user-facing).
Phase-4 figures are un-repriced until entry (standing IOU); Phase 4 is
"not months away" (owner, 2026-07-18) — D-track wireframes are
schedulable now.

## 5. Phase 5 — content tooling

Charter (owner, 2026-08-29, replacing the one-line sketch): **back-end
and front-end work that ELIMINATES Notion and makes the interface
better optimized for designing a new game's corpus** — the full
narrative corpus (tokens AND characters, timeline, puzzles, lore), not
tokens only; the GenAI report pipeline becomes the content DB's second
consumer instead of being stranded on Notion. AI-assisted authoring
(NeurAI-class asset generation, voice/snippet authoring at corpus
scale) is in the charter as a direction. Foundations already named in
the corpus: the source-adapter interface (Notion becomes one adapter
during transition — currently unowned work, assigned to Phase-5 entry),
the config-tool content view as the docking point, tokens.schema as the
data spine. The Phase-5 media-bundle upload UX completes §2.3. Detail
design happens at a Phase-5-entry grill session (§9.3); "Phase 5
remains a convenience, never a dependency" for BILL content stands.

## 6. BILL engineering (inside the platform phases)

Owner amendment (2026-08-29, q25): the platform phases deliver ALL the
technology BILL needs, so the owner can finish BILL's DESIGN at his own
pace with no further software engineering — and playtest design options
(contagion math included) through the §2.4 loop if the tech completes
first. Concretely, a **BILL-modules block** joins the committed arc
after Phase 4's E4/E5 (which it builds on): compound-scan engine
(=E5 v1), hidden-state/contagion module, graph game-state + graph
scoring, constellation renderer (plugs into slice 6's surface
mechanism) — all generic, pack-parameterized, tunable in the mechanics
editor. A **toy-constellation pack** is the block's second-consumer
gate (same methodology as the toy-heist pack). **BILL-D** (the design
track: paper/actor prototypes, contagion-math exploration, the
category-grammar "domino" decision that gates token fabrication) is
OPEN NOW, owner-paced, zero engine dependency; the throwaway digital
prototype is declined-by-default with the option preserved. BILL is
networked-only by nature (capability-profile statement, not a problem).

## 7. Operations era (after the platform phases)

"Platform phases end; game projects recur. ALN operations is the
zeroth game project" (ratified framing, 2026-07-17). Named here so its
requirements have an address:

1. **Multi-game kits** (owner, 2026-08-29: real): a kit holds a
   library of installed packs, chosen per event. Interim answer =
   pack selection at activation via the existing path/id seams (§2.2);
   a selection UI is operations-era work. No Phase-3/4/5 slice builds
   the library feature; every slice keeps the seam.
2. **Steady-state releases**: engine updates only between events; pack
   updates any time via publish. Replaces frozen-production after the
   cutover.
3. **Fleet/second-kit growth**: hardware BOM per tier, Pi imaging,
   spares, per-kit identity/A-records, ESP32 reflash logistics —
   unplanned by design (§1 business shape), protected by §2.2.
4. **The open-source gate** (owner north star, 2026-08-29). Before any
   public release: secrets hygiene (the committed `backend/.env` with
   live HOME_ASSISTANT_TOKEN + ADMIN_PASSWORD graduates from the
   someday-list to a MUST-FIX, plus a git-history sweep), a license
   choice, human-facing documentation (designer guide, operator/GM
   runbook — today's docs are agent-oriented), and the §2.1 privacy
   defaults stated for downstream operators. The toy packs are the
   seed of "how to make a game, by example."

## 8. Deferral registry (named landing slots)

Every deferral in the corpus points here. Re-homings ratified
2026-08-29 unless noted.

| # | Deferred item | Landing slot |
|---|---|---|
| 8.1 | Media reference validation + "what this pack needs" surface (F5 videos, slice-4 sounds OQ3, playlists OQ5r, music files F6) | **B-pages pack-manager page** (Phase 3, Track B): reference half. File carriage: §2.3 / Phase 5 upload UX. Program §3 amendment logs the sound/playlist narrowing. |
| 8.2 | Ledger **L8** (ENDGAME `target:"bluetooth"` — preserved diegetic staging, Q9) | Checkpoint at the pack-manager media page: its design must retire L8 (audio roles / re-authoring) or explicitly re-ratify it. |
| 8.3 | `display.idleLoop` pack home (3a partial deferral) | Slice 6 ships it as a venue-channel NAME reference; pack half rides 8.1. |
| 8.4 | Planning view UI (Q16) | Phase-4/5 venue tooling, per the C1 headroom table; C2 may ship a free CLI/JSON face. |
| 8.5 | PR-review residue (a) packLoader behavioral timeout, (b) staging-cache race; + packHash mismatch-warn→enforcement | **C2+C3** (re-homed from the nonexistent "C1 preflight slice"; enforcement decision logged as a C2 design point). |
| 8.6 | E10 hot-apply | B-pages era, as part of the §2.4 loop. |
| 8.7 | 2026-06-18 documentation audit (81 findings) | DoD close-out unit, as a bounded triage (still-open vs superseded, residue listed). |
| 8.8 | Pack-defined NEW display surfaces + constellation renderer | §6 BILL-modules block (renderer); surface-set extensibility stays headroom beyond it. |
| 8.9 | Source-adapter interface (Notion as first adapter) | Phase-5 entry (its named foundation). |
| 8.10 | GenAI pipeline migration to the structured bundle | Owner-paced, after Phase-4 D intake ships; until then ALN's report markdown stays golden-pinned (incl. its ★ parse anchors). |
| 8.11 | Device-tier invisible tokens (yes/no) | Phase-4 entry owner decision, constrained by §2.1. |
| 8.12 | Tier-ladder roster + scripted capability profiles | Phase-4 entry (acceptance instrument). |
| 8.13 | B4 team/player-management elicitation; B10 interaction-space brainstorm | Phase-4 Track D/E entry grills (E5/BILL absorbed part of B10). |
| 8.14 | ESP32 UDP discovery plan | Parked indefinitely (kit-network demoted it to fallback); revisit only on a venue-wifi-primary kit. |
| 8.15 | Second ALN-class game (first consumer of full theming depth etc.) | Operations era; deliberately unnamed today. |

## 9. Sequencing, calendar, method

### 9.1 The committed order
Phase 3 remainder (§3 queue) → cutover (post-2026-10-18 window per §3)
→ Phase 4 (D+E; internal order decided at entry) → BILL-modules block
(§6) → Phase 5 (§5) → operations era (§7) with BILL-D running
owner-paced alongside from now.

### 9.2 The calendar anchor
2026-09-18 → 2026-10-18: weekly ALN run on `production-2026-07`.
Engineering never touches the running production; the cutover waits.

### 9.3 Phase-boundary grill sessions (method, owner-endorsed)
Each phase gets its detailed definition JUST BEFORE its design work
opens — a dedicated grill session producing that phase's program doc
(the corpus stays honest: charters here, detail at entry). Phase-4
entry additionally owes: re-pricing (the ~2× calibration), E-vs-D
ordering, 8.11–8.13.

### 9.4 Record integrity
This roadmap's §8 is the deferral index the DoD close-out audits
against (with PHASE3-STATUS's ledger/residue mechanics). Amendments to
this file are owner-ratified, dated, in place.
