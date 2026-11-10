# What the engine is supposed to be (put to the owner 2026-11-10)

Status: the agent's statement, sent to the owner for correction. Not
yet confirmed. The owner's instruction, word for word, when confirming
that the subject is improving the engine being rebuilt: "This also
means you need to make sure you FULLY understand WHAT the engine we're
rebuilding is SUPPOSED TO BE." The owner also confirmed the one short
proposal ("sure. yes.") and the independent challenge of it ("That's
fine, yes, but we don't need to OVERCOMPLICATE it.").

Read the sources, not this page, before designing anything. The lead
reads them itself; helper summaries are how the understanding went
shallow before.

- `docs/plans/ROADMAP.md` sections 1 to 4, 7 and 8: the final outcome,
  the six standing constraints, the readiness states, the blocks of
  work, the later blocks, the deferral registry.
- `CONTEXT.md`, all of it: the engine and pack split (section 0), the
  engine and pack contract (2), show control (4), kit and venue (5),
  the production lifecycle (5b), identity (6).
- `docs/decisions/2026-06-11-engine-design-notes-b4-b10.md`: principles
  P1 to P8 (the entity as a ledger, attribution, device classes,
  functions assigned per game, affordances, tap-to-web).
- `docs/decisions/2026-06-11-kit-model-install-tiers.md`: kits, install
  tiers from player scanners and tokens alone to the full rig, stack
  and endpoints, dormant and fault.
- `docs/plans/2026-06-11-phase3-program.md` sections 1 and 3: "make
  ALN-class games data, not code", the five tracks.
- `docs/plans/2026-07-17-bill-capability-scoping.md`: what the second
  game asks of the engine.
- `docs/plans/architecture-pass/2026-10-30-map-direction.md`: the 52
  capabilities, built and planned, and what each asks of the
  architecture. No engine code has changed since 2026-10-30.

The statement as sent:

1. A show platform, not ALN's software. The end goal is an open-source
   platform for live games played with physical tokens. ALN is the
   first game. The engine is everything that is the same for every
   game, and it holds no opinion on game design.
2. A game is a pack: data, never code. A game of a kind the engine
   already runs is a new pack and no engine change; the toy game proves
   it on every change. A game of a new kind adds a small general module
   any later pack can use. Code written for one game heads toward zero.
3. Four people, each with a stage. The designer builds and tunes the
   game in the design tool (change, apply, play, look), with no code or
   config files. The venue technician says what tonight's kit has,
   connects the pack's names to real equipment and runs one preflight.
   The GM runs the night from the scanner as a control panel: red means
   act now and comes with what to do, absent on purpose is grey, and
   software fixes what it can. The night's record builds itself from
   what was captured; the game owns the telling. Players tap tokens
   with no account, login, app or identity unless the game designs one.
4. A kit that scales. The production brings its own hardware and
   network. The same game must run properly at every kit size, from
   player scanners and tokens alone to the full rig; the show machine
   is one of the things a kit may or may not bring. The pack says what
   the show needs and how much each need matters, and one comparison
   with tonight's kit gives the answer every screen shows.
5. What a device does is the game's choice. Phones, shared stations and
   staffed devices are three kinds of device; the pack assigns what
   each may do, and only game start and end, show control and score
   changes always stay with staff. Phones and hardware scanners stay
   equal in what the engine lets them do, and nothing a designer tunes
   may need devices re-flashed.
6. Built to grow. Nothing assumes one kit, one pack or one production
   where avoiding that is cheap.

Things the agent asked the owner in versions 9 to 11 of the site that
these sources had already settled: a game with only player scanners is
a normal install tier (kit model, 2026-06-11); the show machine is
itself a capability a kit may lack (same); what each device class may
do is the pack's assignment (design notes P3 and P4); the second game
needs the show machine by nature (the scoping, 2026-07-17).
