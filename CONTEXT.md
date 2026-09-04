# CONTEXT.md: the shared vocabulary (root, system-wide)

This file defines the canonical terms for the whole system. When you
name a concept in any output, use the term as it is defined here. Do
not use synonyms.

If a concept you need is not here, stop and check: either you are
inventing language the project does not use, or the glossary has a real
gap. Add missing terms through a `/domain-modeling` session, or flag
them.

Each entry cites the document that owns its definition. If this file
and the cited source disagree, the source wins. Fix this file.

Seeded 2026-08-29 by owner direction and verified against the corpus
before first commit. `grill-with-docs` and `/domain-modeling` sessions
maintain it (see `docs/agents/domain.md`). This root file holds
system-wide language only. Components get their own `CONTEXT.md` files
later, when needed.

## 0. The fundamental split (read this first)

The whole program rests on one separation. Learn these five terms
before anything else.

- **Engine.** The game-independent software: the backend orchestrator,
  the GM scanner, the player scanners, the scoreboard, and the
  config-tool. The engine can run any game that fits its implemented
  model. The engine ships capabilities. It holds no opinions about game
  design. (Program §1: "make ALN-class games data, not code.")
- **Game pack (pack).** The data that defines one game: tokens, rules,
  modes, display text, theme, and show cues. A pack lives in a git
  repository, and ALN-TokenData holds the first one. A pack is small,
  measured in kilobytes. Media files are never stored in a pack
  (ROADMAP §2.3). The pack lists the names of the media files it needs.
- **Media bundle.** The planned carrier for a game's media files:
  video, audio, music. A bundle can move between orchestrator machines
  and be checked against the file names in the pack. This is a ratified
  direction (ROADMAP §2.3). The checking half arrives in Phase 3, on
  the B-pages pack-manager page (ROADMAP §8.1). Carrying and uploading
  the files is Phase-5 tooling. Until then, media files are copied to
  known directories on the orchestrator (see **asset channel**).
- **Kit.** A game as it ships to a venue: the pack, the configuration,
  and the physical hardware the production owns. Token objects always;
  optionally a Pi, tablets, scanners, lights, speakers, displays.
  Venues supply no equipment (kit-model decision, 2026-06-11). The kit
  brings its own network.
- **Venue / installation.** The place where a kit is set up for an
  event. Everything specific to the venue lives in the **installation
  profile**: which speakers, which Home Assistant scenes, the network
  details. Venue details never enter the pack.

Also part of this split:

- **Asset channel.** The current way media reaches a machine: files
  are copied into known directories, for example
  `backend/public/videos`. These directories are excluded from git on
  purpose. The ESP32 scanner's asset-sync download works the same way
  and is the model for the future media bundle.

## 1. Words with more than one meaning. Always qualify these.

Each word below carries several unrelated meanings in this project.
Using one without a qualifier causes real errors. Say which meaning
you intend.

- **"session"** has three project meanings, and a fourth from process:
  1. *Game session.* One played game. The backend's `sessionService`
     owns it. Its states are: setup → active → paused ↔ active →
     ended. A paused game resumes, and a game can end from setup,
     active, or paused. It is saved to disk. Entity scores live inside
     it.
  2. *Work session.* The unit used in effort estimates (program
     §12.3). One work session is one stage-sized block of focused work
     (see `docs/agents/process.md`, rule 4).
  3. *Session tier.* A Phase-4 authentication tier for player phones.
     A session-tier identity is pseudonymous and needs no credential
     (one-auth doc).
  The fourth use, the long-running agent/container session, belongs to
  `docs/agents/process.md`, not to game vocabulary.
- **"mode"** has four meanings:
  1. *Pack mode.* One entry in the pack's `modes[]` list, for example
     ALN's `blackmarket` and `detective`. Each entry declares flags:
     scoring policy, claim behavior, display behavior. The engine
     reads the flags, never the mode's name
     (`gameRules/modeSemantics.js`).
  2. *Deployment mode.* Networked means an orchestrator is present.
     Standalone means the device works alone. This is an
     infrastructure choice, not a gameplay choice.
  3. *Display mode.* Which picture the venue display shows: the idle
     loop, the scoreboard, or a video. The orchestrator owns this
     state machine (`displayControlService`) and announces changes
     with the `display:mode` event.
  4. *Network mode.* The installation profile's `network.mode`:
     `kit-network` (standard) or `venue-wifi` (fallback).
  Usage note: say "transaction", not "game mode", for a player's
  per-token choice. Both pack modes can occur in the same game
  session (root CLAUDE.md).
- **"role"** has three meanings:
  1. *Lighting role.* A show event name the pack declares, for example
     `police-arrival-2`. The installation profile maps each role to a
     real venue instrument (B8; slice 4).
  2. *Device-class role.* The part a type of hardware plays in one
     game's design (engine-design-notes P3). Stations can be
     deliberately scarce; phones are personal.
  3. *Manifest file role.* The kind of a file inside a pack manifest:
     `tokens`, `game`, `strings`, `cues`, and so on. Set by `roleFor()`
     in the manifest builders.
- **"claim"** has two meanings:
  1. *Consuming claim.* A GM scan that permanently registers a token
     for one entity. The first claim wins; later claims are rejected
     (duplicate policy). A mode may declare `claims: 'non-consuming'`;
     such scans are repeatable and register nothing (ruling D3s2).
  2. *Claim-credit.* An optional interaction where a player chooses to
     identify themselves, for example by typing a name on their own
     phone. It is a game-design pattern, never an engine default
     (ROADMAP §2.1 names it as the personal-device pattern). The
     entity field carries it, so the same principle reaches a shared
     station. There, the actor arrives through a scanned object such
     as a band (one-auth R24). ALN already credits a named identity at
     a staffed station in detective mode.
- **"profile"** has two meanings:
  1. *Installation profile.* The venue document defined by C1:
     lighting bindings, installed endpoints, network posture. When
     this project says "the profile," it means this.
  2. *Capability profile.* A scripted description of an install tier's
     hardware. It is input to the resolution mechanism, and the test
     harness uses it to simulate that tier (Phase-4 acceptance).
- **E-numbers** name two unrelated series; always qualify which.
  *Tier-E decisions* (the 2026-06-10 decision record, E1 through E11)
  are operational semantics: decision E1 is cue restore (mark past
  cues fired without firing them), E2 the video-completion margin, E4
  cues suspending at session end, E5 the three-segment timeline, E10
  pack reload without restart. *Track E* (program §3) is the player
  platform: E1 the spikes, E2 the real domain and certificate, E3
  tap-to-web, E4 the function-gated auth model, E5 interaction
  primitives v1. Say "decision E5" or "Track E's E5". E1, E2, E4, and
  E5 all collide.
- **"surface"** has two meanings:
  1. *Display surface.* A display output the engine renders: the
     scoreboard, the idle loop, video playback. Since slice 6 a pack
     selects and configures the built-in three through its `surfaces`
     block. A pack can opt out of a surface: a null idle-loop channel
     means no idle loop, and a disabled scoreboard makes the engine
     refuse to show one. A pack can also set surface parameters, such
     as the scoreboard's evidence-page cadence. Packs cannot define
     new surfaces; that is reserved for the BILL era. (Edit noted
     2026-08-29: entry updated from future tense when the slice-6
     build landed, then reworded to the §4 plain-language standard.)
  2. *Mode display surface.* The per-mode `displayBehavior.surface`
     value in `game.json`: where a mode's results land. The engine
     drives exactly `scoreboard-rankings`, `scoreboard-evidence`, and
     `none` today, and the gate refuses any other value
     (`ENGINE_MODE_CAPS.surface`).
  For APIs, say "endpoint" or "contract", not "surface".
- **"entity" vs "team".** The engine's score-holder is an **entity**.
  What an entity represents is defined by each game: a team, a person,
  a wallet, a faction. Each pack declares its own word in
  `entities.label`. ALN's declared label is **Account** (owner ruling
  Q1, built 2026-08-29). "Team" is only the engine's baked fallback
  label, used when a pack declares none. The wire field `teamId` is
  kept only as an alias for the entity field (ledger row L4; the
  Phase-4 wire migration removes it).
  One field, two jobs, chosen per mode by `modes[].entityRole`.
  `ledger` means the entity is the wallet the value lands on.
  `attribution` means the entity is the byline credited for the
  action, a default NPC name unless someone claims credit, and it
  flows to the report's "Exposed By" column. Attribution is not
  separate machinery. Never add a second attribution field
  (PHASE3-STATUS, "the attribution model").

## 2. The engine ↔ pack contract

- **One truth, three loops.** The governing architecture for
  readiness and failure (ratified 2026-09-04). The ONE TRUTH: the
  pack declares what the show needs and how much each need matters
  (`onAbsent: require` = "block the show" / `degrade` = "skip it");
  a profile declares what an environment has; one pure
  `resolve(needs, has)` produces per-need VERDICTS, and every
  surface — editor badge, preflight row, session-start gate, cue-time
  refusal, CLI — quotes those verdicts rather than forming its own
  opinion. The THREE LOOPS, in order: the designer's (verdicts appear
  at the moment of choice, so mistakes die at the desk), the
  system's (self-heal: anything software can fix is fixed silently),
  and the GM's (whatever escapes the first two arrives with verbs
  attached). Any new design question is settled by asking which loop
  owns it and whether it reads the answer sheet.
- **Verdict.** resolve()'s per-need output. Always labeled with the
  depth it reached (paper or live, §5) and the profile it was
  computed against.
- **Activation.** At startup, the backend adopts exactly one pack
  (`packService.activatePack()`). The choice is fixed for the life of
  the process. If someone edits the pack on disk while the process
  runs, the running system ignores the edit. A game session's rules
  therefore never change mid-session (A2).
- **The gate.** The checks that run at activation. If a pack fails a
  check, the backend refuses to start with it. Refusals come in two
  kinds, and messages must say which. **Flavor-i, "self-
  contradictory":** the pack is internally incoherent, with duplicate
  ids or references to things it never declares. **Flavor-ii, "not
  driveable by this engine yet":** the pack is coherent but needs a
  capability this engine does not have. Gate checks read only the
  pack's own files. They never contact a service and never check
  whether venue files exist, because services are not running yet at
  activation time (slice-4 red-team findings G1/R2).
- **Capability.** A named ability of the engine, listed in
  `ENGINE_CAPABILITIES`. Names use the form `area.variant`, for
  example `scoring.tabular`. Ids are append-only: adding one is a
  minor engine version; removing one is a major engine version
  (slice-1 D1). A pack lists what it needs in `requires`. If the
  engine lacks a required capability, the gate refuses and names it.
  Capabilities are how a pack's additive features stay compatible with
  older engines, and additive keys need no version bump (slice-4
  D-4.1). A breaking change to the pack format is different: it bumps
  `PACK_SCHEMA_VERSION`, which engine and pack must match exactly
  (slice 2b). A brand-new flag arrives the same way, by schema
  evolution plus a gate rule, never by loosening the schema.
- **PACK_PATH.** The environment variable that points the backend at
  an alternate pack directory (`packService.getPackDir()`). It exists
  for testing, preview, and rollback. **PROFILE_PATH** is the same
  injection seam for the installation profile, read by
  `profileService` (built in slice-4 S3): one profile adopted at boot
  and frozen, defaulting to the in-repo
  `backend/config/profiles/aln-full-kit.json`. (Edit noted 2026-08-29:
  this entry said "no code reads it today" until S3 landed.)
- **Shim.** A built-in fallback the engine uses when no pack provides
  a value, for example a copy of ALN's scoring table. Every shim
  prints a clear warning when it is active, and every shim has a
  ledger row (see §7) naming when it will be removed.
- **Drift tripwire.** A test that compares two things that must stay
  identical, for example a shim's built-in table against the real pack
  file. If one side changes without the other, the test fails.
  Tripwires run at build and test time, never at boot.
- **Parity surface.** The backend's pure rule functions in
  `src/gameRules/` are the single authority for game rules. The GM
  scanner's standalone implementations must produce the same results.
  When rules change, check both sides.
- **Toy pack.** A small second game (`toy-heist`) kept in the repo
  forever. It proves the engine is generic, works as a regression
  fixture, and doubles as a worked example of how to make a game.
- **Dual-pack Tier L.** The standing test gate for every slice: the
  full end-to-end suite must pass twice, once with the production pack
  and once with the toy pack.
- **Benign emptiness.** The intended behavior when a pack omits
  optional content: the feature is simply absent, with no warning. A
  pack with no cues has no show control. Contrast with shims, which
  always warn.

## 3. Content and data

- **Token.** A physical game object (NFC tag or QR code) and its data
  entry in `tokens.json`. The entry's key is the token id. Caution:
  the video queue also invents token-like ids from video file names
  when a video has no owning token, so ids seen in `video:*` events
  may not exist in `tokens.json` (slice-4 census §2.1).
- **Strings sidecar.** `strings.json`: the pack's display wording,
  covering award messages, screen labels, and terminology. The schema
  fixes its file name.
- **Groups block.** The section of `game.json` that declares token
  groups and their score multipliers. It is the only source of
  multipliers. In token data, `SF_Group` holds the plain group name.
  The old `"Name (xN)"` suffix format survives only in Notion, as an
  authoring convenience, and only the sync script reads it.
- **Notion authoring format.** The `SF_*` field conventions used
  inside Notion descriptions. Only `sync_notion_to_tokens.py` parses
  them. Phase 5 replaces Notion with an in-house content database.
- **Source adapter.** The planned interface that makes Notion one
  replaceable content source among several. It is the named foundation
  for Phase 5.
- **Theme.** The pack's visual identity file. The theme unit ships a
  minimal version: semantic colors, rating glyph choice, scoreboard
  accent.

## 4. Show control

- **Cue.** A pack-declared set of show actions covering lights, sound,
  and video. A *standing* cue fires when a game event or clock time
  matches its trigger. A *manual* cue is fired by the GM, and
  `quickFire` cues appear as buttons in the GM's grid. A *compound*
  cue has a `timeline` of timed steps. A cue with `once: true` fires
  at most one time per game session. Slice 4 moves cues into the pack.
- **Timeline (three-segment model, decision E5).** How a compound
  cue's clock works. Before its video step, time advances with the
  game clock. During the video, time follows the video's playback
  position. After the video ends, the game clock drives again, with no
  gap. Timeline entries are flat objects: `{at, action, payload}`.
- **Lighting role / binding / fallback.** The pack names a show event
  (the role). The installation profile's `bindings.lighting` maps each
  role to a real scene id. The pack's `lightingRoleFallbacks` block
  holds temporary scene ids used only when no binding exists. Every
  such use prints a warning, and the block is scheduled for deletion
  at C4 (ledger row L7). The engine half landed with slice-4 S3: the
  profile, the resolver at the top of executeCommand, and the fallback
  warn. ALN's cues still name concrete Home Assistant scene ids until
  the S4 cutover moves them into the pack as roles. (Edit noted
  2026-08-29: this entry said the whole mechanism was unbuilt until S3
  landed.)
- **Surface channel / binding / fallback.** The lighting-role pattern
  applied to display media (slice 6, owner ruling Q6-2). The pack
  names its idle-loop channel in `surfaces.idleLoop`. A channel is a
  name like `aln-idle`, never a filename; the schema pattern forbids
  paths. The installation profile's `bindings.surfaces` maps each
  channel to a real media file. When a named channel has no binding,
  the engine falls back loudly to the venue config default
  (`config.display.idleLoopFile`). That fallback is ledger row L12
  and retires with the pack-manager media page (ROADMAP §8.1). A null
  channel is different: it means the game has no idle loop at all, a
  *surface opt-out* rather than a fallback. Media files never enter
  the pack (ROADMAP §2.3). A pack that declares a `surfaces` block
  must list the `surfaces.select` capability in `requires`, or the
  activation gate refuses it.
- **Idle loop vs game-event video.** Two different kinds of video that
  must never be conflated (owner, 2026-09-03). The *idle loop* is the
  venue TV's ambient resting screen — mainly pre-show atmosphere — the
  picture that plays whenever nothing else claims the display. It is
  venue-bound media on a pack-named surface channel (see the entry
  above). A *game-event video* is a designed dramatic beat: a token
  names a video file, a player scan triggers it, the display interrupts
  to play it, then returns to its prior mode. Game-event videos are
  token content riding the video queue; the idle loop is display-mode
  furniture. Note (ROADMAP §8.16): the scan→video trigger is currently
  engine-keyed to player scanners only — a GM-scanner-only game reaches
  video today via standing cues, one per token.
- **Held item.** A cue or video that could not run because a needed
  service was down or a video was already playing. The engine parks it
  and tells the GM, who can release or discard it. Nothing is silently
  dropped. Expiry differs by kind today: a held cue auto-discards
  after 10 seconds (`heldItemsStore`), while a held video has no
  expiry and waits for the GM. `videoQueueService` keeps its own
  separate hold list; unifying the two is backlog.
- **Dormant vs fault.** The health distinction from the kit model.
  *Dormant* means a service has no equipment configured tonight, on
  purpose. That is normal and must never show as an error, because
  "red that is always red trains GMs to ignore red". *Fault* means a
  service that should be running is not. That is an error. Ratified
  2026-09-04: the health vocabulary is exactly three words —
  `healthy | down | dormant` (the never-emitted `degraded` is deleted);
  dormant is STICKY (health reports cannot un-latch it) and has TWO
  doors — "not installed tonight" (set by resolution against the
  profile) and "taken out of service" (set by the GM mid-show, e.g.
  the TV died and the show goes on without it). Same state, same
  quiet, two entrances.
- **Alarm integrity.** The invariant behind dormant: red always means
  "act now". Intentional absence shows grey, never red, so the one
  night something really breaks, the red light still gets believed.
- **Status with verbs.** A fault shown to the GM always carries its
  actions — Restart, Re-route, Run-without-it, Release/Discard —
  never bare bad news. Status without verbs is a dashboard; the GM
  scanner is a control panel.
- **Self-heal.** The system's default answer to a problem software
  can fix: fix it, log it, stay quiet. A GM scanner with stale rules
  re-fetches the pack and reconnects (one toast); a crashed stack
  service gets supervised restarts before anyone is told. Humans see
  only the residue.
- **Supervisor.** The engine component (C3, ratified 2026-09-04) that
  auto-restarts crashed software stack services — bounded attempts
  with backoff, escalating to a red row with a Restart verb only when
  exhausted. HOW each service restarts is host configuration, not
  pack or profile content.
- **Service domain / `service:state`.** How the backend tells GM
  clients about service status: one event type carrying
  `{domain, state}` for each of 10 domains (music, video, health, and
  the rest). It is the only push channel for service status.
- **Design-iteration loop.** The platform property (ROADMAP §2.4): a
  designer changes a game value in the tool, applies it, and plays to
  feel the result. No code files, no config files. **Hot-apply (E10)**
  means reloading a pack without restarting the orchestrator; it is
  what makes this loop fast, and it is scheduled with the B pages.

## 5. Venue, kit, and installation

- **Install tier.** How much of the kit is deployed for one event,
  from the minimum (player scanners and tokens only) to the full rig.
  Every tier must run a legitimate game. Tiers are normal
  configurations, not special cases.
- **Endpoints vs stack.** The two-layer capability model. The *stack*
  is the orchestrator's service software. If the orchestrator is
  present, every stack service is expected to run. *Endpoints* are the
  physical devices (speakers, lights, displays), configured per event.
  A missing stack service is a *fault*; an absent endpoint makes its
  features *dormant* (definitions in §4).
- **Preflight.** The pre-show check: one button produces a go/no-go
  list, and every line traces to a field in the profile or the pack
  manifest. Ratified direction C1 (2026-08-22), design ratified
  2026-09-04 (C2): the machine checks everything a machine can
  observe — pack refs, bindings, services, media files, network,
  staffing, and the HOST itself (disk, temperature, processes,
  ports); the hand-run checklist shrinks to the physical room
  (speakers placed, TV on the right input, tokens on set). Every row
  is labeled *paper* or *live* (see below) and names the profile it
  verified against. A required ("block the show") need left unmet
  refuses `session:start`, with a typed, logged "start anyway"
  override for genuine emergencies.
- **Paper vs live checks.** The two verification depths. *Paper* =
  pack needs vs the profile FILE (the declared inventory) — pure data,
  runs anywhere. *Live* = the profile vs reality (the sink exists in
  pactl right now, HA actually has that scene) — runs only where the
  hardware is. Every verdict says which depth it reached and against
  which profile, so a green at home is never mistaken for venue
  readiness.
- **Environment ladder / rung.** "The venue" is not special: a
  profile describes ANY environment, and every environment is a
  partial one (whatever a profile omits resolves dormant). The rungs:
  0 = bare CI (everything dormant, logic only), 1 = CI/dev-container
  with the real software stack and fake physics (dummy outputs, null
  sinks, mocked BlueZ, witness lights), 2 = home test bed (real
  substitute hardware), 3 = the venue. Same engine, same pack, same
  checks on every rung; each runner is capability-probed and its gaps
  recorded with reasons (see
  docs/plans/2026-09-04-rung1-capability-research.md). Ratified
  2026-09-04 with "all rungs as early as possible".
- **Witness lights.** Rung-1's lighting assertion mechanism: the
  simulation profile's HA config gets one virtual light per lighting
  role the pack declares, one scene per role turning its own witness
  on and the others off (one-hot). "Did the right look fire, and
  what look is live now?" becomes a direct read. The fixture is
  GENERATED from the pack's own needs list, so it cannot drift from
  pack content.
- **Planning view.** Answers "if I bring hardware X, what game
  features does that unlock?" for a hypothetical profile, before
  equipment is packed for an event. The UI for it is scheduled after
  Phase 3 (ROADMAP §8.4).
- **Kit network.** The kit carries its own router and WiFi. The
  orchestrator has one reserved IP address and one public DNS name.
  The **orchestrator Pi** answers that name on the LAN: it runs
  dnsmasq as the network's DNS server. DNS lives on the Pi, never on
  the router. The router only has to provide three things any consumer
  router can: a WPA2 access point, a DHCP reservation for the Pi, and
  a DHCP option handing out the Pi as the DNS server. Swapping routers
  therefore costs three settings. The kit works with no internet
  connection.
- **Blue/green.** The ratified cutover method (ROADMAP §3b). *Green*
  is a second Pi, prepared and tested as a complete production
  machine. *Blue* is the current production Pi, left untouched. The
  cutover is: unplug blue, plug in green; green takes the reserved IP.
  Rolling back means swapping the plugs back.

## 5b. The production lifecycle (ratified 2026-09-04; cross-tool
vocabulary — these words must read identically from the config tool,
the GM scanner, and a game's own post-show tooling)

- **Author / Rehearse / Run / Review.** The four stages of a
  production's life, and the platform's organizing vocabulary. The
  creator's practice is a LOOP, not a line: Author ⇄ Rehearse is one
  creative cycle; Run is show night (the GM scanner's stage; the
  preflight is its opening ritual, not a stage); Review closes the
  loop back into Author. Venue configuration is cross-cutting
  infrastructure surfaced in context — "Prepare" is NOT a stage.
- **Rehearse.** Performing the show's moments without the venue:
  every player action available in its simulated form, framed as the
  player's act ("Team X scans the vault token"), the show reacting
  for real (video, cues, witness lights). One concept with many
  depths: the adopter's first-run demo, the designer's
  try-my-change loop, Track D's simulation tooling, and engineering's
  rung-1 rig are all Rehearse. Input transports (NFC, QR, a button)
  are venue-bound physics, never the designer's frame.
- **Simulation.** Not a mode and not a special artifact. A
  simulation is an ordinary installation profile whose bindings
  point at software stand-ins (witness scenes, placeholder files)
  instead of physical fixtures. One can be generated from a pack's
  own needs so every need is met. A show pack before deployment IS
  a show realized only by such profiles; deployment never changes
  the pack — it is the day a venue's profile realizes the same pack
  with physical bindings. (Owner-ruled 2026-09-04: "a simulation"
  and "an undeployed show pack" are not different things.)
- **Review.** A CREATIVE PRODUCTION stage, not log-reading: telling
  the story of the night and learning from it. The platform owns the
  RECORD (the B9 session bundle), the INTAKE (Track D: roster,
  director notes, photos, accusation — captured during Run), and the
  HANDOFF; the GAME owns the TELLING — for ALN, the Director Console
  crafting each session's bespoke in-fiction article for its players.
  The platform's built-in story-of-the-night reading must stand
  alone; a per-game console is an advanced instance, never the
  baseline.
- **Director.** The Review-stage hat (usually the same human as GM
  or designer): the person who crafts the night's telling and
  harvests design learning back into Author.
- **Tech rider.** The pack's declared hardware needs presented
  human-readably for the venue technician — the design-first half of
  both-ends-inward. Derived (collectPackNeeds), never a second
  source of truth. The bindings work is "satisfying the rider."
- **Capability catalog.** Everything the platform can drive,
  browsable — the palette a designer composes a venue from. A
  DESIGNED VENUE lives in the pack as its hardware/role vocabulary
  (no third artifact); profiles realize it; the simulation profile
  realizes it instantly for hardware-free rehearsal.
- **Reference kit.** A published rider defining the basic hardware
  set that showcases the system, fulfilled simulated (the demo) or
  physically (the rung-2 test bed / open-source starter kit).
- **First-run state.** Getting the platform is a threshold crossed
  once, not a stage or a room: a persistent checklist overlay,
  teaching empty states, and templates at the threshold. "Adopt" is
  not a stage — it has no meaning to a user who cannot yet Author.

## 6. Identity and attribution

- **Actor vs device.** A *device* is hardware; its id names the
  machine, not a person. An *actor* is who is acting. On a personal
  phone, the device's session effectively identifies its owner. On a
  shared station, the actor arrives through a scanned game object such
  as a band, if the game wants an actor at all. Permissions resolve
  for actors; the device sets the upper limit (E4).
- **Auth tiers.** Three credential levels. *Operator*: staff with real
  credentials. *Device*: machines, with credentials auto-issued and
  invisible, never a login. *Session*: player phones, pseudonymous.
  Players and scanners never get user-facing logins. This is a
  standing constraint (ROADMAP §2.1).
- **The floor.** Three functions are always operator-only: session
  lifecycle, show control, and score intervention. A pack may assign
  any other function to lower tiers (owner-fixed, 2026-07-09). Since
  B0 (one-auth v1) enforcement is REAL at both ends: grants are
  computed at ISSUANCE (`gameRules/grants.js` —
  `packAssignment(class) ∩ tierCeiling(tier) − floor-if-non-operator`,
  minted into every token's `functions` claim alongside `tier`,
  `class`, `deviceId`, `packHash`), and re-checked at EXECUTION — the
  `commandExecutor` operator floor refuses any gm-boundary FLOOR
  action whose actor lacks the mapped function (deny-by-default,
  every transport incl. the GM WebSocket path), with the older cue
  floor beside it (cue-sourced commands may invoke only `CUE_ACTIONS`
  — pack content is the lowest trust tier). v1's grant TABLE is the
  baked operator-degenerate case (operator = full floor, so live ALN
  behavior is unchanged); pack-declared function assignments and the
  finer non-floor taxonomy are Phase-4 E4. The pack schema still
  locks the floor structurally (`game.schema.json` pins the floor
  functions to `["staffed"]`).
- **Draft / publish (the pack store).** Editing pack content never
  touches the live pack: the config-tool copies it into a tool-private
  DRAFT (stamped with the live `base` contentHash), edits land there,
  and PUBLISH is the one landing step — engine's own activation gate
  (via the child-process runner), refuse-on-base-mismatch (Q11(a):
  conflict = re-draft), ordered rename with the manifest last, landed
  re-verify, publish log. Publish of an unedited draft is a content
  no-op (byte-identity, proven on the production pack).
- **Observe token.** The scoreboard's credential class: device-tier,
  display-class, functions exactly `["observe"]`, minted per page
  serve into its own capped store (never beside operator tokens). A
  read-only broadcast consumer — every HTTP gate and every
  command/transaction path refuses it, and it never registers as a GM
  station. Replaced the ADMIN_PASSWORD that used to ship in every
  venue TV's page source.
- **Pseudonymous default.** The engine's only built-in identity is the
  device or session id. Whether a person is ever named is each game's
  design choice, never an engine requirement.

## 7. Process vocabulary

- **Design workspace pages.** The five authoring pages of the
  config-tool's Design workspace: pack manager, mechanics editor,
  strings & theme editor, show designer, content view. Use this full
  term — "the B pages" is track-letter shorthand from the program doc
  that never became shared language (owner, 2026-09-03).
- **Resolver presentation.** One user-facing form of the C2 answer
  engine (pack needs × installed hardware → runs / degrades /
  unavailable). Three exist: the planning view (post-Phase-3), the
  preflight (the go/no-go checklist), and the test harness. Use
  "presentation", not the program doc's earlier word "face" (owner,
  2026-09-03).
- **Slice.** One unit of the Phase-3 extraction work. Each slice moves
  one feature group from engine code into pack data. Every slice
  follows the same sequence: census → design → red-team → build →
  adversarial review → close record.
- **Census.** The fact-finding step before design: an inventory of the
  code and content the slice will touch. Do not trust a census count
  until a second, independent check confirms it.
- **Red team.** An adversarial review of a design document before any
  code is written. Reviewers must prove each objection with file and
  line citations.
- **Refuters.** Reviewers who adversarially check findings during
  post-build review. Their job is to disprove each reported defect. A
  finding survives only if it withstands them.
- **Stage (S-unit).** One build step inside a slice (S1, S2, and so
  on). The stage is the unit of continuity. A stage is done only when
  all tests pass, the work is committed and pushed, and the record is
  updated (`docs/agents/process.md`, rule 1).
- **Slice train.** How slice branches relate: each new slice branch
  starts from the previous slice's verified tip. Each slice gets a
  draft pull request so CI runs on every push. Nothing merges until
  the owner runs the **merge train**, the recorded order in which all
  held pull requests merge: submodule repos first, then the parent
  stack (PHASE3-STATUS, "Merge train").
- **Frozen production.** No deployments to the live system until the
  coordinated cutover. Live shows run on the `production-2026-07`
  pinned versions.
- **Cutover.** The one coordinated deployment that ends frozen
  production. Its method is the blue/green Pi swap (§5). Its checklist
  lives in PHASE3-STATUS, "Final cutover".
- **Ledger row.** The record of one deliberate temporary construct: a
  description of the debt, the trigger that retires it, a tripwire
  that detects it, and a class (retired, in-queue, post-Phase-3, or
  conditional-watch). A temporary construct without a ledger row is a
  definition-of-done violation.
- **Extraction brake (R13).** A standing rule: no slice may open
  without citing the capability-matrix rows it moves and confirming
  they are not classified `engine-fixed` or `venue-config`. Changing a
  row's classification is allowed, but only as an explicit, logged
  decision in the slice's design document (row 1.23 was the first).
  The slice document records the reclassification; in practice the
  matrix file itself stays untouched.
- **Close record / DoD.** The close record is a slice's final
  execution and verification summary in PHASE3-STATUS. The **DoD**
  (definition of done) is Phase 3's ratified completion checklist
  (program §7): Tracks A, B, and C are finished and the dual-pack
  Tier L run passes. The tier-ladder proof belongs to Phase-4
  acceptance, not Phase 3. In addition, Phase 3 is not done while any
  ledger row, doc obligation, or residue item lacks a named executor
  (PHASE3-STATUS, "DoD linkage"; the deferral registry in ROADMAP §8
  is the index).

## 8. ALN vocabulary (pack content, not engine language)

These terms belong to the first game. They appear in engine-adjacent
code only as pack-declared data. This section exists to teach the
boundary.

- **Black Market / Detective.** ALN's two pack modes. Black Market:
  sell a token for currency. Detective: expose a token as public
  evidence. A team chooses per token, and both happen in the same game
  session.
- **Memory token / "About Last Night".** ALN's fiction and content.
- **GM scanner vs player scanner.** Two engine-level device kinds, a
  staffed operator device and a player device, listed here because the
  split is often misread as ALN flavor. What each kind may DO is not
  engine law. Today's assignment is ALN's grant table, hardcoded in
  the engine until E4 makes functions pack-assignable per device class
  (P4; one-auth §1): GM scans make consuming claims and can score;
  player scans are recorded, never scored, and always repeatable; only
  GM scans are duplicate-checked. Another game may let a bound station
  transact.
