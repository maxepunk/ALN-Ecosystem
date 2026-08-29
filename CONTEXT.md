# CONTEXT.md — the shared vocabulary (root, system-wide)

This file defines the canonical terms for the whole system. When you
name a concept in any output, use the term as it is defined here. Do
not use synonyms.

If a concept you need is not here, stop and check: either you are
inventing language the project does not use, or the glossary has a real
gap. Add missing terms through a `/domain-modeling` session, or flag
them.

Each entry cites the document that owns its definition. If this file
and the cited source disagree, the source wins. Fix this file.

Seeded 2026-08-29 by owner direction. Verified against the corpus
before first commit. Maintained by `grill-with-docs` and
`/domain-modeling` sessions (see `docs/agents/domain.md`). This root
file holds system-wide language only. Components get their own
`CONTEXT.md` files later, when needed.

## 0. The fundamental split (read this first)

The whole program rests on one separation. Learn these five terms
before anything else.

- **Engine** — the game-independent software: the backend orchestrator,
  the GM scanner, the player scanners, the scoreboard, and the
  config-tool. The engine can run any game that fits its implemented
  model. The engine ships capabilities. It holds no opinions about game
  design. (Program §1: "make ALN-class games data, not code.")
- **Game pack (pack)** — the data that defines one game: tokens, rules,
  modes, display text, theme, and show cues. A pack lives in a git
  repository. ALN-TokenData holds the first pack. A pack is small
  (kilobytes). Media files are never stored in a pack (ROADMAP §2.3).
  The pack lists the names of the media files it needs.
- **Media bundle** — the planned carrier for a game's media files
  (video, audio, music). A bundle can be moved between orchestrator
  machines and checked against the file names in the pack. This is a
  ratified direction (ROADMAP §2.3). The checking half arrives in
  Phase 3, on the B-pages pack-manager page (ROADMAP §8.1). Carrying
  and uploading the files is Phase-5 tooling. Until then, media files
  are copied to known directories on the orchestrator (see **asset
  channel**).
- **Kit** — a game as it ships to a venue: the pack, the configuration,
  and the physical hardware the production owns (token objects always;
  optionally a Pi, tablets, scanners, lights, speakers, displays).
  Venues supply no equipment (kit-model decision, 2026-06-11). The kit
  brings its own network.
- **Venue / installation** — the place where a kit is set up for an
  event. Everything specific to the venue — which speakers, which
  Home Assistant scenes, the network details — lives in the
  **installation profile**. Venue details never enter the pack.

Also part of this split:

- **Asset channel** — the current way media reaches a machine: files
  are copied into known directories (for example
  `backend/public/videos`). These directories are excluded from git on
  purpose. The ESP32 scanner's asset-sync download works the same way
  and is the model for the future media bundle.

## 1. Words with more than one meaning — always qualify these

These words each carry several unrelated meanings in this project.
Using them without a qualifier causes real errors. Say which meaning
you intend.

- **"session"** has three project meanings (and one process meaning):
  1. *Game session* — one played game. The backend's `sessionService`
     owns it. Its states are: setup → active → paused ↔ active →
     ended (a paused game resumes; it can end from setup, active, or
     paused). It is saved to disk. Entity scores live inside it.
  2. *Work session* — the unit used in effort estimates (program
     §12.3). One work session is one stage-sized block of focused work
     (see `docs/agents/process.md`, rule 4).
  3. *Session tier* — a Phase-4 authentication tier for player phones.
     A session-tier identity is pseudonymous and needs no credential
     (one-auth doc).
  A fourth, unrelated use — the long-running agent/container session —
  belongs to `docs/agents/process.md`, not to game vocabulary.
- **"mode"** has four meanings:
  1. *Pack mode* — one entry in the pack's `modes[]` list (for
     example ALN's `blackmarket` and `detective`). Each entry declares
     flags: scoring policy, claim behavior, display behavior. The
     engine reads the flags, never the mode's name
     (`gameRules/modeSemantics.js`).
  2. *Deployment mode* — Networked (an orchestrator is present) or
     Standalone (no orchestrator; the device works alone). This is an
     infrastructure choice, not a gameplay choice.
  3. *Display mode* — which picture the venue display shows: the idle
     loop, the scoreboard, or a video. The orchestrator owns this
     state machine (`displayControlService`) and announces changes
     with the `display:mode` event.
  4. *Network mode* — the installation profile's `network.mode`:
     `kit-network` (standard) or `venue-wifi` (fallback).
  Usage note: say "transaction", not "game mode", for a player's
  per-token choice. Both pack modes can occur in the same game
  session (root CLAUDE.md).
- **"role"** has three meanings:
  1. *Lighting role* — a show event name the pack declares (for
     example `police-arrival-2`). The installation profile maps each
     role to a real venue instrument (B8; slice 4).
  2. *Device-class role* — the part a type of hardware plays in one
     game's design (engine-design-notes P3). Example: stations can be
     deliberately scarce; phones are personal.
  3. *Manifest file role* — the kind of a file inside a pack manifest
     (`tokens`, `game`, `strings`, `cues`, …). Set by `roleFor()` in
     the manifest builders.
- **"claim"** has two meanings:
  1. *Consuming claim* — a GM scan that permanently registers a token
     for one entity. The first claim wins; later claims are rejected
     (duplicate policy). A mode may declare `claims: 'non-consuming'`;
     such scans are repeatable and register nothing (ruling D3s2).
  2. *Claim-credit* — an optional interaction where a player chooses
     to identify themselves, for example by typing a name on their own
     phone. It is a game-design pattern, never an engine default
     (ROADMAP §2.1 names it as the personal-device pattern). It is
     carried by the entity field, so the same principle reaches a
     shared station — there, the actor arrives through a scanned
     object such as a band (one-auth R24). ALN already credits a
     named identity at a staffed station in detective mode.
- **"profile"** has two meanings:
  1. *Installation profile* — the venue document defined by C1:
     lighting bindings, installed endpoints, network posture. When
     this project says "the profile," it means this.
  2. *Capability profile* — a scripted description of an install
     tier's hardware, used as input to the resolution mechanism and by
     the test harness to simulate that tier (Phase-4 acceptance).
- **E-numbers** name two unrelated series; always qualify which.
  *Tier-E decisions* (the 2026-06-10 decision record, E1–E11) are
  operational semantics: decision E1 is cue restore (mark past cues
  fired without firing them), E2 the video-completion margin, E4
  cues suspending at session end, E5 the three-segment timeline,
  E10 pack reload without restart. *Track E* (program §3) is the
  player platform: E1 the spikes, E2 the real domain and certificate,
  E3 tap-to-web, E4 the function-gated auth model, E5 interaction
  primitives v1. Say "decision E5" or "Track E's E5" — E1, E2, E4,
  and E5 all collide.
- **"surface"** has two meanings:
  1. *Display surface* — a display output the engine renders: the
     scoreboard, the idle loop, video playback. Slice 6 lets a pack
     select and configure the built-in three. Packs cannot define new
     surfaces yet; that is reserved for the BILL era.
  2. *Mode display surface* — the per-mode `displayBehavior.surface`
     value in `game.json`: where a mode's results land. The engine
     drives exactly `scoreboard-rankings`, `scoreboard-evidence`, and
     `none` today; the gate refuses any other value
     (`ENGINE_MODE_CAPS.surface`).
  For APIs, say "endpoint" or "contract", not "surface".
- **"entity" vs "team"** — the engine's score-holder is an **entity**.
  What an entity represents is defined by each game: a team, a person,
  a wallet, a faction. Each pack declares its own word in
  `entities.label`. ALN's declared label is **Account** (owner ruling
  Q1, built 2026-08-29). "Team" is only the engine's baked fallback
  label, used when a pack declares none. The wire field `teamId` is
  kept only as an alias for the entity field (ledger row L4; it is
  removed in the Phase-4 wire migration).
  One field, two jobs, chosen per mode by `modes[].entityRole`:
  `ledger` means the entity is the wallet the value lands on;
  `attribution` means the entity is the byline credited for the action
  (a default NPC name unless someone claims credit), which flows to
  the report's "Exposed By" column. Attribution is not separate
  machinery. Never add a second attribution field (PHASE3-STATUS,
  "the attribution model").

## 2. The engine ↔ pack contract

- **Activation** — at startup, the backend adopts exactly one pack
  (`packService.activatePack()`). The choice is fixed for the life of
  the process. If someone edits the pack on disk while the process
  runs, the running system ignores the edit. A game session's rules
  therefore never change mid-session (A2).
- **The gate** — the checks that run at activation. If a pack fails a
  check, the backend refuses to start with it. Refusals come in two
  kinds, and messages must say which:
  - **flavor-i, "self-contradictory"** — the pack is internally
    incoherent (duplicate ids, references to things it never
    declares).
  - **flavor-ii, "not driveable by this engine yet"** — the pack is
    coherent, but it needs a capability this engine does not have.
  Gate checks read only the pack's own files. They never contact a
  service and never check whether venue files exist (slice-4 red-team
  findings G1/R2 — services are not running yet at activation time).
- **Capability** — a named ability of the engine, listed in
  `ENGINE_CAPABILITIES`. Names use the form `area.variant` (for
  example `scoring.tabular`). Ids are append-only: adding one is a
  minor engine version; removing one is a major engine version
  (slice-1 D1). A pack lists what it needs in `requires`. If the
  engine lacks a required capability, the gate refuses and names it.
  Capabilities are how a pack's ADDITIVE features stay compatible
  with older engines — additive keys need no version bump (slice-4
  D-4.1). A BREAKING change to the pack format is different: it bumps
  `PACK_SCHEMA_VERSION`, which engine and pack must match exactly
  (slice 2b), and a brand-new flag arrives the same way — schema
  evolution plus a gate rule, never a loosened schema.
- **PACK_PATH** — the environment variable that points the backend at
  an alternate pack directory (`packService.getPackDir()`). It exists
  for testing, preview, and rollback. **PROFILE_PATH** — the same
  injection seam for the installation profile. It is a ratified
  direction only; it lands with `profileService` in the slice-4 build.
  No code reads it today.
- **Shim** — a built-in fallback the engine uses when no pack provides
  a value (for example, a copy of ALN's scoring table). Every shim
  prints a clear warning when it is active, and every shim has a
  ledger row (see §7) naming when it will be removed.
- **Drift tripwire** — a test that compares two things that must stay
  identical (for example: a shim's built-in table against the real
  pack file). If one side changes without the other, the test fails.
  Tripwires run at build/test time, never at boot.
- **Parity surface** — the backend's pure rule functions in
  `src/gameRules/` are the single authority for game rules. The GM
  scanner's standalone implementations must produce the same results.
  When rules change, both sides must be checked.
- **Toy pack** — a small second game (`toy-heist`) kept in the repo
  forever. It proves the engine is generic, serves as a regression
  fixture, and doubles as a worked example of how to make a game.
- **Dual-pack Tier L** — the standing test gate for every slice: the
  full end-to-end suite must pass twice, once with the production pack
  and once with the toy pack.
- **Benign emptiness** — the intended behavior when a pack omits
  optional content: the feature is simply absent, with no warning
  (a pack with no cues has no show control). Contrast with shims,
  which always warn.

## 3. Content and data

- **Token** — a physical game object (NFC tag or QR code) and its data
  entry in `tokens.json`. The entry's key is the token id.
  Caution: the video queue also invents token-like ids from video file
  names when a video has no owning token. Ids seen in `video:*` events
  may therefore not exist in `tokens.json` (slice-4 census §2.1).
- **Strings sidecar** — `strings.json`: the pack's display wording
  (award messages, screen labels, terminology). Its file name is fixed
  by the schema.
- **Groups block** — the section of `game.json` that declares token
  groups and their score multipliers. It is the only source of
  multipliers. In token data, `SF_Group` holds the plain group name.
  The old `"Name (xN)"` suffix format survives only in Notion, as an
  authoring convenience, and only the sync script reads it.
- **Notion authoring format** — the `SF_*` field conventions used
  inside Notion descriptions. Only `sync_notion_to_tokens.py` parses
  them. Phase 5 replaces Notion with an in-house content database.
- **Source adapter** — the planned interface that makes Notion one
  replaceable content source among several. It is the named foundation
  for Phase 5.
- **Theme** — the pack's visual identity file. The theme unit ships a
  minimal version: semantic colors, rating glyph choice, scoreboard
  accent.

## 4. Show control

- **Cue** — a pack-declared set of show actions (lights, sound,
  video). Kinds: a *standing* cue fires when a game event or clock
  time matches its trigger; a *manual* cue is fired by the GM
  (`quickFire` cues appear as buttons in the GM's grid); a *compound*
  cue has a `timeline` of timed steps. A cue with `once: true` fires
  at most one time per game session. Slice 4 moves cues into the pack.
- **Timeline (three-segment model, decision E5)** — how a compound
  cue's clock works. Before its video step: time advances with the
  game clock. During the video: time follows the video's playback
  position. After the video ends: the game clock drives again, with no
  gap. Timeline entries are flat objects: `{at, action, payload}`.
- **Lighting role / binding / fallback** — the pack names a show event
  (the role). The installation profile's `bindings.lighting` maps each
  role to a real scene id. The pack's `lightingRoleFallbacks` block
  holds temporary scene ids used only when no binding exists; every
  such use prints a warning, and the block is scheduled for deletion
  at C4 (ledger row L7, reserved). This whole mechanism is ratified
  design (slice 4); it lands with the slice-4 build. Today ALN's cues
  still name concrete Home Assistant scene ids directly.
- **Held item** — a cue or video that could not run because a needed
  service was down or a video was already playing. The engine parks it
  and tells the GM, who can release or discard it. Nothing is silently
  dropped. Expiry differs by kind today: a held CUE auto-discards
  after 10 seconds (`heldItemsStore`); a held VIDEO has no expiry and
  waits for the GM (`videoQueueService` keeps its own separate hold
  list; unifying the two is backlog).
- **Dormant vs fault** — the health distinction from the kit model.
  *Dormant*: a service has no equipment configured tonight, on
  purpose; this is normal and must never show as an error ("red that
  is always red trains GMs to ignore red"). *Fault*: a service that
  should be running is not; this is an error. ("Down" is the health
  registry's status word; today it covers both cases — that is the
  gap.) The dormant/fault split is ratified doctrine; the engine
  implements it in C2/C3.
- **Service domain / `service:state`** — how the backend tells GM
  clients about service status: one event type carrying
  `{domain, state}` for each of 10 domains (music, video, health, …).
  It is the only push channel for service status.
- **Design-iteration loop** — the platform property (ROADMAP §2.4): a
  designer changes a game value in the tool, applies it, and plays to
  feel the result. No code files, no config files. **Hot-apply
  (E10)** — reloading a pack without restarting the orchestrator — is
  what makes this loop fast. It is scheduled with the B pages.

## 5. Venue, kit, and installation

- **Install tier** — how much of the kit is deployed for one event,
  from the minimum (player scanners and tokens only) to the full rig.
  Every tier must run a legitimate game. Tiers are normal
  configurations, not special cases.
- **Endpoints vs stack** — the two-layer capability model. The
  *stack* is the orchestrator's service software; if the orchestrator
  is present, every stack service is expected to run. *Endpoints* are
  the physical devices (speakers, lights, displays), configured per
  event. A missing stack service is a *fault*; an absent endpoint
  makes its features *dormant* (definitions in §4).
- **Preflight** — the pre-show check: one button produces a go/no-go
  list. Every line traces to a field in the profile or the pack
  manifest. The preflight is the instrument that clears the cutover.
  It is a ratified direction (C1, 2026-08-22), not yet built. Today
  the engine offers per-service health probes (`service:check`) and
  command-level resource validation only.
- **Planning view** — answers "if I bring hardware X, what game
  features does that unlock?" for a hypothetical profile, before
  equipment is packed for an event. The UI for it is scheduled after
  Phase 3 (ROADMAP §8.4).
- **Kit network** — the kit carries its own router and WiFi. The
  orchestrator has one reserved IP address and one public DNS name.
  The **orchestrator Pi** answers that name on the LAN: it runs
  dnsmasq as the network's DNS server. DNS lives on the Pi, never on
  the router. The router only has to provide three things any consumer
  router can: a WPA2 access point, a DHCP reservation for the Pi, and
  a DHCP option handing out the Pi as the DNS server. Swapping routers
  therefore costs three settings. The kit works with no internet
  connection.
- **Blue/green** — the ratified cutover method (ROADMAP §3b). *Green*
  is a second Pi, prepared and tested as a complete production
  machine. *Blue* is the current production Pi, left untouched. The
  cutover is: unplug blue, plug in green; green takes the reserved IP.
  Rolling back means swapping the plugs back.

## 6. Identity and attribution

- **Actor vs device** — a *device* is hardware; its id names the
  machine, not a person. An *actor* is who is acting. On a personal
  phone, the device's session effectively identifies its owner. On a
  shared station, the actor — if the game wants one — arrives through
  a scanned game object such as a band. Permissions resolve for
  actors; the device sets the upper limit (E4).
- **Auth tiers** — three credential levels: *operator* (staff with
  real credentials), *device* (machines; credentials are auto-issued
  and invisible — never a login), *session* (player phones;
  pseudonymous). Players and scanners never get user-facing logins.
  This is a standing constraint (ROADMAP §2.1).
- **The floor** — three functions are always operator-only: session
  lifecycle, show control, and score intervention. A pack may assign
  any other function to lower tiers (owner-fixed, 2026-07-09). Today
  the floor is locked structurally by the pack schema
  (`game.schema.json` pins the floor functions to `["staffed"]`) and
  checked by a contract test at authoring time. The activation gate
  does not read the `functions` block, and no runtime check enforces
  function assignment yet. Issuance-time and execution-time
  enforcement arrive with the auth work (Phase 3 builds only the
  operator-tier subset — program §13.6).
- **Pseudonymous default** — the engine's only built-in identity is
  the device or session id. Whether a person is ever named is each
  game's design choice, never an engine requirement.

## 7. Process vocabulary

- **Slice** — one unit of the Phase-3 extraction work. Each slice
  moves one feature group from engine code into pack data. Every slice
  follows the same sequence: census → design → red-team → build →
  adversarial review → close record.
- **Census** — the fact-finding step before design: an inventory of
  the code and content the slice will touch. Counts in a census are
  not trusted until a second, independent check confirms them.
- **Red team** — an adversarial review of a *design document* before
  any code is written. Reviewers must prove each objection with file
  and line citations.
- **Refuters** — reviewers who adversarially check *findings* during
  post-build review. Their job is to disprove each reported defect; a
  finding survives only if it withstands them.
- **Stage (S-unit)** — one build step inside a slice (S1, S2, …). The
  stage is the unit of continuity. A stage is done only when: all
  tests pass, the work is committed and pushed, and the record is
  updated (`docs/agents/process.md`, rule 1).
- **Slice train** — how slice branches relate: each new slice branch
  starts from the previous slice's verified tip. Each slice gets a
  draft pull request so CI runs on every push. Nothing merges until
  the owner runs the **merge train**: the recorded order in which all
  held pull requests merge (submodule repos first, then the parent
  stack — see PHASE3-STATUS, "Merge train").
- **Frozen production** — no deployments to the live system until the
  coordinated cutover. Live shows run on the `production-2026-07`
  pinned versions.
- **Cutover** — the one coordinated deployment that ends frozen
  production. Its method is the blue/green Pi swap (§5). Its checklist
  lives in PHASE3-STATUS, "Final cutover".
- **Ledger row** — the record of one deliberate temporary construct: a
  description of the debt, the trigger that retires it, a tripwire
  that detects it, and a class (retired / in-queue / post-Phase-3 /
  conditional-watch). Temporary constructs without a ledger row are
  not allowed — that is a definition-of-done violation.
- **Extraction brake (R13)** — a standing rule: no slice may open
  without citing the capability-matrix rows it moves AND confirming
  they are not classified `engine-fixed` or `venue-config`. Changing a
  row's classification is allowed, but only as an explicit, logged
  decision in the slice's design document (row 1.23 was the first).
  The reclassification is recorded in the slice document; in practice
  the matrix file itself stays untouched.
- **Close record / DoD** — the close record is a slice's final
  execution and verification summary in PHASE3-STATUS. The **DoD**
  (definition of done) is Phase 3's ratified completion checklist
  (program §7): Tracks A, B, and C are finished and the dual-pack
  Tier L run passes. (The tier-ladder proof belongs to Phase-4
  acceptance, not Phase 3.) In addition, Phase 3 is not done while
  any ledger row, doc obligation, or residue item lacks a named
  executor (PHASE3-STATUS, "DoD linkage"; the deferral registry in
  ROADMAP §8 is the index).

## 8. ALN vocabulary (pack content — not engine language)

These terms belong to the first game. They appear in engine-adjacent
code only as pack-declared data. This section exists to teach the
boundary.

- **Black Market / Detective** — ALN's two pack modes. Black Market:
  sell a token for currency. Detective: expose a token as public
  evidence. A team chooses per token; both happen in the same game
  session.
- **Memory token / "About Last Night"** — ALN's fiction and content.
- **GM scanner vs player scanner** — two engine-level device kinds (a
  staffed operator device and a player device), listed here because
  the split is often misread as ALN flavor. What each kind may DO is
  not engine law. Today's assignment — GM scans make consuming claims
  and can score; player scans are recorded, never scored, and always
  repeatable; only GM scans are duplicate-checked — is ALN's grant
  table, hardcoded in the engine until E4 makes functions
  pack-assignable per device class (P4; one-auth §1). Another game may
  let a bound station transact.
