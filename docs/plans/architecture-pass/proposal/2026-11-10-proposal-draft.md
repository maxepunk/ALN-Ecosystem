# The engine's architecture: a plan for improving it (draft, 2026-11-10)

Status: the agent's draft, before the independent challenge and before
the owner has seen it. It follows the skill
`improve-codebase-architecture`: candidate improvements, each with the
files, the problem, the change in plain words, the benefits, how
strongly it is recommended, and a top recommendation. The owner then
picks what to look at closely.

What the engine is supposed to be, and how the physical game relates to
the digital side: `../rework/2026-11-10-what-the-engine-is.md`. Read it
first. The improvements are judged against that, not against the bugs
of any one show.

## The claim in one paragraph

The engine's rules and its pack format are sound. The weak spots are in
the shared plumbing between the parts: how a game's facts are decided
and reach screens, how a request is answered, how the room's equipment
is driven, how a game moves through its life, and how one copy of the
engine is kept apart from another. Seven improvements fix those. The
rest of the rebuild stands on them.

## What is already sound and stays

- The pack, and the start-up check that refuses a bad pack
  (`backend/src/services/packService.js`).
- The rules on the show machine, as pure functions
  (`backend/src/gameRules/*`, about 1,900 lines).
- The comparison of what the show needs with what is installed, and the
  three health words (`backend/src/gameRules/resolution.js`,
  `packNeeds.js`, `backend/src/services/serviceHealthRegistry.js`).
- Pack delivery to devices, each showing which pack it holds
  (`/api/pack/*`, `ALNScanner/src/core/packLoader.js`).
- Draft and publish in the design tool (`config-tool/lib/draftStore.js`,
  `publish.js`).
- The toy game, and the rule that every change passes with both games.

## The seven improvements

### 1. The game's facts live in one place and reach every screen one way (Strong)

Today.
- The GM tablet marks a token as taken before the show machine answers
  (`ALNScanner/src/app/domains/gameOps.js:326-331`) and keeps its own
  lists (`ALNScanner/src/core/unifiedDataManager.js`,
  `core/storage/NetworkedStorage.js`, `LocalStorage.js`).
- The show machine builds each fact twice: for live updates
  (`backend/src/websocket/broadcasts.js`, 42 listener sites) and for a
  screen that reconnects (`backend/src/websocket/syncHelpers.js:36`,
  `buildSyncFullPayload`, seven callers). A fact present in one and
  missing in the other has happened four times
  (`backend/CLAUDE.md:529`).
- The wall display receives everything and filters it in the page
  (`backend/public/scoreboard.html`, 1,860 lines).

Proposed. One game record decides and holds every fact of a running
game. One delivery step sends each fact to every screen, live or after
a reconnect, built by the same code, marked with its age, and filtered
by what that screen may see. Screens draw what they are sent.

At a show. What one GM did is what every tablet and the wall display
show, also after a reconnect. A delete or a reset clears every screen.
A tablet that loses the show machine keeps working and settles up when
it is back.

For the rebuild. Capture, the night's record, players' phones and the
second game's hidden facts each need one home for a fact and one
filtered way out.

### 2. One copy of the game's rules (Strong)

Today.
- The show machine has the rules as pure functions
  (`backend/src/gameRules/*`). The GM tablet has a second hand-written
  copy for games with no show machine (`ALNScanner/src/core/scoring.js`,
  `modeSemantics.js`, `core/storage/LocalStorage.js`). Nothing under
  `ALNScanner/src` loads the show machine's rules. The wall display
  reads the pack's rules file itself
  (`backend/public/scoreboard.html:1231`).
- Eighteen decisions are made again on devices; for five of them nothing
  keeps the copies equal
  (`relationships/2026-11-01-today-client-modules.md`, section 6.2).
- "This game has no show machine" is a tap on the tablet
  (`ALNScanner/src/app/sessionModeManager.js`), a web address on the
  phone (`aln-memory-scanner/js/orchestratorIntegration.js:33-34`),
  nothing on the hardware scanner, and nothing in the pack or profile.

Proposed. One body of rules, read from the pack, that runs on the show
machine in a networked game and on the GM tablet in a game with no show
machine. Whether a game has a show machine is declared once. The
hardware scanner cannot run the same code, so it gets the few rules it
needs as data made from the same source.

At a show. A small install scores a game exactly as the full rig does.

For the rebuild. A touring game that plays with less gear, the second
game's new scoring, and every rule a pack declares land once.

Open choice. The tablet runs the same code (recommended), or keeps code
of its own that tests check against the first.

### 3. One published protocol (Strong; decided by the owner 2026-11-01)

Today. The messages and files are written in two contract files
(`backend/contracts/openapi.yaml`, `asyncapi.yaml`), but each program
copies the names by hand. The GM tablet keeps a hand-written list of
the messages it accepts (`ALNScanner/src/network/orchestratorClient.js:26`);
a message missing from the list never arrives and nothing says so. The
game record's check drops fields it does not know (ROADMAP section 4,
Block 4).

Proposed. Every request, reply, fact and file format is defined once,
with a version. Each program's code is made from that definition or
checked against it when it is built.

At a show. After an update, a tablet or scanner that does not match
says so at once. Nothing fails silently mid-game.

For the rebuild. Every new device and screen, anyone else's extension,
and the rule that a pack can update at any time while the engine
updates between events.

### 4. One door for requests; the pack says who may do what (Strong)

Today.
- Three ways in, each with its own reply: player scans over HTTP with
  game logic inside the route (`backend/src/routes/scanRoutes.js`), GM
  scans over the socket (`backend/src/websocket/adminEvents.js`), and GM
  commands (`backend/src/services/commandExecutor.js`).
- The tablet matches a reply to its request by the command's name alone
  (`ALNScanner/src/admin/utils/CommandSender.js:44`).
- Only a connection that calls itself a GM is asked for a pass
  (`backend/src/websocket/socketServer.js:53`).
- Which kind of device may do what is fixed by which way in it uses.
  That is ALN's arrangement, not the engine's
  (`docs/decisions/2026-06-11-engine-design-notes-b4-b10.md`, P4).

Proposed. Every tap and every button goes through one door and gets one
reply in one form: accepted, refused and why, held, or try again. What
each kind of device may do comes from the pack, above a floor that
stays with staff (`backend/src/gameRules/grants.js` already computes
it).

At a show. Every tap gets an answer the person can act on. Nothing is
lost or counted twice without a trace.

For the rebuild. A game where a station sells without staff, players'
phones, scans of several objects, and a record of every attempt.

### 5. One interface for the room's equipment; one way to keep its programs running (Strong)

Today. Seven separate pieces of code drive the video player, music,
sound, audio routing, Bluetooth, lights and the display
(`backend/src/services/vlcMprisService.js`, `musicService.js`,
`soundService.js`, `audioRoutingService.js`, `bluetoothService.js`,
`lightingService.js`, `backend/src/utils/displayDriver.js`), with no
interface above them. A program's state and its health travel
separately (`musicService.js:73` keeps a private flag beside the shared
registry). Crashed programs are restarted in more than one way
(`backend/src/utils/processMonitor.js`; own spawns in
`displayDriver.js:165` and `soundService.js:75`). Held cues and held
videos sit in two stores.

Proposed. Each thing the room can do sits behind the same small
interface: commands in; state, health and age out together. The real
program plugs in underneath, and so does a software stand-in. One
supervisor starts, watches and restarts every program.

At a show. A crashed program comes back by itself, or the GM sees red
with what to press. Gear that is not installed here shows grey.

For the rebuild. The paused hardening work (automatic restarts, the
preflight) lands once instead of seven times. Rehearsing at a desk is
the same engine with stand-ins. A venue with less gear is the same
interface saying "not installed here".

Open choice. One interface per thing the room can do (recommended), or
one per outside program.

### 6. Each running copy of the engine keeps to itself (Strong)

Today. The engine assumes it is the only one on its machine: about
fifteen fixed names under `/tmp` in `backend/src`, and two start-up
commands that stop every matching program on the machine
(`backend/src/utils/displayDriver.js:147`,
`backend/src/services/audioRoutingService.js:603`). Tests use the live
display and sound.

Proposed. Each copy of the engine has its own names for its files,
ports, display and passes, and stops only what it started.

At a show. Nothing run at a desk or in a test can interrupt a live game
on the same machine.

For the rebuild. The rehearsal engine, tests on the real machine, and a
second production's kit.

### 7. One table for the life of a game (Strong)

Today. Starting the engine and "Reset System" are two hand-kept lists of
steps (`backend/src/app.js:178-352`,
`backend/src/services/systemReset.js`). Tablets and the wall display
guess that a new game began from a changed id
(`ALNScanner/src/network/networkedSession.js:246`), and player scanners
are never told. After a reset the display reads as down until something
else reports it.

Proposed. One table says what every fact and every part does at each
moment: set up, start, pause, end, the next game, a reset, a restart, a
new pack. One piece of code moves the game along, and every screen is
told.

At a show. On a long run the same install plays session after session.
"End, reset, next group" leaves every screen clean each time, and a
restart mid-game loses nothing.

For the rebuild. Applying a pack without a restart is one more row. The
night's record is written at the row "end".

## Smaller ones, worth exploring

- The design tool talks to the engine through the same door. Today it
  writes the engine's files and loads the engine's code directly
  (`config-tool/server.js:47`, `config-tool/lib/toolAuth.js:27`), and a
  published change shows at the engine's next restart.
- One described set per machine (engine version, apps, pack, media,
  profile), checked at start. Today these are separate checkouts and
  hand-copied media that nothing compares.
- The wall display becomes a screen like any other (follows from 1 and
  2).

## What the rest of the rebuild stands on

| Still to build | Stands on |
|---|---|
| Automatic restarts, the tablet healing a stale pack, the preflight | 5, 6, 1 |
| Applying a pack without a restart; the design tool's pages; rehearsal | 7, 6, 5, 4 |
| Capture and the night's record | 1, 4, 7 |
| Players' phones | 4, 1, 3 |
| The second game's modules | 2, 1, 4, 3 |
| A smaller install, a touring game, a game with scanners only | 2, 5 |
| A release other people can stand up | 3, 6 |

## Order, and the first step

1. Now, with no design question open: improvement 6. It is small and
   makes testing on a real machine safe.
2. The centre, as one thin slice end to end: one scan through the one
   door (4), into the record (1), out to a tablet and the wall display
   (1), in the published form (3), with the table's rows for start and
   end (7), proven with both games.
3. Widen: the rest of the facts; the rules on the tablet (2); the
   equipment interface and the supervisor (5), where the paused
   hardening work continues.

Top recommendation to look at first: improvement 1. Improvements 3, 4
and 7 take their form from it.
