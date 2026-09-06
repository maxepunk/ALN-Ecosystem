# ROADMAP — the whole program, by readiness milestones

**Status: RATIFIED r4 — 2026-09-05 (owner).**
r4 replaces r3's phase-first structure with a readiness ladder (§3)
and value-ordered blocks (§4), per the owner's 2026-09-04 directives.
The grill record — twelve ratified questions plus the boot-pain
addition, the nine authorized supersessions, and the seven conflict
adjudications — lives in `2026-09-04-roadmap-r4-draft.md` (§5, §8,
§9), with the two evidence audits beside it
(`2026-09-04-recharter-audit-corpus.md`,
`2026-09-04-recharter-audit-dependencies.md`). r3's text survives in
git history; every r3 ruling not superseded there carries forward
here with its substance unchanged.

**Authority.** This document frames the whole arc: the readiness
states, the blocks of work, and where every deferred item lands. For
the current era's execution detail, `2026-06-11-phase3-program.md`
(as amended) and `PHASE3-STATUS.md` remain the record — the archive,
not the entry point. The owner's entry point is the living
current-state page, `CURRENT-STATE.md`. Each later block gets its
own program document at its entry grill (§10.3).

**Where r3's sections went** (for archived citations): r3 §1 → §1 ·
§2.1–2.6 → §2.1–2.6 (numbers kept) · §3 → §4 + §10 · §3b → §6 ·
§4 → §4 Blocks 4–6 + §7.1 · §5 → §7.3 · §6 → §7.2 · §7 → §7.4 ·
§8 → §8 (row numbers kept) · §9 → §10.

**Standing rule (owner-ratified 2026-08-29, carried):** every
deferral recorded anywhere in the corpus must point at a named entry
in §8. A deferral that points at a vague phrase is a defect.

**Writing rule (binding):** plain domain language per
`docs/agents/process.md` §4 and `CONTEXT.md`. Historical code names
appear only in parentheses on first mention and in Appendix A.

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
Open-sourcing is the end state, gated by the release block (§7.4).

## 2. Standing constraints (owner-ratified, all blocks)

These rules bind every block and every future design document.

### 2.1 Identity and player data
1. Players never have accounts. Nothing player-facing ever gets a
   user-facing login — phones and scanners included (2026-08-29,
   reaffirming the one-auth principle).
2. The engine's only built-in identity is the device or session id
   (the existing deviceId system, extended to phone sessions in the
   players'-phones block). **Person-level identity is game policy,
   never an engine default.** A game's design may add identification
   moments through whatever its hardware supports: a typed name on a
   personal phone, a scanned object (a band, a character token) at a
   shared station — or nothing at all. "Claim-credit" is one optional
   pattern for personal-device games, not a platform rule.
   (Background: a phone is personal, so its id points at a person; a
   station is shared, so its id points at equipment. The two device
   kinds legitimately support different identification affordances.)
3. Game data stays on the kit unless the owner moves it.
4. How long old session data is kept is the owner's decision, per
   game.
These four rules are the privacy defaults that every future
open-source operator inherits.

### 2.2 Growth without corners
No block may hard-code "one kit, one pack, one production"
assumptions where avoiding them costs little (owner, 2026-08-29).
Checklist for every design document: the pack is selected by path or
id, never assumed to be the only one; the profile likewise; no
kit-unique identifiers inside engine code; the DNS/IP model works
per-kit; media bundles can move between machines (§2.3). Multi-kit
and multi-pack *features* belong to the operations era (§7.4). The
*seams* that make them possible are built now.

### 2.3 The media model
**Media files never live in git packs** (owner, 2026-08-29 — and this
is already the repo's practice: video and music directories are
excluded from git, marked "deployed/copied separately"). The pack
*names* its media files, with hashes. A managed **media bundle**
carries the actual files. A designer uploads files through the design
tool; a bundle can be checked against the pack's list and moved
between orchestrator machines for different game instances. (The
hardware scanner's asset-sync channel already works this way and is
the model.) Two requirements the final tool must meet: (a) a designer
can work through and upload the files their pack needs; (b) bundles
move easily between machines. Reference-checking arrives with the
pack-manager page (§8.1). The full upload experience is
content-tooling work (§7.3). Carrying files inside packs is out of
the current era entirely (2026-08-29, Q10).

### 2.4 The design-iteration loop (a first-class platform property)
Making games playtestable without code or config files IS the point
of the engine work (owner, 2026-08-29). The loop: edit pack values in
the tool → apply → playtest → repeat. Consequences: the mechanics
editor is the loop's surface, and **hot-apply** (reload a pack
without restarting the orchestrator; historical: E10) is what makes
the loop fast instead of restart-per-change. The ratified floor: the
editor and hot-apply are one deliverable (§8.6).

### 2.5 Platform parity (capabilities, not affordances)
Phone/web clients and the hardware scanners stay equal in **engine
capabilities**: both can drive the same pack-declared interactions,
including the interaction primitives (§7.1). Hardware-scanner
firmware work for this is committed platform engineering — it does
not wait on any one game's design. Parity does NOT mean identical
user interfaces: hardware differs (keyboard, screen size, personal vs
shared), and a game's kit declares which device classes its players
use and what part each plays. Everything a designer iterates on is
**pack data, never firmware**. The standing principle: never design a
mechanic whose iteration loop requires re-flashing a fleet of
devices. (2026-08-29; reaffirms the 2026-07-18 "the hardware scanner
is a first-class platform" ruling.)

### 2.6 The engine holds no opinion
Game-design choices — identification, rosters, station scarcity,
tracking policy, whether more engagement is better — are pack and kit
parameters, never engine defaults (reaffirmed 2026-08-29).

## 3. The readiness ladder (the organizing axis)

Five readiness states, named in plain words and used by those names
throughout. Each has a technical gate. Deployment and sharing
decisions are made AT states, not at phase boundaries.

One standing rule bridges the states: the frozen-production rule
(CONTEXT.md §7) holds until the owner's show-ready decision — nothing
deploys to the live venue machine; the merge train changes only
`main`. If a cutover happens, the steady-state rule (§7.4) takes
over: engine updates only between events; pack updates any time.

**Coherent on main.** The merge train (the ordered PR table in
PHASE3-STATUS) extended with the newer vehicles (done at
ratification: PR #32 is the final recorded vehicle), **reviewed as
one whole** (ratified, Q1r: a dedicated review of the full train's
combined diff, run by a separate session with fresh context, before
any vehicle merges), and walked in order; `main` green on the full
suites; the dual-pack end-to-end run green on `main`. Today `main`
is still identical to the July production release; everything this
program built lives on chained branches. One honesty note stands:
one older vehicle's CI has never been observed (the train table
flags it — "watch it"). Timing is the owner's call (supersession 9);
the walk is owner-paced.

**Hardware-proven.** A second machine ("green") built from the
deployment docs and passing the home hardware pass (§6, Stage B):
real video decode and output, real audio and speaker routing,
lighting scenes on a real bulb, NFC over HTTPS on the tablet, a full
hardware-scanner asset sync, on-device pack activation, and the
preflight — meaning today's hand-run preflight checklist document;
the in-panel preflight instrument arrives with the hardening block
and upgrades the show-ready gate, not this one. The docs are the
proven blocker (dependency audit, claim 5: only 2 of the 7 required
machine-state areas are fully documented; Home Assistant is entirely
absent); the repair is bounded (Appendix C) and is the first unit
(Q9). The certificate spike (S2) runs during this same setup.

**Show-ready.** The state in which deploying for ALN is a live
choice. Gate (ratified, Q5): (1) hardware-proven; (2) the hardening
block and the truth sweep landed; (3) one full venue rehearsal done
(§6, Stage C — an off-day machine swap, already defined as a full
cutover rehearsal including the swap back); (4) the owner has
reviewed the visible-change list (Appendix B) as the GM. On the
calendar: the run occupies Fridays–Sundays 2026-09-18 → 10-18;
Mondays–Thursdays are the only candidate swap windows, with the old
machine as the physical rollback. This gate is the standard a
mid-run swap must meet; the decision itself remains the owner's at
this state (Q5 — replacing r3's flat "no cutover mid-run").

Why the gate is strict: tests lock the engine's outputs
byte-for-byte at eleven comparison points, but nothing captures what
a GM screen or the scoreboard actually draws — and the sixteen
visible changes between production and the new system (Appendix B)
sit exactly in that untested area. Deploying hands the GM a changed
instrument; the venue rehearsal is where the GM meets it, not
opening night. (Q8's ratified mitigation: capture baseline screen
images from the pinned production release NOW; screen-capture tests
join the truth sweep, priced at approval.)

**Previewable.** A designer friend can sit down with the tool, open
the toy pack, change something, and rehearse it. Reached by the
preview block's slice (Block 5; candidate contents ratified as
candidate, Q7 — final shape follows the UX foundation's grill). This
milestone did not exist in r3; it is the earliest external-feedback
point. A safety rule rides it (Q12 — ratified): the committed env
file's live Home Assistant token and admin password rotate BEFORE
this state — before the first outside person touches the system —
not at open-sourcing.

**Adoptable.** A stranger can stand the platform up and learn it:
the guided setup path, the first-run experience, human-facing
designer and operator docs, the secrets fix executed, a license, the
privacy defaults stated. r3 held these as a bare gate list; the
release block (§7.4) charters them as work with an owner.

**Where "done" lives (ratified, Q4).** The old single finish line
("Phase 3 complete") distributed its three promises: (1) *everything
we built actually merges and passes* — proven at coherent-on-main;
(2) *the authoring tool is genuinely complete* (all five pages at
the ruled-in depth, the toy pack proving the whole path) — closes
Block 6; (3) *no orphaned shortcuts* — the standing rule that we are
never finished while any recorded temporary shortcut lacks a named
executor — applies everywhere at all times and gets one final sweep
when Block 6 closes. That closing sweep is also the moment "Phase 3"
retires into the records as a historical name.

## 4. The work, re-sequenced by value

**The five pains** (owner, 2026-09-04 and -05), with the handles
used below:
- **the panel-drift pain** — the GM scanner's admin panel drifting
  out of sync with real state (audio routing is the named example);
- **the is-it-working pain** — verifying every component works (the
  venue TV scoreboard and the browser scoreboard named);
- **the reconstruction pain** — juggling photos and notes while
  operating, then reconstructing the night afterward;
- **the scanner-UX pain** — the GM scanner's information
  architecture being unhelpful mid-game;
- **the boot pain** — getting from power-on to a running show takes
  a technician: bring the Pi up on the venue TV, open a terminal to
  launch the orchestrator, then hand-walk a pre-show check from the
  scanner. The owner's ask: make the next iteration "a bit more
  plug and play."

**The clock:** the run opens 2026-09-18 and closes 10-18;
Mondays–Thursdays are the only swap windows.

**Estimating rule** for every figure below: a unit shows its cost
only where a ratified estimate exists; otherwise it says "unpriced"
and gets an estimate when its block opens, which the owner approves
before build (the standing pricing rule: program §12.3). Every
dependency claim below was checked against code (dependency audit,
claims 1–2), not taken from documents.

**Block 1 — the unlock block.** → coherent on main, hardware-proven.
- The whole-train review (a separate session with fresh context),
  then the owner walks the merge train (owner-paced).
- **The deployment-docs repair** (first unit, ratified Q9): the
  Appendix C scope. Agent half ≈1–1.5 work sessions. The owner half
  — capturing the seven lighting-scene definitions that exist only
  inside the live machine's Home Assistant volume — is an operation
  against the production machine, governed by the frozen-production
  rule and the borrow/restore protocol (§6); owner time (~20 min,
  read-only), scheduled at the owner's pace.
- **Boot-to-running posture** (the boot pain's first half, Q13): the
  engine already documents a supervised auto-start; making the green
  machine power on straight into a running system is configuration
  plus the guide writing it down — inside the docs repair, not new
  engine code.
- The home hardware pass itself (owner hardware time,
  agent-supported), including the certificate spike.
- Screen baselines (Q8): capture baseline screen images from the
  pinned production release before further change.

**Block 2 — the hardening block.** → feeds show-ready. Serves the
is-it-working pain, part of the panel-drift pain, and the boot
pain's second half. (Historical name: CS.2–CS.5.) Delivers:
- The health-state change: the third health word (dormant) joins
  healthy/down at 42 places in 14 engine files, 3 contract sites, 3
  scanner sites, and 1 test helper.
- The supervisor: restart a crashed service a bounded number of
  times, detect restart loops, then stop and escalate with a verb on
  the fault row. Today the engine retries every 3 seconds, forever,
  silently.
- Sticky dormancy with its two doors, and the session-start gate
  with a typed, logged override.
- The GM scanner healing its own stale pack.
- The preflight, shown in the GM scanner's admin panel and runnable
  from the command line, plus the short human checklist for what
  machines cannot see. The command-line half does not exist today.
  **The honesty rule (ratified, Q13):** the preflight is not one
  instrument and states its own limits on its face. It verifies the
  software chain — services up, files present, the cue wired to its
  video. It cannot verify that tapping a real game token on a
  hardware scanner in the game space actually fires that video on
  the venue TV; that physical tap-through belongs to the human
  checklist and the venue rehearsal. Every reported check carries
  its verdict-depth label (paper vs live) so a GM can see which kind
  of assurance they actually hold.
- A plain host-config file for restart strategies (a tool editor for
  it is later, optional work).
- The block close: the dual-pack end-to-end run and the rig CI both
  green, review, records.
Cost: derived, not separately ratified — the ratified whole-unit
figure is ≈5.5–7 work sessions with roughly 2 spent in the closed
rig-and-core stage; the remainder is re-priced at block open. The
pack-reload integration the old order gave this block moves to the
preview block. Verified: nothing here touches the authoring tool.

**Block 3 — the truth sweep.** → the panel-drift pain directly.
(New unit: the scanner state-truth sweep.) Audit every path from
engine event to what the admin panel shows, and fix every place the
panel shows something false; each fix gets a test on the rig. Scope
is the store-fed path only — the three renderers that draw from the
transaction path instead are explicitly OUT, or the unit is
unbounded (dependency audit, claim 4). The audited surface: 10
service-state domains; 55 places the backend produces state; the 10
reconnect-restore paths (today an empty section leaves stale state
on screen, and the section-to-domain key mapping is non-uniform — a
real drift risk); the 5 places the client reshapes data (one
renderer drops unknown fields on purpose; one domain has no renderer
at all); the 22 event types the client accepts, checked against the
contract; one forwarded event with no consumer at all. The 5
recorded desync bugs are re-tested, not re-derived. Screen-capture
tests join here (Q8). Unpriced pending its census; price on the 5
reshaping adapters and 10 restore guards, not the domain count.
Runs after the health-state change so the sweep pins the final
vocabulary (ratified, Q2).

**Block 4 — the capture block.** → the reconstruction pain.
(Historical name: the intake half of Track D.) Three deliverables,
not one (dependency audit, claim 1):
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
   the emitter was owned by no document anywhere. It is owned here.
   (Its landing starts the clock on the report pipeline's migration,
   still owner-paced — §8.10.)
3. **A photo store**: the engine has no binary upload path at all;
   one must be designed under the privacy defaults (§2.1).
Sub-scope ratified (Q6): roster + notes + accusation land first
(fast value, no new storage); photos second (they carry the new
binary store). Position ratified (Q3): wireframe and price this
block first — its slot against the preview block is decided only
once deliverables 2 and 3 carry real prices. Wireframes can start
any time (already-ratified precedent).

**Block 5 — the preview block.** → previewable. The scanner-UX
pain's design work starts here too.
The Design-workspace pages re-cut, sliced so the preview milestone
comes first. Candidate slice contents (ratified as candidate, Q7):
the pack manager; the mechanics editor with live verdict badges AND
hot-apply (one deliverable, per the ratified floor); the rehearse
affordance on a running preview engine; the first-run threshold with
the toy pack. Two governing constraints:
- The UX foundation (`2026-09-04-ux-foundation.md`) has its strategy
  and scope layers ratified, but its structure layer is mid-grill
  with open decisions (the remaining nav words; Rehearse's shape;
  Review's first contents; the new-pack threshold) and three open
  map rows. This slice's final contents follow that grill; Q7
  ratified the candidate, not the answers to those questions.
- The ratified pages rules still bind: all five pages ship in the
  era; every deferred feature gets a named §8 row the owner approves
  before build; the re-cut re-prices the unit (the old ≈6–7.5 figure
  predates the foundation and the owner's added pages) and the owner
  signs the new figure before the first page builds. The per-page
  rendered-mock gate stands.
Alongside: the **GM-scanner redesign** (§8.17) enters design under
the same foundation and method — wireframes against the owner's real
show flows; its build is priced and slotted by its own grill.
This block inherits the pack-reload integration from Block 2, and
the pack-manager stage executes the already-decided retirement of
the last venue-hardware literal in pack content (ledger L8 —
decision made, debt in the tree until this executes; §8.2).

**Block 6 — the depth-and-close block.**
The rest of the pages set: the strings and theme editor with the
real-device preview the owner ruled IN scope; the show designer with
the true-duration timeline (also ruled IN); the content view; the
hardware/roles editor and the tech-rider view (both owner-ruled into
the era; the rider's export question is one of the foundation's open
rows). The venue side's ratified minimum: the bindings page AND the
thin profile-manager page (list/open/save/version/export-import).
The two loud-fallback retirements the bindings work owns (§8 rows
L7/L12 context); the pages unit close (the dual-pack run exercised
through the pages); the ledger sweep; the bounded doc-triage (§8.7);
and the era close record under the distributed completion gate
(§3, "where done lives").

**Block 7 — later blocks**, chartered in §7; details at their own
entry grills.

## 5. What deploying actually buys the run

Against the pinned production system:

| Owner pain | What serves it | Where |
|---|---|---|
| Panel drift | the truth sweep; partial mitigations already on the branch (re-tested, not assumed fixed) | Block 3 (groundwork in Block 2) |
| Is it working | preflight in the panel + human checklist; the supervisor; health verbs; scoreboard liveness as a first-class check | Block 2 |
| Reconstruction | capture + bundle emitter + photo store | Block 4 |
| Mid-game scanner UX | the GM-scanner redesign | design in Block 5, build after its grill |
| Boot | auto-start posture (in the docs repair); the guided preflight + human checklist | Blocks 1–2 |

The honest asymmetry (dependency audit, claim 3): deploying even
before the hardening block buys three production-failure fixes
already on the branch — the wall display's typefaces actually
rendering (the CDN silently failed at the offline venue), scoreboard
recovery by page reload (retiring the blank-TV-after-restart
failure), and two score-adjustment bugs fixed. Everything else the
run gains comes from Blocks 2–4. And any deployment carries the
sixteen visible changes (Appendix B) — which is what Q8's screen
baselines exist to guard and the venue rehearsal exists to absorb.

## 6. Hardware testing and the cutover method (blue/green — RATIFIED; formerly §3b)

**The cutover is a hardware swap, not an in-place upgrade** (owner,
2026-08-29). A second Pi ("green") is prepared as a complete
production machine and tested while the current production Pi
("blue") keeps running shows, untouched. At the cutover: unplug
blue, plug in green. Green takes the kit router's reserved
orchestrator IP and DNS name, so scanners, tablets, and hardware
scanners never notice the machine changed. Rollback is physical and
immediate: swap back to blue, which still holds the entire
pre-cutover system.

Commitments: green is built as a real production machine, not a test
box. The preflight checklist is its acceptance gate. After the
cutover, blue stays frozen for at least the first few events, then
is wiped and becomes the standing test device.

**Timing (superseded 2026-09-05, supersession 1):** green-machine
work opens with Block 1 — it IS the path to the hardware-proven
state — replacing r3's "no green-Pi work until after Phase 3 is
done." The testing ladder maps to the readiness ladder:

- **Stage A (running now, continuously):** CI and containerized
  end-to-end tests (the dual-pack run). These prove logic,
  contracts, and parity. They cannot prove anything about hardware.
- **Stage B (at home — the hardware-proven gate):** set up the green
  Pi and run a partial-kit test. The setup follows the deployment
  docs exactly; every gap found in the docs is treated as a doc
  defect. (This doubles as a rehearsal of the release block's "can a
  stranger stand this up" requirement.) Spike S2 — the Cloudflare
  DNS-01 certificate — runs during this setup. Stage B validates
  what CI cannot: HEVC hardware decoding and video output (VLC can
  report "playing" over a black screen), real audio routing and
  ducking on a real Bluetooth speaker, Home Assistant scenes on a
  real bulb, NFC over HTTPS on a real tablet, a full
  hardware-scanner asset sync, and on-device pack activation plus
  preflight. Home test equipment (BT speaker, HA-controllable bulb,
  spare hardware scanner, GM tablet) is available when needed; some
  pieces may be borrowed from ALN stock.
- **Stage C (at the venue, full kit — the show-ready gate's
  rehearsal):** the full preflight plus a simulated game night in
  production conditions. Off-day sessions use the swap itself:
  unplug blue (leaving it untouched), let green take the reserved
  IP, test against the real kit, then swap back and re-run the
  preflight on blue before leaving. Every Stage-C session is a full
  rehearsal of the real cutover.

**Borrow/restore protocol (owner, 2026-08-29: piece by piece; never
a change that could affect a component's in-game function):** before
a component is borrowed for testing, it gets a one-line entry: safe
/ risky / how to restore. Known entries — Bluetooth speaker: SAFE
(pairing is stored per computer; pairing with the test Pi cannot
disturb the venue pairing). Smart bulb: RISKY (pairing a venue bulb
to the test Pi's Home Assistant can un-pair it from the venue's —
use a home-owned bulb, never a venue instrument, unless a restore
procedure is proven first). Hardware scanner: REVERSIBLE with a
checklist (edit the SD card's `config.txt` to point at the test Pi
and re-sync; to restore, point it back, re-sync, and confirm the
pack identity in the boot log before it returns to stock).

**Machine state that is not in git** (everything green's setup must
carry over; also the §2.3 media story done once by hand): the OS,
the process supervisor, the WirePlumber drop-in file, SSL
certificates, `.env`, the Home Assistant Docker volume (the scene
definitions live there and in no repository — the Q9 owner task),
and the git-excluded media files (videos, music, audio). The
deployment guide owns the authoritative checklist (Appendix C is the
repair scope); gaps found at Stage B are doc defects.

## 7. The later blocks (charters; details at their entry grills)

### 7.1 Players' phones (historical: Track E / Phase 4)
Tap-to-web on the real domain and certificate (productionizing what
the Block-1 certificate spike proves), the receiving experience, the
device-tier auth model, and the interaction primitives — v1 is the
compound-scan engine, specified by the second game's tap grammar,
built for BOTH platforms per §2.5. Carried rulings: spike S1 passed
2026-07-17; S2 gates the domain/cert work; the auth amendments
adopted 2026-07-17 (server-side per-surface projection,
actor-centric permission resolution) and the entity-field wire
migration (ledger L4) land here; kit capacity work precedes phone
load. Entry decisions (§8.11–8.13): invisible device-tier tokens
yes/no; the acceptance tier ladder; the team/player-management and
player-interaction question batches. Estimates here inherit the
recorded ~2× understatement until re-priced at entry.

### 7.2 The second game's modules (historical: the BILL block)
The compound-scan engine (shared with §7.1), the
hidden-state/contagion module, graph game-state and graph scoring,
and the constellation display (which plugs into the display-surface
seam). All generic, pack-parameterized modules, tunable in the
mechanics editor like any other pack values. A toy-constellation
pack proves the block the way the toy pack proves the current
engine. Carried amendment (owner, 2026-08-29): the platform delivers
ALL the technology the second game needs, so the owner finishes its
*design* at his own pace with no further software engineering — and
can playtest design options through the §2.4 loop. **The design
track is open now, owner-paced,** with no engine dependency: paper
and actor prototypes, contagion math, the category-grammar decision
that gates token fabrication. The game requires an orchestrator by
nature (hidden server-side state plus a live public screen) — a
capability-profile statement, not a problem.

### 7.3 Content tooling (historical: Phase 5)
Charter (owner, 2026-08-29): back-end and front-end work that
eliminates Notion and gives designers an interface optimized for
creating a new game's corpus — the full narrative corpus (tokens AND
characters, timeline, puzzles, lore), not tokens only. The report
pipeline becomes the content database's second consumer instead of
staying attached to Notion. AI-assisted authoring is in the charter
as a direction. Foundations already named: the source-adapter
interface (Notion becomes one replaceable adapter — assigned to this
block's entry, §8.9), the content view as the docking point, the
token schema as the data spine, and the media upload experience that
completes §2.3. The standing rule "content tooling is a convenience,
never a dependency" for the second game remains true.

### 7.4 The operations era and the release block
The frame (2026-07-17): "platform phases end; game projects recur.
ALN operations is the zeroth game project." Named requirements:
1. **Multi-game kits** (a real requirement): a kit holds a library
   of installed packs; the operator picks one per event. Until the
   selection UI exists, the answer is pack selection at startup
   through the existing path/id seams (§2.2).
2. **Steady-state releases**: after a cutover, engine updates happen
   only between events; pack updates can happen any time via
   publish. This replaces the frozen-production rule the moment the
   owner's show-ready decision leads to a deployment.
3. **Fleet growth** (a second kit, another operator): hardware lists
   and costs, Pi imaging, spares, per-kit identity and DNS, scanner
   re-flash logistics. Deliberately unplanned (§1); protected by
   §2.2 so it stays cheap to start later.
4. **The release block** → adoptable (§3). Before any public
   release: secrets hygiene — the committed `backend/.env` with a
   live Home Assistant token and admin password is a MUST-FIX whose
   rotation half is already pulled earlier (before previewable,
   Q12); untrack and sweep git history at latest here — plus a
   license choice, human-facing documentation (a designer guide and
   an operator/GM runbook — today's docs are written for agents),
   and the §2.1 privacy defaults stated for downstream operators.
   The toy packs are the seed of "how to make a game, by example."

## 8. Deferral registry (named landing slots)

Every deferral in the corpus points at an entry here. Row numbers
are stable across r3 → r4; re-homings ratified 2026-09-05 (the grill
record §6 lists them).

| # | Deferred item | Landing slot |
|---|---|---|
| 8.1 | Media reference validation and the "what this pack needs" surface (videos, cue sound refs, playlists, music files) | **The pack-manager page** (Block 5) owns the reference half. File carriage: §2.3 and the content-tooling upload experience (§7.3). The program-§13 amendment records the sound/playlist narrowing. |
| 8.2 | Ledger **L8** (the ENDGAME cue's concrete speaker-target literal in pack content) | **Decision recorded (2026-09-04 pages ratification): RETIRE.** The debt stays open with its tripwire until the pack-manager stage executes it (Block 5). |
| 8.3 | The idle-loop video's pack home | **Split done-from-remaining:** the venue-channel-name half SHIPPED when display surfaces closed (slice 6); the pack half rides 8.1. |
| 8.4 | Planning view UI | A later block (venue tooling depth; milestone home, not a phase wall). The resolver may ship a free command-line presentation earlier; it does not owe one. |
| 8.5 | PR-review residue: (a) packLoader behavioral timeout and (b) staging-cache race test; plus the packHash mismatch handling | **Follows the hardening block** (Block 2): the mismatch question was superseded by the scanner self-heal ruling; the two tests land with that work. |
| 8.6 | Hot-apply (historical: E10) | **The mechanics-editor stage that owns it** (Block 5); one deliverable with the editor, per the ratified floor (§2.4). |
| 8.7 | The 2026-06-18 documentation audit (81 findings) | **Block 6**, as a bounded triage: classify still-open vs superseded, record the remainder. |
| 8.8 | Pack-defined NEW display surfaces + the constellation renderer | The second game's modules (§7.2) own the renderer; making the surface *set* extensible stays headroom beyond it. |
| 8.9 | The source-adapter interface (Notion as the first adapter) | Content-tooling entry (§7.3; it is that block's named foundation). |
| 8.10 | The report pipeline's migration to the structured bundle | Owner-paced; **the clock starts at the capture block's bundle emitter** (Block 4). Until then, ALN's report markdown stays byte-pinned by the golden master (including its ★ characters, which the pipeline parses). |
| 8.11 | Invisible device-tier tokens: yes or no | An owner decision at the players'-phones entry grill (§7.1), bounded by §2.1. |
| 8.12 | The tier-ladder roster and scripted capability profiles | The players'-phones entry grill (§7.1; they are the acceptance instrument). |
| 8.13 | The team/player-management questions; the player-interaction brainstorm | The later blocks' entry grills (§7.1–7.2 absorbed part already). |
| 8.14 | The hardware-scanner UDP discovery plan | Parked indefinitely (the kit-network decision made it a fallback). Revisit only if a kit ever runs on venue WiFi as primary. |
| 8.15 | A second ALN-class game (the first consumer of full theming depth) | The operations era (§7.4); deliberately unnamed today. |
| 8.16 | GM-scan video cueing (ratified 2026-09-03): the scan→video trigger is engine-keyed to player scanners — a baked ALN opinion; a GM-scanner-only game cannot declare scan→video directly | **The interaction primitives** (§7.1), where scan→consequence mappings become pack-composable. Interim: standing cues (one per token→video pairing) work today as pure pack content — program §14.5. |
| 8.17 | **The GM-scanner redesign** (new row, 2026-09-05) — the scanner-UX pain; also carries the GM-experience obligations that are not capture: the manual phase-advance control and phase-relative cue timing (the slice-5 Q-5-1 rulings, "required by full-project completion") | Design opens in **Block 5** under the UX foundation's method and vocabulary (wireframes against the owner's real show flows); build is priced and slotted by its own grill. |
| 8.18 | **Preset-load differential gate** (new row, owner-ratified 2026-09-06; from the fix vehicle's adversarial review, `2026-09-05-train-fix-vehicle.md` §7 item 5) — the config-tool preset load/import gate refuses the WHOLE load when the live pack is gate-invalid for reasons the preset neither causes nor can fix, blocking the env/routing restore the preset does own (and a temp-dir name leaks into the refusal for manifest-less packs). Fix shape: compare the staged verdict against a pre-write verdict of the untouched pack and refuse only NEWLY-introduced problems; seed the staged manifest to preserve packId. | **Block 5** (the config-tool re-cut), beside the fix vehicle's §2.3 deferral group — the block's entry grill prices it with the rest. |

## 9. The documentation system (per block, binding forward)

Five parts, generalizing what the current era evolved and fixing its
two defects (code-name vocabulary; history as the only navigation):

1. **Charter** — in this roadmap: who the block serves, what they
   can do after it, which readiness state it advances. Plain domain
   language only.
2. **A living current-state page** — `CURRENT-STATE.md`: one short
   document per active block, maintained in place, readable in one
   sitting: done, remaining, blocked-on-whom. The owner's entry
   point. Created at ratification (Q11).
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

## 10. Sequencing, calendar, method

### 10.1 The committed order
Block 1 (unlock: train review + walk, docs repair, home hardware
pass) → Block 2 (hardening) → Block 3 (truth sweep) → Blocks 4/5
ordered once the capture block is priced (Q3) → Block 6
(depth-and-close) → the later blocks (§7), each behind its entry
grill. The second game's design track runs owner-paced alongside
everything, starting now (§7.2).

### 10.2 The calendar anchor
2026-09-18 through 2026-10-18: weekly ALN shows on
`production-2026-07`. Engineering never touches the running
production. Any swap meets the show-ready gate and happens only in a
Monday–Thursday window, at the owner's call (§3).

### 10.3 Block-entry grill sessions (method, owner-endorsed)
Each later block gets its detailed definition just before its design
work opens: a dedicated grill session producing that block's program
document. This file holds only charters, audiences, and
dependencies. The players'-phones entry additionally owes a
re-pricing (the record shows roughly 2× understatement) and items
8.11–8.13.

### 10.4 Record integrity
The §8 registry is the index the Block-6 close audits against
(together with PHASE3-STATUS's ledger and residue mechanics).
Amendments to this file are owner-ratified, dated, and made in
place.

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
| Phase 4 / Phase 5 | the players'-phones + GM-experience era / content tooling — dissolved into the blocks and §7 charters |

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
Write: the boot-to-running posture (Q13) — the already-documented
supervised auto-start written into the guide so the machine powers
on straight into a running system; configuration, not new code.
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
