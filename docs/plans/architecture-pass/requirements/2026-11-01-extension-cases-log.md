# Extension cases: the sources behind each case

Companion to `2026-11-01-extension-cases.json` (24 cases: 21 drafted
2026-11-01 for the owner's confirmation under decision 31, three added
the same day by the check `check-extension.md`). Every sentence in a
case rests on one of the sources below; nothing is invented. No case
now rests on the candidate shape: the check removed its wording
(decision 35 withholds the shape from the panel's first round), and
EX15's status says which of its parts are open for the design rounds.

The section "The check of 2026-11-01, applied" records every change the
check asked for, with the source each was verified against. The
per-case sections below were brought into line with the applied text.

Paths are under `/home/user/ALN-Ecosystem/`. Line numbers are the
branch `claude/nice-curie-hescfv` text read on 2026-11-01.

Abbreviations used only in this log:

- RM = `docs/plans/ROADMAP.md`
- CTX = `CONTEXT.md`
- CS = `docs/plans/CURRENT-STATE.md`
- JOBS = `docs/plans/architecture-pass/report/2026-10-31-engine-jobs.json`
  (cited by the promise's `functional.proposedTitle` and the field read)
- MAP = `docs/plans/architecture-pass/2026-10-30-map-direction.md`
  (the 52 planned capabilities, cited by the capability's name and row)
- SHAPE = `docs/plans/architecture-pass/2026-11-01-engine-shape.md`
  (the candidate shape; a source only for `proposed` wording)
- AFTER = `docs/plans/architecture-pass/2026-11-01-after-game-report.md`
- BILL = `docs/plans/2026-07-17-bill-capability-scoping.md`
  (reached through RM section 7.2 and MAP row "The second game's modules")
- JARGON = `docs/plans/architecture-pass/report/site/checks/jargon-table.md`

## Wording sources (apply to every case)

- Promise titles: JOBS, `jobs[].functional.proposedTitle`, all ten.
- Person names: "venue technician" (CTX:410-413, decision 27 at
  CS:55-70); "director" (CTX:547-549); "designer", "GM", "player",
  "operator" (RM:46-75).
- Plain wordings: JARGON rows 12 (load, not adopt), 13 (start it, or use
  one already running), 15 (a separate trial copy of the engine), 16
  (applying a change while the engine runs, between games), 18 and 19
  (capability numbers dropped, names kept), 29 (the hardware scanner;
  the phone's scanner), 39 (the written list of messages between the
  engine and the devices), 40 (devices, not clients), 45 (not installed
  tonight), 46 (the program watcher), 57 (multi-tap player actions), 58
  (the toy game), 64 (fingerprint; the pack's list of files), 65 (the
  record written when the game ends), 66 (the engine, not backend);
  words box W5 (the toy game) and W8 (health words).
- Block names in place of block numbers: RM:277 (the unlock block),
  RM:297 (the hardening block), RM:358 (the capture block), RM:388 (the
  preview block), RM:416 (the depth-and-close block), RM:588 (the
  release block); decision 31 at CS:114-118 forbids bare numbers.
- "The published protocol" (the intro's definition; replaces the
  drafter's "published interface" gloss on 2026-11-01): decision 33,
  CS:129-140. One versioned definition of everything that crosses the
  engine's edge: what a device may ask, what the engine answers, what
  it tells screens, and the files that carry a game or a night (the
  pack, the venue profile, the night's record, the media list); every
  program's code is generated from it or checked against it; settled,
  designed in an early design round. The intro's sentence is that
  decision's text, not a gloss.
- Decision names in place of decision numbers (decision 36, CS:165-173;
  decision 34, CS:141-149): "the owner's decision on standalone games"
  (22, CS:36-45), "the owner's frame for the pass" (26, CS:46-54), "the
  owner's decision on the pass's vocabulary, which names the venue
  technician" (27, CS:55-70), "the owner's decision on the after-game
  article" (28, CS:71-88). Numbers stay in this log only.

## EX1. A new game as a pack

- RM:40-54 (the final outcome; a designer builds a complete game as a
  pack, never touching code or configuration files).
- RM:128-135 (section 2.4, the design-iteration loop).
- CTX:26-35 (section 0: engine and pack); CTX:248-250 (Toy pack: kept
  forever, proves the engine is generic, a worked example).
- JOBS, "The designer's game is the game the whole kit plays":
  `functional.need` (the whole kit plays that game with no code change;
  a second designer's game runs on the same engine), `goal` (never
  touches code or settings files; the hardware scanner gets its rules as
  data), `needs` (the pack and the check that refuses a broken pack;
  hardware-scanner parity).
- JOBS `purpose[7]` (a second, toy game stays in the repository for
  good, so every change is proven on two games).
- Decision 26, CS:46-54 (the pass designs for use beyond ALN).
- Status: RM sections 1 and 2.4; CTX Toy pack; decision 26.

## EX2. Changing a value between shows

- RM:128-135 (section 2.4: edit, apply, playtest, repeat; the editor and
  applying a change while the engine runs are one deliverable).
- RM:611 (deferral registry row 8.6: applying a change while the engine
  runs lands in the preview block, with the mechanics editor).
- RM:388-414 (the preview block: the mechanics editor with live verdict
  badges and hot-apply, one deliverable).
- CTX:201-205 (Activation: a game's rules never change mid-game);
  CTX:377-381 (Design-iteration loop; hot-apply).
- JOBS, "The designer changes a value and plays it within minutes, and
  the live show never notices": `functional.need`, `goal` (the Design
  studio talks to the engine only by message; the engine applies at a
  moment the Lifecycle allows or refuses and says why), `needs` (edits
  touch a draft only; applying works in setup or after an end).
- JOBS, "Each lifecycle button does exactly what its name says":
  `functional.need` (a between-games edit never reaches the game in
  progress), `needs` (hot-apply refused while a game is active or
  paused).
- JOBS, "The designer's game is the game the whole kit plays": `goal`
  (each copy shows its version; a mismatch shows when a device
  connects).
- MAP:94 (row "Hot-apply": deferred to row 8.6, lands in the preview
  block; nothing exists in code).
- Decision 22, CS:36-45 (hot-apply on the list every rule must serve).
- Status: RM section 2.4 and row 8.6; decision 22.
- The "throughWhat" states the need only (applied only between games,
  or refused with a reason: RM:128-135, CTX:201-205). "A request the
  engine answers" was the candidate shape's answer to the architecture
  pass question "can anything but the live engine touch the live
  show?" (JARGON row 24, question 4) and was removed (check row 17).

## EX3. A new mode from the flags the engine offers

- CTX:88-93 ("mode", pack mode: each entry declares flags; the engine
  reads the flags, never the mode's name); CTX:106-108 (both modes can
  occur in one game).
- CTX:119-123 ("claim", consuming claim; a mode may declare
  non-consuming claims).
- CTX:160-164 (mode display surface: where a mode's results land).
- CTX:266-268 (Strings sidecar: the pack's display wording).
- RM:151-154 (section 2.6: the engine holds no opinion).
- CTX:752-755 (section 8: Black Market and Detective are ALN's pack
  modes, not engine language).
- JOBS, "The designer's game is the game the whole kit plays": `needs`
  (scoring models, hidden facts and multi-tap actions come from the
  pack).
- Status: CTX "mode"; RM section 2.6.

## EX4. A new scoring model

- RM:542-557 (section 7.2: graph game-state and graph scoring as
  generic, pack-parameterized modules, tunable in the mechanics editor).
- BILL:101-105 (a second scoring model in the rules library, selected
  by the pack); BILL:50-54 (the capability gate governs availability).
- CTX:216-227 (Capability: a pack lists what it needs; the gate refuses
  and names a missing one); CTX:244-247 (Parity surface: the rules
  functions are the single authority; the standalone tablet must match).
- CTX:206-215 (The gate: refusal kind "not driveable by this engine
  yet").
- JOBS, "The designer's game is the game the whole kit plays": `needs`
  (the second game's modules: scoring models come from the pack).
- MAP:116 (row "The second game's modules": chartered later, section
  7.2).
- Status: RM section 7.2; CTX Capability and Parity surface.

## EX5. New content and new media

- RM:112-126 (section 2.3: media never in git packs; the pack names
  files with hashes; a managed bundle; the designer uploads through the
  design tool; bundles move between machines; the hardware scanner's
  sync is the model).
- RM:606 (row 8.1: media reference checking on the pack-manager page in
  the preview block; the upload experience in content tooling, section
  7.3).
- CTX:36-42 (Media bundle); CTX:55-59 (Asset channel).
- JOBS, "The designer's game is the game the whole kit plays": `goal`
  (media files checked by a fingerprint of their content), `needs` (the
  media bundle; the pack names its files by fingerprint).
- JOBS, "The room does what the designer cued and the GM asked": `needs`
  (the engine knows whether the named video files exist on its disk).
- MAP:118 (row "Media bundle and asset channel": asset channel built,
  checking in the preview block, upload later).
- Root `CLAUDE.md`, "ESP32 Asset Sync Issues" (the hardware scanner
  fetches pictures and sounds at boot from the engine's manifest).
- Status: RM section 2.3 and row 8.1; CTX Media bundle.
- EX1's "when" follows the same split (check row 18): CTX:36-42 calls
  the bundle "the planned carrier"; RM:123-125 puts the checking with
  the pack-manager page and the upload with content tooling.

## EX6. New show cues naming roles, not instruments

- CTX:286-291 (Cue: pack-declared; standing, manual, compound).
- CTX:297-307 (Lighting role / binding / fallback: the pack names a
  role; the profile binds it; the fallback block retires).
- CTX:308-321 (Surface channel / binding: a channel is a name, never a
  filename).
- CTX:344-355 (Dormant vs fault: an absent endpoint shows grey);
  CTX:420-430 (a stack service whose endpoints are absent is dormant;
  a need marked degrade resolves dormant).
- RM:607 (row 8.2: the last concrete speaker name in pack content is
  retired in the preview block).
- JOBS, "The room does what the designer cued and the GM asked":
  `functional.need`; `needs` (dormancy silences the cues that depend on
  absent equipment).
- JOBS, "The game fits the venue it is in tonight": `goal` (binds each
  pack name to an instrument).
- The designer's choice, "skip it" or "block the show" (check row 6):
  CTX:184-197 (One truth, three loops: `onAbsent: require` = "block the
  show", `degrade` = "skip it"); CTX:418-430 (Endpoints vs stack: a
  need marked degrade resolves dormant; marked require it resolves
  no-go and the preflight refuses the start); CTX:431-443 (Preflight:
  the typed, logged "start anyway" override).
- The "when" (check row 7): RM:607 (row 8.2, the last speaker name in
  pack content retires in the preview block); RM:424-425 (the
  depth-and-close block owns "the two loud-fallback retirements",
  ledger rows L7 and L12); `docs/plans/PHASE3-STATUS.md` ledger L7 (the
  `lightingRoleFallbacks` block, one venue scene id per role, used only
  when the profile has no binding, deleted with the bindings page);
  `ALN-TokenData/game.json:165` (`lightingRoleFallbacks`, still present
  on this branch). The "mustNotNeed" is unchanged: it states the
  target; the "when" states when the target is met.
- Status: CTX Cue and Lighting role; RM row 8.2.

## EX7. A game's own words and look

- CTX:266-268 (Strings sidecar); CTX:280-282 (Theme).
- CTX:166-180 (entity vs team: each pack declares its own word in
  `entities.label`; "Team" is only the baked fallback).
- RM:416-428 (the depth-and-close block: the strings and theme editor
  with the real-device preview).
- RM:732-741 (Appendix B: "Team" to "Account", star ratings hidden,
  award wording, as pack-ruled changes).
- JOBS, "The designer's game is the game the whole kit plays": `needs`
  (even the word for a score-holder comes from the pack);
  `functional.need` (the TV shows its words).
- JOBS, "Anyone reading a screen can act on it without a second
  question": `functional.need` (the editor and the show use the same
  words).
- Status: CTX Strings sidecar, Theme, entity vs team; RM the
  depth-and-close block.

## EX8. Acts and timed cues

- RM:622 (row 8.17: the GM scanner redesign carries the manual
  phase-advance control and phase-relative cue timing; design opens in
  the preview block).
- JOBS, "One game, the same on every screen": `needs` (the redesign
  adds a new fact the GM writes, the game's phase).
- JOBS, "Each lifecycle button does exactly what its name says": `needs`
  (the new phase fact has a defined fate at pause, end and reset).
- MAP:105 (row "The GM scanner redesign"); MAP:218 (the phase as new
  writable state).
- `ALN-TokenData/CLAUDE.md` (read as the submodule inside this
  repository, not the top-level clone), file structure: `game.json`
  carries `gameClock`; RM:711 (Appendix A: "clock phases" was an
  extraction step, so phases are already pack content).
- The "when" (check row 8) follows RM:622 exactly: the redesign's
  design opens in the preview block; "build is priced and slotted by
  its own grill" (its own planning session); no block delivers it.
- Status: RM row 8.17; the promise's needs.

## EX9. A new screen or display surface

- CTX:149-159 ("surface", display surface: a pack selects and configures
  the built-in three through its surfaces block; a pack can opt out;
  packs cannot define new surfaces, reserved for the second game's era).
- RM:542-557 (section 7.2: the constellation display plugs into the
  display-surface seam).
- RM:613 (row 8.8: pack-defined new display surfaces and the
  constellation renderer; the surface set made extensible stays
  headroom).
- BILL:106-110 (constellation renderer: a new display surface, never
  hidden data, fed by server-side projection); BILL:75-82 (server-side
  per-surface projection, mandatory for hidden-information games).
- JOBS, "One game, the same on every screen": `functional.need` (a
  player's hidden fact reaches only its owner), `goal` (hidden facts
  never reach the wrong screen).
- JOBS, "Each person sees their part and can do only their part":
  `goal` (each screen gets only what its role may see).
- MAP:232 (surfaces receive server-side projections scoped to their
  granted functions).
- The "when" (check row 9): RM:613 (row 8.8) gives the constellation
  renderer to the second game's modules and says "making the surface
  set extensible stays headroom beyond it", so only the constellation
  screen has a slot. "Renderer" and "seam" were replaced with "the code
  that draws a new kind of screen" and "the place a new kind of screen
  plugs in" (CTX:149-159 "surface"; CTX:165 asks for "endpoint" or
  "contract", never "surface", for interfaces).
- Status: CTX "surface"; RM section 7.2 and row 8.8.

## EX10. A new kind of player device and a new interaction

- RM:66-69 (a player taps on their own phone or a shared station; no
  account, no login, no app).
- RM:527-540 (section 7.1: tap-to-web on the real domain, the receiving
  experience, the device-tier model, the interaction primitives built
  for both platforms; kit capacity work precedes phone load).
- RM:137-149 (section 2.5: phones and hardware scanners stay equal in
  engine capabilities; parity is not identical interfaces; everything a
  designer iterates on is pack data, never firmware; never a mechanic
  whose loop requires re-flashing a fleet).
- RM:81-100 (section 2.1: players never have accounts).
- RM:624 (row 8.19: kit DNS and the certificate land in the players'
  phones block).
- JOBS, "Every tap gets its answer, and the night can be told
  afterwards": `goal` (every request gets one reply in the same form),
  `needs` (multi-tap actions are requests with the same reply shape).
- JOBS, "Each person sees their part and can do only their part":
  `needs` (players' phones: passes issued without accounts; a measured
  capacity for how many phones one kit carries; no number exists). This
  is the "number to set".
- JOBS, "The game fits the venue it is in tonight": `goal` (phones and
  hardware scanners stay equal), `needs` (hardware-scanner parity:
  every new mechanic has matching firmware).
- MAP:113-114 (rows "Players' phones", "Interaction primitives v1");
  MAP:238-239 (capacity: no number; parity: any new primitive adds
  firmware work).
- Decision 22, CS:36-45 (phones on the list every rule must serve).
- The "throughWhat" names the published protocol (decision 33,
  CS:129-140) and RM:146-147 ("everything a designer iterates on is
  pack data, never firmware"). The earlier wording, reply words as a
  closed list read as data and rules delivered as data tables, was the
  candidate shape's (SHAPE:185 P4, SHAPE:179 P1) and was removed (check
  row 2). "Adapter" became "support" for each device kind (RM:140-142:
  hardware-scanner firmware work is committed platform engineering).
- Status: RM sections 7.1, 2.1, 2.5; decision 22.

## EX11. Who may do what on which device; identification moments

- RM:81-100 (section 2.1: person-level identity is game policy, never
  an engine default; identification moments through whatever the
  hardware supports; claim-credit is one optional pattern).
- RM:151-154 (section 2.6: identification, rosters, station scarcity and
  tracking policy are pack and kit parameters).
- CTX:569-574 (Actor vs device); CTX:575-579 (Auth tiers);
  CTX:580-597 (The floor: session lifecycle, show control and score
  intervention are always operator-only; a pack may assign any other
  function to lower tiers; pack-declared function assignments are later
  work).
- CTX:757-765 (section 8: what each device kind may do is not engine
  law; another game may let a bound station transact).
- RM:527-540 (section 7.1: the device-tier auth model and actor-centric
  permission resolution land with players' phones).
- JOBS, "Each person sees their part and can do only their part":
  `functional.need`, `goal` (players never get accounts; one door checks
  every action once; only the GM moves the game, runs the show or
  changes scores).
- Wording (check row 15): JARGON row 52 replaces "the floor" with
  "starting, pausing and ending the game, show control and score
  changes stay with staff who log in, such as the GM"; the case says
  "a shared station" (RM:93-95: a station is shared) where "a station
  on the floor" read two ways; "computes each pass's rights" (how) was
  replaced by what the pack says, within that limit (CTX:580-582).
- Status: RM sections 2.1 and 2.6; CTX The floor.

## EX12. A game that runs with no engine

- Decision 22, CS:36-45 (a whole game run with no engine as a choice a
  game can declare; no game mixes networked and standalone devices; the
  hardware scanner's missing standalone mode is a parity gap).
- CS:137-141 (open: how many GM tablets per standalone game; exposure
  and video tokens with no engine; where the standalone fact is held).
  The first of these is the "number to set".
- CTX:94-99 ("mode", deployment mode, as amended by decision 22).
- JOBS, "The game fits the venue it is in tonight": `functional.need`
  (a game declared standalone knows it, instead of showing a lost
  connection all night), `goal` (standalone is declared, never mixed;
  where, and how many tablets, stays open), `needs` (something must say
  a game is standalone; today the pack has no field for it),
  `standalone`.
- JOBS, "One game, the same on every screen": `goal` (the record
  decides on the engine, or on the tablet in a standalone game, under
  the same rules).
- JOBS, "Every tap gets its answer, and the night can be told
  afterwards": `standalone` (a refused scan must show as refused on a
  standalone tablet).
- JOBS, "The designer's game is the game the whole kit plays":
  `standalone` (one pack per game, its version on the record).
- CTX:244-247 (Parity surface: the standalone implementation must match
  the rules). Whether the tablet runs the same rules module or its own
  kept equal by tests is the owner's open choice (SHAPE:364-380, choices
  5 and 7); the case says "the same rules the engine would" without
  choosing.
- Added by check row 10: the hardware scanner cannot work alone today
  (root `CLAUDE.md`, deployment modes table: "ESP32 Scanner: Always
  networked"), which decision 22 (CS:41-45) records as a parity gap
  with the owner's explicit word still asked for; the open questions of
  exposure and video tokens with no engine (CS:179-181, questions 24
  and 25). The "when" says the design must allow it now and nothing
  builds it yet (JOBS, "The game fits the venue it is in tonight",
  `needs`: today the pack has no field for it).
- Status: decision 22; where the declaration lives and how many tablets
  are open.

## EX13. A new venue and its equipment

- RM:55-61 (the venue technician fills in a profile, connects names to
  instruments on one page, runs a one-button preflight; a planning
  view).
- CTX:43-51 (Kit; Venue / installation: everything venue-specific lives
  in the installation profile; venue details never enter the pack).
- CTX:410-413 (Venue technician); CTX:431-443 (Preflight: every line
  traces to a field; labeled paper or live); CTX:445-452 (Paper vs live
  checks); CTX:453-463 (every environment is a partial one; whatever a
  profile omits resolves dormant).
- CTX:475-480 (Remote display: a count in the profile, the preflight
  counts connections against it).
- CTX:507-514 (Deploy: the designer hands over the pack; the venue
  technician satisfies its tech rider and binds the profile);
  CTX:550-553 (Tech rider: derived from the pack, never a second source
  of truth); CTX:554-558 (Capability catalog).
- RM:416-428 (the depth-and-close block: the bindings page and the thin
  profile-manager page); RM:609 (row 8.4: the planning view, a later
  block).
- RM:102-110 (section 2.2: the profile selected by path or id; no
  kit-unique identifiers inside engine code).
- JOBS, "The game fits the venue it is in tonight": `functional.need`,
  `goal` (kit names live only in the profile and the running copy, so
  new kits and machines need no code).
- JOBS, "Anyone reading a screen can act on it without a second
  question": `functional.need` (the venue technician's go is a go; a
  desk check never passes for a room check).
- JOBS, "The room does what the designer cued and the GM asked":
  `needs` (dormancy: a not-installed-tonight verdict that sticks).
- MAP:83, 100-103 (rows "Installation profiles", "The Deploy stage",
  "Bindings page and thin profile-manager page", "Hardware/roles
  editor, tech rider, capability catalog, reference kit", "Planning
  view").
- Decision 27, CS:55-70 (the name "venue technician").
- The "when" (check row 11): RM:183-190 (the hardware-proven state
  means "today's hand-run preflight checklist document; the in-panel
  preflight instrument arrives with the hardening block"); CS:287-298
  (the hardening pieces are rebuilt inside the architecture pass);
  MAP:85 (row "The preflight": partly built, minimal evaluator only).
  So the one-button preflight with paper or live on every line is
  rebuilt inside the pass, not built today.
- Status: RM section 1; CTX section 5 and 5b; decision 27.

## EX14. Rehearsing without the venue

- CTX:515-522 (Rehearse: every player action in its simulated form, the
  show reacting for real; input transports are venue-bound physics,
  never the designer's frame).
- CTX:523-531 (Simulation: an ordinary installation profile whose
  bindings point at software stand-ins; generated from a pack's own
  needs so every need is met; deployment never changes the pack).
- CTX:445-452 (Paper vs live: a green at home is never mistaken for
  venue readiness).
- RM:388-414 (the preview block: the rehearse affordance on a running
  preview engine; the preview ships with a preview profile).
- RM:222-230 (the previewable readiness state: a designer friend opens
  the toy game, changes something, rehearses it).
- JOBS, "The designer changes a value and plays it within minutes, and
  the live show never notices": `goal` (a preview engine is a second
  engine copy, so it touches nothing live; on a laptop the equipment
  reads as not installed), `needs` (a second engine that cannot kill the
  live engine's programs, write into its records or mint passes it
  accepts).
- JOBS, "A change is proven before it reaches anyone, and the owner
  alone sends it to the show": `goal` (each preview has its own names so
  none reaches a live show).
- MAP:98-99 (rows "Rehearsing on a preview engine", "Simulation and
  preview profiles"); MAP:40 (gap: no document says where a preview
  engine runs).
- Decision 22, CS:36-45 (the preview engine on the list every rule must
  serve).
- Where the trial copy runs (check row 12): JOBS, "The designer changes
  a value and plays it within minutes, and the live show never
  notices", `moment` ("on a laptop or on the show machine between
  games") and `goal` ("Where it runs is open"); MAP:40 (no document
  says where a preview engine runs). So "the show machine" left the
  "mustNotNeed"; the live engine's programs and records stay in it.
- Status: CTX Simulation and Rehearse; RM the preview block; decision
  22.

## EX15. A new outside program the engine drives

Rewritten by check rows 4 and 5 (2026-11-01) to say what must be
possible, never how. The candidate shape's words (an adapter beneath
the engine's equipment interface, "the few verbs", "a dated picture",
the owner's open choice between one interface per kind of job and one
per program, the tangle of seven programs with no interface above
them) were removed: decision 35 (CS:150-164) withholds the 17-part
shape and the earlier lists of design choices from the panel's first
round, and decision 31 (CS:101-118) asks for what is needed, never how
to build it.

- The need (a developer adds support for a new program once; the pack,
  the cues, the GM's screens and the other programs' support do not
  change): JOBS, "The room does what the designer cued and the GM
  asked", `functional.need` (the room does what the designer cued; a
  dead program comes back by itself) and `needs` (the engine tells its
  own video or music player from a stranger's); RM:102-110 (section
  2.2: no kit-unique identifiers inside engine code); the task's own
  list ("another video player, another lighting system").
- The software stand-in for tests and rehearsal: CTX:523-531
  (Simulation: an ordinary profile whose bindings point at software
  stand-ins); JOBS, "A change is proven before it reaches anyone, and
  the owner alone sends it to the show", `goal` (stand-ins are checked
  against the real thing).
- The program watcher: CTX:368-372 (Supervisor: bounded restarts, then
  a red row); CTX:363-367 (Self-heal); RM:297-330 (the hardening
  block); CS:287-298 (the hardening pieces are rebuilt inside the
  architecture pass); JARGON row 46 (the program watcher).
- The start-or-use setting and where it lives (check row 5): MAP:88
  (row "The host-config file": plain file for restart strategies, modes
  `self` and `adopt`); MAP:172 (section 3.3: host modes are self and
  adopt; whether a program runs tonight is the profile's truth, never
  the host file's); CTX:371-372 (how each service restarts is host
  configuration, not pack or profile content); CS:221-224 ("Live
  state": the shape departs from the ratified capability map on where
  the start-or-adopt setting lives); JOBS, "The room does what the
  designer cued and the GM asked", `needs` (the capability map gives it
  a file of its own; the candidate shape keeps it in the profile; the
  design settles which). So the case no longer puts it in the profile;
  the wording is JARGON row 13's long form.
- "Who": the venue technician's part is the profile's truth about what
  the room has tonight (MAP:172; CTX:48-54 Venue / installation).
- Status: the need rests on the promise and the glossary; how the
  engine reaches its programs, and where the setting lives, are
  design-rounds questions. No part of the case now rests on the
  candidate shape.

## EX16. A second kit or another operator

- RM:71-75 (business shape: one production, one kit, many games; a
  second kit or another operator deliberately not planned but kept
  cheap).
- RM:102-110 (section 2.2, growth without corners: pack and profile
  selected by path or id; no kit-unique identifiers; the DNS and IP
  model works per kit; media bundles move between machines; the seams
  are built now).
- RM:573-587 (section 7.4: multi-game kits, a library of installed
  packs, the operator picks one per event; fleet growth: per-kit
  identity and DNS, re-flash logistics).
- CTX:481-489 (Kit network: one reserved address and one public DNS
  name per kit; swapping routers costs three settings).
- JOBS `purpose[5]` (nothing in the engine may assume one kit, one pack
  or one production).
- JOBS, "The game fits the venue it is in tonight": `functional.people`
  (a future operator with a second kit), `functional.need` (a second kit
  or a new machine needs no change to engine code), `needs` (seams for
  more kits; per-engine names for process files; a name server the
  engine reads but does not drive).
- JOBS, "A change is proven before it reaches anyone, and the owner
  alone sends it to the show": `goal` (each second kit has its own
  names), `needs` (the same per-engine naming layer as test runs, built
  once).
- MAP:120-121 (rows "Seams for more kits and packs", "Kit network, DNS
  and certificate"); MAP:32 (a second engine on one machine is unsafe
  today).
- Wording (check row 14): "the described set" became JARGON row 62's
  "one written list of what the machine should carry"; "the seams that
  keep it cheap" became RM:105-110's own checklist (each pack and
  profile picked by name, no kit's own names inside the engine's code,
  a network name per kit, media that moves between machines).
- Status: RM sections 1, 2.2 and 7.4.

## EX17. A new engine version or a new show machine

- RM:455-470 (section 6: the cutover is a hardware swap; green is built
  as a real production machine; rollback is physical and immediate).
- RM:573-587 (section 7.4, steady-state releases: engine updates only
  between events; pack updates any time by publish).
- RM:164-166 (the frozen-production rule until show-ready, then the
  steady-state rule).
- CTX:490-494 (Blue/green); CTX:654-663 (Frozen production; Cutover).
- CS:246-256 (section 1: the game runs on blue until the new engine is
  ready to swap in on green).
- JOBS, "A change is proven before it reaches anyone, and the owner
  alone sends it to the show": `functional.need` (the owner decides when
  a new version goes to the venue; the machine carries one matching set;
  the owner can swap back by replugging), `goal` (the owner alone sends
  a checked machine).
- JOBS, "Each lifecycle button does exactly what its name says": `goal`
  (a new engine version only between events).
- MAP:122 (row "Blue/green cutover": method ratified, green not
  started). The "throughWhat" (check row 13) now states the need, JOBS
  `functional.need` ("the machine carries one matching set") in JARGON
  row 62's words ("one written list of what the machine should carry");
  "which the engine compares at start and reports" was the candidate
  shape's form (SHAPE:211, P17) and was removed. The "when" splits the
  swap (ratified, RM:455-470) from the check of one matching set, which
  nothing builds today (MAP:122: green not started).
- Status: RM sections 6 and 7.4; CS section 1.

## EX18. A new source of game content besides Notion

- RM:559-571 (section 7.3, content tooling: eliminate Notion; the full
  narrative corpus; the report pipeline becomes the content database's
  second consumer; the source-adapter interface, Notion as one
  replaceable adapter; the token schema as the data spine; "content
  tooling is a convenience, never a dependency").
- RM:614 (row 8.9: the source-adapter interface at content tooling's
  entry).
- CTX:274-279 (Notion authoring format; Source adapter).
- JOBS, "The designer's game is the game the whole kit plays": `needs`
  (content tooling: a replacement for Notion feeds the same pack through
  the same gate).
- MAP:119 (row "Content tooling and the source adapter").
- Decision 28 (3), CS:71-88 (the night's record carries the texts the
  players saw, so the telling reads the record, not Notion); AFTER:39
  (today the console reads memory text from Notion, not the pack the
  show ran).
- Status: RM section 7.3 and row 8.9; CTX Source adapter.

## EX19. A game's own after-game telling reading the night's record

- Decision 28, CS:71-88: (1) the promise's second half names the
  director and the players; (2) what the players receive is the game's
  business; (3) the record carries the pack the game ran and the texts
  the players saw; (4) players' emails stay outside the engine; (5) the
  console stays a separate program that reads the record, and the record
  is designed so the console can later become ALN's own part of the
  Review stage.
- AFTER:13-33 (what the console and emailer are); AFTER:36-43 (what
  they take today: the GM tablet's report pasted and parsed; Notion
  text; the director marks unlocked documents); AFTER:55-77 (where it
  touches the engine map); AFTER:112-128 (the owner's answers).
- RM:358-387 (the capture block: capture, the record writer stamped
  with the pack and the texts, the photo store under the privacy
  defaults).
- RM:615 (row 8.10: the report pipeline's move to the structured
  record, owner-paced; the plan under decision 28).
- CTX:532-546 (Review: the platform owns the record, the intake and the
  handoff; the game owns the telling; the built-in reading must stand
  alone); CTX:547-549 (Director).
- RM:96-98 (section 2.1: game data stays on the kit unless the owner
  moves it; retention is the owner's call per game).
- JOBS, "Every tap gets its answer, and the night can be told
  afterwards": `functional.people`, `functional.need` (afterwards the
  director tells the players the story from what was captured during
  play, with the game and the texts they saw, not reconstructed),
  `goal` (one record of the night; the tablet's report and the game's
  own telling both read it; room to run inside the Review stage later).
- MAP:108-112 (rows "Capture", "Photo capture", "The session-bundle
  emitter", "Report pipeline migration", "The Review stage").
- Status: decision 28; RM row 8.10; CTX Review.

## EX20. The second game's own modules

- RM:542-557 (section 7.2: the compound-scan engine, the hidden-state
  module, graph state and scoring, the constellation display; all
  generic, pack-parameterized, tunable in the mechanics editor; a
  toy-constellation pack proves the block; the platform delivers all
  the technology so the owner finishes the design with no further
  software engineering; the game requires an orchestrator by nature, a
  capability-profile statement).
- RM:613 (row 8.8: the renderer belongs to the second game's modules).
- BILL:83-110 (the four new capabilities as generic modules with
  pack-supplied parameters, none game-specific); BILL:112-125 (against
  forking); BILL:75-82 (server-side projection, mandatory for hidden
  information).
- CTX:216-227 (Capability: the gate refuses a pack whose required
  ability the engine lacks).
- JOBS, "The designer's game is the game the whole kit plays": `needs`
  (the second game's modules, multi-tap actions and the entity field:
  scoring models, hidden facts, multi-tap actions come from the pack).
- JOBS, "One game, the same on every screen": `functional.need` (in
  future games a player's hidden fact reaches only its owner), `needs`
  (hidden facts have a decider and a saved home; the engine filters what
  each screen receives).
- JOBS, "Each person sees their part and can do only their part":
  `needs` (hidden state kept from every screen except the one entitled
  to it).
- MAP:116 (row "The second game's modules"); MAP:232-236 (the demands:
  projection, hidden state with a named decider, persistence across
  restart).
- Decision 26, CS:46-54 (design for use beyond ALN).
- Wording (check row 16): "the rules library, the interaction engine,
  the display-surface seam" became "the rules, multi-tap player
  actions, and the place a new kind of screen plugs in" (JARGON row 57;
  RM:542-546).
- Status: RM section 7.2 and row 8.8.

## EX21. A developer from outside the team

- RM:40-44 (the end goal: an open-source show platform, usable by
  non-technical designers and extensible by technical people).
- RM:232-236 (the adoptable readiness state: a stranger can stand the
  platform up and learn it; guided setup, human-facing docs, the secrets
  fix, a license, the privacy defaults stated).
- RM:222-230 (the previewable state's safety rule: the committed token
  and password rotate before the first outside person touches the
  system).
- RM:588-596 (section 7.4, the release block: secrets hygiene, license,
  designer guide and operator runbook, privacy defaults for downstream
  operators; the toy packs as "how to make a game, by example").
- RM:99-100 (section 2.1: the four privacy rules every future operator
  inherits).
- CTX:248-250 (Toy pack as a worked example); CTX:559-562 (Reference
  kit); CTX:564-566 (First-run state).
- Root `CLAUDE.md`, "Contract-First Architecture" (the two written
  message lists are updated first; this is the published-interface
  practice an outsider builds against).
- JOBS `purpose[0]` (technical people can extend it); JOBS, "Each person
  sees their part and can do only their part": `needs` (open-sourcing:
  the committed lighting token and admin password rotate before any
  outsider touches the system).
- JOBS, "A change is proven before it reaches anyone, and the owner
  alone sends it to the show": `functional.need` (when every test
  passes, the show still runs for ALN and for the toy game), `goal`
  (every change runs on two packs).
- MAP:125 (row "Open-sourcing and the release block"); MAP:70
  (pre-previewable safety).
- The places an outsider adds a device, a program, a scoring model or a
  content source are those of EX10, EX15, EX4 and EX18. The
  "throughWhat" (check row 3) names the published protocol by decision
  33's definition (CS:129-140); the places inside the engine where a
  developer adds something are not part of the protocol and are named
  in plain words (JARGON row 39 on "contract", and "seam" is not a word
  the jargon table allows to stand). "The proof" became "the
  developer's tests" (JARGON row 9).
- Status: RM sections 1, 3 and 7.4.

## EX22. What a scan causes (added by check row 20)

- RM:621 (row 8.16, ratified 2026-09-03: the scan-to-video trigger is
  engine-keyed to player scanners, "a baked ALN opinion"; a
  GM-scanner-only game cannot declare it directly; it becomes pack
  content with the interaction primitives, section 7.1; the interim is
  standing cues, one per token-to-video pairing, "pure pack content").
- RM:151-154 (section 2.6: the engine holds no opinion).
- CTX:322-333 (Idle loop vs game-event video: a token names a video
  file, a player scan triggers it; the GM-scanner-only game reaches
  video today via standing cues, one per token).
- Root `CLAUDE.md`, "Contract-First Architecture" notes: "GM scanner
  token scans do NOT trigger video playback"; video is triggered by a
  player scan or the admin queue.
- JOBS, "The room does what the designer cued and the GM asked":
  `functional.need` (the room does what the designer cued); JOBS, "The
  designer's game is the game the whole kit plays": `needs` (multi-tap
  actions come from the pack).
- RM:527-532 (section 7.1: the interaction primitives, built for both
  platforms), for the "when".
- Status: RM section 2.6 and row 8.16; CTX Idle loop vs game-event
  video.

## EX23. One kit, a different installed game per event (added by check row 21)

- RM:43-44 (section 1, the interim state: "one production (the
  owner's), one kit, and a growing library of its own games").
- RM:576-579 (section 7.4 item 1, multi-game kits, "a real
  requirement": a kit holds a library of installed packs; the operator
  picks one per event; until the selection UI exists, pack selection at
  startup through the existing path/id seams).
- RM:102-110 (section 2.2: the pack is selected by path or id, never
  assumed to be the only one).
- RM:71-72 (business shape: one production, one kit, many games on it).
- CTX:201-205 (Activation: the engine adopts exactly one pack at
  startup); CTX:228-235 (`PACK_PATH` points the engine at a pack
  directory), for "at startup by path or id today".
- JOBS, "The designer's game is the game the whole kit plays":
  `functional.need` (the whole kit plays that game with no code
  change); JOBS, "The game fits the venue it is in tonight": `goal`
  (new kits and machines need no code).
- EX16 keeps the second operator's library; this case is our own kit's.
- Status: RM section 1 (interim state), section 7.4 item 1, section
  2.2.

## EX24. Where a game's records go and how long they stay (added by check row 22)

- RM:96-100 (section 2.1, rules 3 and 4: game data stays on the kit
  unless the owner moves it; how long old session data is kept is the
  owner's decision, per game; the four rules are the privacy defaults
  every future open-source operator inherits). Rule 1 (no player
  accounts) and rule 2 (person-level identity is game policy) give the
  "mustNotNeed" and the sentence on a game that names players.
- RM:595 (section 7.4, the release block: the privacy defaults stated
  for downstream operators).
- JOBS, "Every tap gets its answer, and the night can be told
  afterwards": `needs` (photo capture: data kept on the kit and
  retention set per game by the owner); `goal` (one record of the
  night).
- JOBS, "Each person sees their part and can do only their part":
  `goal` (players never get accounts).
- RM:358-387 (the capture block: the photo store under the privacy
  defaults), for the records named in the case.
- Status: RM section 2.1 rules 3 and 4.

## Cases the task named, and where each landed

| Named in the task | Case |
|---|---|
| A new game as a pack | EX1 |
| A new scoring rule or mode | EX3 (mode), EX4 (scoring model) |
| New content and new media | EX5 |
| A new screen or display surface | EX9 |
| A new kind of player device and a new interaction (players' phones) | EX10 |
| A new outside program the engine drives | EX15 |
| A new venue and its equipment | EX13 |
| A second kit or another operator | EX16 |
| A new source of game content besides Notion | EX18 |
| A game's own after-game telling reading the night's record | EX19 |
| The second game's own modules | EX20 |
| A developer from outside the team | EX21 |

Cases the sources demanded beyond that list: EX2 (the design-iteration
loop, RM section 2.4), EX6 (cues as pack content naming roles, CTX
section 4), EX7 (a game's own words and look, CTX Strings sidecar and
entity label), EX8 (the GM-written phase, RM row 8.17), EX11 (who may
do what on which device, RM sections 2.1 and 2.6), EX12 (a standalone
game, decision 22), EX14 (rehearsing on a simulation profile, CTX
Simulation), EX17 (a new engine version by machine swap, RM section 6);
and, found missing by the check of 2026-11-01: EX22 (what a scan
causes, RM row 8.16), EX23 (one kit, a different installed game per
event, RM section 7.4 item 1), EX24 (where a game's records go and how
long they stay, RM section 2.1 rules 3 and 4).

## Numbers left for the owner to set

- EX10: how many phones one kit carries at once (JOBS, "Each person
  sees their part and can do only their part", `needs`: "No number
  exists"; MAP:44).
- EX12: how many GM tablets one standalone game may run (CS:138-139,
  question 24).

## Checks run

- The JSON parses (`python3 -I -c "import json; json.load(open(...))"`).
- No em dash, no promise number, no capability number, no bare phase,
  step or block number, and no finding id appears in the JSON (grep for
  the em dash character, `J[0-9]`, `C[0-9]`, `P[0-9]`, `capability [0-9]`,
  `[Pp]hase [0-9]`, `[Ss]tep [0-9]`, `[Bb]lock [0-9]`, `[A-Z]-[0-9][0-9]`).
- Every `promises` entry equals a `functional.proposedTitle` in JOBS
  (re-run 2026-11-01 after the check: 24 cases, 53 references, all
  match).
- Since the check of 2026-11-01 no decision number appears in the JSON
  (grep `decision [0-9]`: none); decisions go by short titles (decision
  36). Roadmap section numbers appear only in `status` and `when`, as
  citations beside a block's or a section's name. Also re-run after the
  check, all none: `seam`, `the floor`, `verb`, `dated picture`,
  `described set`, `renderer`, `interaction engine`. Three wordings
  outside the check's rows stand, unchanged because the check did not
  list them: EX4's "rules library"; EX18's "source adapter", a glossary
  term (CTX:277-279); and EX18's "a published interface for content
  sources", the one remaining use of the intro's retired term. Decision
  33's protocol covers the pack's format, which is what a content source
  produces, so the owner may want EX18 to say "produces the pack in the
  published protocol's pack format"; that is a question for the owner,
  not a change made here.

## The check of 2026-11-01, applied

`check-extension.md` listed 22 conflicts. Each was verified against
its named source before it was applied. Applied: 22. Rejected: 0.

| # | Where | Verified against | Applied as |
|---|---|---|---|
| 1 | intro | CS:129-140 (decision 33) | The intro's last sentences are decision 33's definition of the published protocol, named as the owner's. The term "published interface" now stands in one place only, EX18's "a published interface for content sources", which the check did not list; it is left for the owner (see the note under "Checks run"). |
| 2 | EX10 throughWhat, case, who | CS:129-140; RM:137-149; the earlier log entry naming SHAPE P1 and P4 | "The published protocol; everything the designer iterates on reaches the device as pack data, never firmware." The reply words as data and the rules as data tables were dropped, not marked proposed, so the case stays settled. "Adapter" became "support" in the case and the "who". |
| 3 | EX21 throughWhat, case | CS:129-140; JARGON rows 9 and 39 | The protocol by its definition; "the places a developer adds a device, a program, a scoring model or a content source"; "the developer's tests". The case's list of what the stranger builds uses the same plain words. |
| 4 | EX15 case, throughWhat, status, why | CS:150-164 (decision 35); CS:101-118 (decision 31); CTX:523-531; CTX:368-372 | Rewritten as a need (support added once; pack, cues, GM screens and other programs untouched; a software stand-in; the program watcher). The shape's words and the open choice between interface styles are gone; the "why" no longer describes today's code. Status names what the need rests on and what the design rounds decide. |
| 5 | EX15 case, throughWhat, when, who | MAP:88, MAP:172; CTX:371-372; CS:221-224; JOBS "The room does what the designer cued and the GM asked" `needs`; JARGON row 13 | "A setting says whether the engine starts the program itself or uses one already running"; where it lives (the venue profile or a settings file on the machine) is open for the design rounds. The venue technician no longer sets it in the profile; their part is what the room has tonight. |
| 6 | EX6 case | CTX:184-197; CTX:418-430; CTX:431-443 | The designer marks whether the lights are needed: "skip it" shows grey and the siren plays; "block the show" is a no-go, no start without the typed override. |
| 7 | EX6 when | RM:424-425; RM:607; PHASE3-STATUS ledger L7; `ALN-TokenData/game.json:165` | "now for cues that name roles; the last speaker name leaves the pack in the preview block, and the venue scene ids kept as lighting fallbacks leave it in the depth-and-close block". The "mustNotNeed" stands as the target. |
| 8 | EX8 when | RM:622 (row 8.17) | The redesign carries it; design opens in the preview block; build priced and slotted by its own planning session; no block delivers it yet. |
| 9 | EX9 when, status, throughWhat, why, case | RM:613 (row 8.8); CTX:149-165 | "later for the constellation screen (the second game's modules); a general way to add new kinds of screen has no slot yet"; "the code that draws a new kind of screen"; "the place a new kind of screen plugs in". |
| 10 | EX12 when, case, status | CS:36-45 (decision 22); CS:174-182 (questions 24 and 25, 22's hardware-scanner reading); root `CLAUDE.md` deployment modes table | "the design must allow it now; nothing builds it yet"; the hardware scanner's parity gap with the owner's word still asked for; the open question of exposure and video tokens with no engine. |
| 11 | EX13 when | RM:183-190; CS:287-298; MAP:85 | "now for the profile and the hand-run checklist; the one-button preflight with paper or live on every line is hardening work rebuilt inside the architecture pass (today only a minimal check exists)"; the rest unchanged. |
| 12 | EX14 case, mustNotNeed | JOBS "The designer changes a value and plays it within minutes, and the live show never notices" `moment` and `goal`; MAP:40 | "On a laptop ..., or on the show machine between games (where it runs is an open question)"; "the show machine" dropped from mustNotNeed; the live engine's programs and records kept. |
| 13 | EX17 when, throughWhat | RM:455-470; MAP:122; JOBS "A change is proven before it reaches anyone, and the owner alone sends it to the show" `functional.need`; JARGON row 62 | "One written list of what the machine should carry, so the owner can see that a machine carries one matching set before it goes out"; "now for the swap ...; the check that a machine carries one matching set is new work". |
| 14 | EX16 throughWhat, when | JARGON row 62; RM:102-110 | "one written list of what the machine should carry"; "what keeps it cheap is built now: each pack and profile picked by name, no kit's own names inside the engine's code, a network name per kit, media that moves between machines". |
| 15 | EX11 throughWhat, mustNotNeed, when, case, why, status | JARGON row 52; CTX:580-582; RM:93-95 | "the staff-only limit" in the jargon table's words throughout; "a shared station"; "the pack says what each kind of device may do, within that limit". The status cites the glossary entry as "the entry on the staff-only limit". |
| 16 | EX20 throughWhat | JARGON row 57; RM:542-546 | "the rules, multi-tap player actions, and the place a new kind of screen plugs in". |
| 17 | EX2 throughWhat | RM:128-135; CTX:201-205; JARGON row 24 (question 4) | "the engine applies the change only between games, or refuses and says why". |
| 18 | EX1 when | RM:112-126; RM:606 (row 8.1); CTX:36-42 | "now for the pack; checking the media against the pack in the preview block; the media bundle and its upload later (content tooling)". |
| 19 | status of EX1, EX2, EX10, EX12, EX13, EX14, EX19 | CS:165-173 (decision 36); CS:141-149 (decision 34) | "the owner's frame for the pass" (26), "the owner's decision on standalone games" (22), "the owner's decision on the pass's vocabulary, which names the venue technician" (27), "the owner's decision on the after-game article" (28). |
| 20 | missing case | RM:621 (row 8.16); RM:151-154; CTX:322-333 | EX22 added: a designer declares what a scan causes; when: later, with multi-tap player actions; until then one standing cue per token. |
| 21 | missing case | RM:43-44; RM:576-579; RM:102-110 | EX23 added: our own kit runs a different installed game per event; when: now by picking the pack at startup by path or id, a selection page later. |
| 22 | missing case | RM:96-100 (rules 3 and 4); RM:595 | EX24 added: the owner, or a future operator, sets per game how long records are kept, and no game data leaves the kit unless the owner moves it; when: the design must allow it now. |

Checks after applying: the JSON parses; 24 cases, 53 promise
references, every title matching JOBS; every case carries the same nine
fields in the same order; none of the forbidden patterns listed under
"Checks run" appears, and `decision [0-9]`, `seam`, `the floor`,
`verb`, `dated picture`, `described set`, `renderer` and `interaction
engine` appear nowhere in the JSON. `published interface` appears once,
in EX18, outside the check's rows (noted above).
