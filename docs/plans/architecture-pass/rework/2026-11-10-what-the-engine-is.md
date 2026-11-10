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

## The owner's notes on that statement (2026-11-10)

Word for word:

> This is all technically correct, but I don't think you fully
> UNDERSTAND how the pieces actually fit together for live games played
> with physical tokens, and how the process built around this engine
> would actually work in the real world based on how you've framed some
> things, so let's make sure we're 100% clear on how this is all
> supposed to work and the role of the engine within the context of the
> games it would be used to design and run. Mainly, you seem to be
> having a hard time distinguishing what happens digitally vs. the real
> world and how those things relate or the broader physical world
> circumstances around the potential use cases on the engine as an open
> source tool. To that end, I'm going to give you some clarifying notes
> and feedback to see if that helps you refine your understanding:
>
> You said: "A game is a pack: data, never code. A pack holds tokens,
> rules, modes, text, theme and show cues." but to be clear, a pack,
> which is digital, does not ACTUALLY hold tokens, it hold the token
> data, which physical tokens with NFC tags would be programmed to
> represent and be physically interacted with by the players during
> gameplay.
>
> You said: "The venue technician says what tonight's kit has, connects
> the pack's names to real equipment, and runs one preflight for a go
> or no-go." but 'tonight's kit' is kind of an unclear handwave of what
> a 'kit' represents in the real world and what 'tonight's' may mean
> depending on the game/production. A kit represents physical
> gear/equipment/furniture that is manipulated by the digital game.
> Depending on the production logistics for any particular game, that
> may mean one venue with one set of physical elements that will remain
> consistent across multiple days, weeks, or even months of running one
> game for many different groups of players across many different
> sessions. Or a game may be designed to travel to different venues
> that may have different capabilities and may have required and
> optional items in the kit that allow the game to be played in venues
> with different levels of capability.

What the agent read next, for the real world of the game: the public
how-to-play page and site (`/home/user/aboutlastnight/how-to-play.html`,
`index.html`; read only), the UX foundation
(`docs/plans/2026-09-04-ux-foundation.md`, sections 0a to 2: the
owner's earlier corrections of the same kind, the hats, the flows),
the Thursday token-sync runbook, a real session's report
(`docs/session-report-0327gamereal.md`), and the token tools described
in `ALN-TokenData/CLAUDE.md` (the tag writer, the token check-in).

The refined statement, as sent, in short:

- The game happens in a room. Players with characters move through a
  dressed space, open locks, find token objects, talk, trade and
  decide. The digital side comes in at a few points: a token is tapped
  on a reader, the room responds, a GM records a player's choice,
  staff run the night.
- Physical, digital, and who ties them together. Tokens: objects with
  NFC tags, and token data in the pack, tied by programming each tag
  with its id. Kit: the gear the digital game drives or runs on and the
  furniture that holds it, and the names in the pack with the profile
  that maps them, tied by the venue technician at each install. People:
  players and GMs, and account names, tied by what a player tells the
  GM. Media: what players see and hear, and files on the machines.
- The system never sees where a token is, who holds it, a trade, a
  solved lock, or whether the TV is on the right input.
- Three spans of time, not "tonight": a session (one group playing
  once), an install (the kit set up at one venue, for one night or for
  months, with many sessions and a room reset between them), a
  production (one long stay at one venue, or a tour of venues with
  different capabilities, with required and optional items).
- The process has physical and digital work at every step: make the
  game, rehearse, install, run sessions, after each session.
- The engine's role: it connects a touch on a physical token to a
  response in the room and a fact on the record, lets staff run the
  night, and gives the game's makers their tools for the digital half
  of each step.

To sharpen in the glossary once the owner confirms (flagged, not yet
done): `CONTEXT.md` section 3 defines "Token" as both the physical
object and its data entry, in one entry; section 0 defines "Kit" as
the pack, the configuration and the hardware together, where the owner
now says a kit is the physical gear, equipment and furniture the
digital game manipulates; "tonight" in the dormancy wording stands for
an install that may last months.
