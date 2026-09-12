# ROADMAP — the full program, Phase 3 through open source

**Status: RATIFIED r3 — 2026-08-29 (owner).**
r1 was produced from the 2026-08-29 owner grill (four rounds plus
corrections) and a full read of the post-Phase-3 corpus (workflows
`wf_f2fb3614` and `wf_284511f8`). r2 added §3b (cutover readiness).
r3 is a wording-only revision to the plain-language standard
(`docs/agents/process.md` §4); every ruling, date, and section number
is unchanged. Owner rulings are dated 2026-08-29 unless cited
otherwise.

**Authority.** This document frames the whole arc: which phases exist,
what each phase is for, who each phase serves, and where every deferred
item lands. For Phase-3 internals, `2026-06-11-phase3-program.md` and
`PHASE3-STATUS.md` remain authoritative; if they conflict with this
file about Phase-3 content, they win. For everything after Phase 3,
this document is the index. Each phase gets its own detailed program
document when it opens (§9.3).

**Standing rule (owner-ratified):** every deferral recorded anywhere in
the corpus must point at a named entry in this roadmap (§8). A deferral
that points at a vague phrase ("the media story", "a later slice") is a
defect. The 2026-08-29 ambiguity sweep found four such dangling
deferrals; §8 gives all of them real homes.

---

## 1. The final outcome (what "done" means)

**The end goal is an open-source show platform** (owner, 2026-08-29):
released to the community, usable by game designers who are not very
technical, and extensible by people who are. Everything below serves
that goal. The interim state: one production (the owner's), one kit,
and a growing library of its own games.

What the finished platform looks like, for each person:

- **A game designer** builds a complete game as a *pack* — mechanics,
  economy, text, theme, show cues, content — inside the design tool.
  They never touch code or configuration files. They tune the game
  through the **design-iteration loop** (§2.4): change a value, apply
  it, play, observe, repeat. Tuning ALN's economy and tuning a
  contagion game's spread rate are the same action, because both are
  just pack values.
- **A venue installer** receives a kit (production-owned hardware plus
  the pack). They fill in an *installation profile*: which speakers,
  which lights, which network. On one page they connect the pack's
  abstract names to the real instruments in the room. Then they run a
  **one-button preflight** that answers go or no-go, with every line
  traceable to a specific setting. A *planning view* answers "what
  does bringing hardware X unlock?" before any equipment is packed.
- **A GM** runs the show from the scanner's four domains (Game Ops,
  Show Control, Environment, Game Admin). The post-game report builds
  itself from material captured during play, instead of being
  reconstructed afterward.
- **A player** taps tokens — on their own phone or on a shared
  station. No account. No login. No app install. No recorded identity,
  unless the game's design deliberately creates an identification
  moment.

**Business shape** (owner, 2026-08-29): one production, one kit, many
games on it. A second kit, or another operator, is a named possibility
that we deliberately do not plan for — but §2.2 makes sure we never
build anything that would make that growth expensive later.
Open-sourcing is the end state, gated by §7.4.

## 2. Standing constraints (owner-ratified, all phases)

These rules bind every phase and every future design document.

### 2.1 Identity and player data
1. Players never have accounts. Nothing player-facing ever gets a
   user-facing login — phones and scanners included (2026-08-29,
   reaffirming the one-auth P8 principle).
2. The engine's only built-in identity is the device or session id
   (the existing deviceId system, extended to phone sessions in
   Phase 4). **Person-level identity is game policy, never an engine
   default.** A game's design may add identification moments through
   whatever its hardware supports: a typed name on a personal phone, a
   scanned object (a band, a character token) at a shared station — or
   nothing at all. "Claim-credit" is one optional pattern for
   personal-device games, not a platform rule. (Background: a phone is
   personal, so its id points at a person; a station is shared, so its
   id points at equipment. The two device kinds legitimately support
   different identification affordances.)
3. Game data stays on the kit unless the owner moves it.
4. How long old session data is kept is the owner's decision, per
   game.
These four rules are the privacy defaults that every future
open-source operator inherits.

### 2.2 Growth without corners
Phases 3–5 must not hard-code "one kit, one pack, one production"
assumptions where avoiding them costs little (owner, 2026-08-29).
Checklist for every design document: the pack is selected by path or
id, never assumed to be the only one; the profile likewise; no
kit-unique identifiers inside engine code; the DNS/IP model works
per-kit; media bundles can move between machines (§2.3). Multi-kit and
multi-pack *features* belong to the operations era (§7). The *seams*
that make them possible are built now.

### 2.3 The media model
**Media files never live in git packs** (owner, 2026-08-29 — and this
is already the repo's practice: video and music directories are
excluded from git, marked "deployed/copied separately"). The pack
*names* its media files, with hashes. A managed **media bundle**
carries the actual files. A designer uploads files through the design
tool; a bundle can be checked against the pack's list and moved
between orchestrator machines for different game instances. (The ESP32
asset-sync channel already works this way and is the model.) Two
requirements the final tool must meet: (a) a designer can work through
and upload the files their pack needs; (b) bundles move easily between
machines. Reference-checking arrives with the B-pages pack-manager
page (§8.1). The full upload experience is Phase-5 tooling (§5).
Carrying files inside packs is out of Phase 3 entirely (2026-08-29,
Q10).

### 2.4 The design-iteration loop (a first-class platform property)
Making games playtestable without code or config files IS the point of
the engine work (owner, 2026-08-29). The loop: edit pack values in the
tool → apply → playtest → repeat. Consequences: the B-pages mechanics
editor is the loop's surface, and **E10 hot-apply** (reload a pack
without restarting the orchestrator) is what makes the loop fast
instead of restart-per-change. E10 is scheduled with the B pages
(§8.6).

### 2.5 Platform parity (capabilities, not affordances)
Phone/web clients and CYD/ESP32 scanners stay equal in **engine
capabilities**: both can drive the same pack-declared interactions,
including the E5 interaction primitives. CYD firmware work for this is
committed platform engineering — it does not wait on any one game's
design. Parity does NOT mean identical user interfaces: hardware
differs (keyboard, screen size, personal vs shared), and a game's kit
declares which device classes its players use and what part each
plays. Everything a designer iterates on is **pack data, never
firmware**. The standing principle: never design a mechanic whose
iteration loop requires re-flashing a fleet of devices (P6).
(2026-08-29; reaffirms the 2026-07-18 "ESP32 is a first-class
platform" ruling.)

### 2.6 The engine holds no opinion
Game-design choices — identification, rosters, station scarcity,
tracking policy, whether more engagement is better — are pack and kit
parameters, never engine defaults (engine-design-notes P1/P3/P8,
reaffirmed 2026-08-29).

## 3. Phase 3 — pack spine (IN FLIGHT)

Charter: make ALN-class games data, not code. Authority:
`2026-06-11-phase3-program.md` + `PHASE3-STATUS.md`.

Remaining queue: slice 4 (open; design r3 ratified; owner questions all
answered 2026-08-29) → slice 6 (ruling: packs select and configure the
three built-in display surfaces; new pack-defined surfaces stay future
headroom; matrix row 2.4's reclassification is logged when the slice
opens) → slice 7 (ruling: land the session-bundle schema as an engine
contract, and make report *wording* pack-declared through a structured
block — no template language) → theme unit (ruling: the star-drop
covers the three GM-scanner display sites only; the unit runs as a
full A3 slice) → B0 → B pages → C2+C3 → C4 + DoD close-out.

Phase 3's completion gate is the dual-pack Tier L run. The tier-ladder
proof moved to Phase-4 acceptance (2026-08-29, Q14).

**Live operations (owner, 2026-08-29):** a weekly Friday–Sunday ALN run
is booked **2026-09-18 through 2026-10-18**, on the `production-2026-07`
pinned versions. The cutover happens after 2026-10-18 unless everything
is finished AND tested in production conditions earlier. No cutover
happens mid-run. Slice development continues on the frozen-production
branches throughout. The owner merges the held pull requests in the
recorded order (PHASE3-STATUS, "Merge train") at their own pace before
the cutover.

## 3b. Cutover readiness (blue/green — RATIFIED)

**The cutover is a hardware swap, not an in-place upgrade** (owner,
2026-08-29). A second Pi ("green") is prepared as a complete
production machine and tested while the current production Pi
("blue") keeps running shows, untouched. At the cutover: unplug blue,
plug in green. Green takes the kit router's reserved orchestrator IP
and DNS name, so scanners, tablets, and ESP32s never notice the
machine changed. Rollback is physical and immediate: swap back to
blue, which still holds the entire pre-cutover system.

Commitments: green is built as a real production machine, not a test
box. The preflight checklist is its acceptance gate. After the
cutover, blue stays frozen for at least the first few events, then is
wiped and becomes the standing test device. (A rotating pair of
machines — the first small step toward §7.3, with nothing further
planned.)

**Timing (owner, 2026-08-29): no green-Pi work until after Phase 3 is
done, at the earliest.** The testing ladder therefore starts at
Phase-3 close, not on the show calendar (the cutover was after
2026-10-18 regardless):

- **Stage A (running now, continuously):** CI and containerized
  end-to-end tests (dual-pack Tier L). These prove logic, contracts,
  and parity. They cannot prove anything about hardware.
- **Stage B (at home, after Phase-3 close):** set up the green Pi and
  run a partial-kit test. The setup follows the deployment docs
  exactly; every gap found in the docs is treated as a doc defect.
  (This doubles as a rehearsal of §7.4's "can a stranger stand this
  up" requirement.) Spike S2 — the Cloudflare DNS-01 certificate —
  runs during this setup. Stage B validates what CI cannot: HEVC
  hardware decoding and video output (VLC can report "playing" over a
  black screen), real audio routing and ducking on a real Bluetooth
  speaker, Home Assistant scenes on a real bulb, NFC over HTTPS on a
  real tablet, a full ESP32 asset sync, and on-device pack activation
  plus preflight. Home test equipment (BT speaker, HA-controllable
  bulb, spare ESP32, GM tablet) is available when needed; some pieces
  may be borrowed from ALN stock.
- **Stage C (at the venue, full kit):** the bar the owner set in q24 —
  the full preflight plus a simulated game night in production
  conditions. Off-day sessions are possible using the swap itself:
  unplug blue (leaving it untouched), let green take the reserved IP,
  test against the real kit, then swap back and re-run the preflight
  on blue before leaving. Every Stage-C session is therefore a full
  rehearsal of the real cutover.

**Borrow/restore protocol (owner, 2026-08-29: piece by piece; never a
change that could affect a component's in-game function):** before a
component is borrowed for testing, it gets a one-line entry: safe /
risky / how to restore. The known entries so far — Bluetooth speaker:
SAFE (pairing is stored per computer; pairing with the test Pi cannot
disturb the venue pairing). Smart bulb: RISKY (pairing a venue bulb to
the test Pi's Home Assistant can un-pair it from the venue's — use a
home-owned bulb, never a venue instrument, unless a restore procedure
is proven first). ESP32: REVERSIBLE with a checklist (edit the SD
card's `config.txt` to point at the test Pi and re-sync; to restore,
point it back, re-sync, and confirm the pack identity in the boot log
before it returns to stock).

**Machine state that is not in git** (everything green's setup must
carry over; also the §2.3 media story done once by hand): the OS, PM2,
the WirePlumber drop-in file, SSL certificates, `.env`, the Home
Assistant Docker volume (the `scene.*` definitions live there and in
no repository), and the git-excluded media files (videos, music,
audio). The deployment guide owns the authoritative checklist; gaps
found at Stage B are doc defects.

## 4. Phase 4 — experience (Tracks D + E)

Ratified charter (2026-06-12; sub-gates unchanged since): one clean
phase after the foundation, in two tracks.

**Track D — the GM experience.** Gate: the four-domain UX shipped, and
report intake writing B9 bundles. Intake means: the roster captured
before the game; one-tap, dictation-friendly director notes and photo
capture during the game; the accusation and whiteboard captured at the
end. Includes the owner-ruled manual phase-advance control (Q-5-1).

**Track E — the player platform.** Gate: the spikes are evaluated and
tap-to-web gets a go or no-go (spike S1 passed 2026-07-17; spike S2 is
still open and gates E2). On "go": the real domain and certificate
(E2), the receiving experience (E3), and the E4 auth model ship, and
the E5 interaction primitives get scoped. E5 v1 is the compound-scan
engine, specified by BILL's tap grammar, built for BOTH platforms per
§2.5.

Also in Phase 4: acceptance is the tier ladder (scripted capability
profiles — the tier list gets defined at Phase-4 entry); the L4
teamId→entity wire migration; server-side per-surface projection and
actor-centric permission resolution (the E4 amendments adopted
2026-07-17); and kit capacity work before phone load (R18).

**Open by design, decided at Phase-4 entry:** whether Track E or Track
D runs first; and whether invisible device-tier tokens are worth
shipping at all — an owner decision, bounded by §2.1 (never
user-facing). Phase-4 estimates are known to be understated and get
re-priced at entry. Phase 4 is "not months away" (owner, 2026-07-18);
the D-track wireframes can start any time.

## 5. Phase 5 — content tooling

Charter (owner, 2026-08-29, replacing the earlier one-line sketch):
**back-end and front-end work that eliminates Notion and gives
designers an interface optimized for creating a new game's corpus.**
That means the full narrative corpus — tokens AND characters,
timeline, puzzles, lore — not tokens only. The report pipeline becomes
the content database's second consumer, instead of staying attached to
Notion. AI-assisted authoring (asset generation like the NeurAI images;
voice and snippet authoring at corpus scale) is in the charter as a
direction.

Foundations already named in the corpus: the source-adapter interface
(Notion becomes one replaceable adapter during the transition — this
work is assigned to Phase-5 entry), the config-tool content view as
the docking point, and the token schema as the data spine. The Phase-5
media upload experience completes §2.3. Detailed design happens at a
Phase-5-entry grill session (§9.3). The standing rule "Phase 5 is a
convenience, never a dependency" for BILL content remains true.

## 6. BILL engineering (inside the platform phases)

Owner amendment (2026-08-29, q25): the platform phases deliver ALL the
technology BILL needs, so the owner can finish BILL's *design* at his
own pace with no further software engineering — and can playtest
design options (contagion math included) through the §2.4 loop if the
technology is ready first.

Concretely, a **BILL-modules block** joins the committed sequence after
Phase 4's E4/E5 (which it builds on): the compound-scan engine (= E5
v1), the hidden-state/contagion module, graph game-state and graph
scoring, and the constellation renderer (which plugs into slice 6's
surface mechanism). All of these are generic, pack-parameterized
modules, tunable in the mechanics editor like any other pack values. A
**toy-constellation pack** proves the block the same way toy-heist
proves the current engine.

**BILL-D** — the design track: paper and actor prototypes, contagion
math exploration, and the category-grammar ("domino") decision that
gates token fabrication — is **open now**, owner-paced, with no engine
dependency. The throwaway digital prototype is declined by default;
the option remains available. BILL requires an orchestrator by nature
(hidden server-side state plus a live public screen); that is a
capability-profile statement, not a problem.

## 7. Operations era (after the platform phases)

The ratified frame (2026-07-17): "platform phases end; game projects
recur. ALN operations is the zeroth game project." The era's known
requirements, named here so each has an address:

1. **Multi-game kits** (owner, 2026-08-29: a real requirement): a kit
   holds a library of installed packs and the operator picks one per
   event. Until the selection UI exists, the answer is pack selection
   at startup through the existing path/id seams (§2.2). No Phase
   3–5 slice builds the library feature; every slice keeps the seam
   open.
2. **Steady-state releases**: after the cutover, engine updates happen
   only between events; pack updates can happen any time via publish.
   This replaces the frozen-production rule.
3. **Fleet growth** (a second kit, another operator): hardware lists
   and costs per tier, Pi imaging, spares, per-kit identity and DNS,
   ESP32 re-flash logistics. Deliberately unplanned (§1, business
   shape); protected by §2.2 so it stays cheap to start later.
4. **The open-source gate** (the owner's north star, 2026-08-29).
   Before any public release: secrets hygiene — the committed
   `backend/.env` with a live Home Assistant token and admin password
   is now a MUST-FIX (untrack, rotate, sweep git history), plus a
   license choice, human-facing documentation (a designer guide and an
   operator/GM runbook — today's docs are written for agents), and
   the §2.1 privacy defaults stated for downstream operators. The toy
   packs are the seed of "how to make a game, by example."

## 8. Deferral registry (named landing slots)

Every deferral in the corpus points at an entry here. All re-homings
were ratified 2026-08-29 unless noted.

| # | Deferred item | Landing slot |
|---|---|---|
| 8.1 | Media reference validation and the "what this pack needs" surface (F5 videos, slice-4 sound refs, playlists, music files) | **The B-pages pack-manager page** (Phase 3, Track B) owns the reference half. File carriage: §2.3 and the Phase-5 upload experience. The program-§13 amendment records the sound/playlist narrowing. |
| 8.2 | Ledger **L8** (the ENDGAME `target:"bluetooth"` — preserved as deliberate staging, Q9) | A checkpoint at the pack-manager media page: its design must either retire L8 (audio roles, or re-authoring the cue) or explicitly re-ratify it with a new named point. |
| 8.3 | The idle-loop video's pack home (3a's partial deferral) | Slice 6 ships it as a venue-channel name reference; the pack half rides 8.1. |
| 8.4 | Planning view UI (Q16) | Phase-4/5 venue tooling, per the C1 headroom table. C2 may ship a free command-line version of the same resolver; it does not owe one. |
| 8.5 | PR-review residue items (a) packLoader behavioral timeout and (b) staging-cache race test; plus the packHash mismatch-warn→enforcement change | **C2+C3** (re-homed from a slice name that never existed). The enforcement decision (warn vs refuse) is logged as a C2 design point. |
| 8.6 | E10 hot-apply | The B-pages era, as part of the §2.4 loop. |
| 8.7 | The 2026-06-18 documentation audit (81 findings) | The DoD close-out unit, as a bounded triage: classify still-open vs superseded, record the remainder. |
| 8.8 | Pack-defined NEW display surfaces + the constellation renderer | The §6 BILL-modules block (the renderer); making the surface *set* extensible stays headroom beyond it. |
| 8.9 | The source-adapter interface (Notion as the first adapter) | Phase-5 entry (it is Phase 5's named foundation). |
| 8.10 | The report pipeline's migration to the structured bundle | Owner-paced, after Phase-4 D intake ships. Until then, ALN's report markdown stays byte-pinned by the golden master (including its ★ characters, which the pipeline parses). |
| 8.11 | Invisible device-tier tokens: yes or no | An owner decision at Phase-4 entry, bounded by §2.1. |
| 8.12 | The tier-ladder roster and scripted capability profiles | Phase-4 entry (they are the acceptance instrument). |
| 8.13 | The B4 team/player-management questions; the B10 player-interaction brainstorm | The Phase-4 track-entry grill sessions (E5/BILL already absorbed part of B10). |
| 8.14 | The ESP32 UDP discovery plan | Parked indefinitely (the kit-network decision made it a fallback). Revisit only if a kit ever runs on venue WiFi as primary. |
| 8.15 | A second ALN-class game (the first consumer of full theming depth) | The operations era; deliberately unnamed today. |
| 8.16 | GM-scan video cueing (ratified 2026-09-03, owner): the scan→video trigger is engine-keyed to player scanners — a baked ALN opinion (§2.6 residue); a GM-scanner-only game cannot declare scan→video directly | **Phase-4 E5** (interaction primitives), where scan→consequence mappings become pack-composable. Interim: standing cues (one per token→video pairing) work today as pure pack content — program §14.5. |

## 9. Sequencing, calendar, method

### 9.1 The committed order
Phase 3 remainder (§3 queue) → green-Pi setup and testing Stages B/C
(§3b; starts after Phase-3 close, owner direction) → the cutover
(blue/green swap; after 2026-10-18 per §3) → Phase 4 (D and E; internal
order decided at entry) → the BILL-modules block (§6) → Phase 5 (§5) →
the operations era (§7). BILL-D (design) runs owner-paced alongside
everything, starting now.

### 9.2 The calendar anchor
2026-09-18 through 2026-10-18: weekly ALN shows on
`production-2026-07`. Engineering never touches the running
production. The cutover waits.

### 9.3 Phase-boundary grill sessions (method, owner-endorsed)
Each phase gets its detailed definition just before its design work
opens: a dedicated `grill-with-docs` session that produces that
phase's program document. This file holds only each phase's charter,
audience, and dependencies. Phase-4 entry additionally owes: a
re-pricing (the record shows roughly 2× understatement), the E-vs-D
ordering decision, and items 8.11–8.13.

### 9.4 Record integrity
The §8 registry is the index the DoD close-out audits against
(together with PHASE3-STATUS's ledger and residue mechanics).
Amendments to this file are owner-ratified, dated, and made in place.
