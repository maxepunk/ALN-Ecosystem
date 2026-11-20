# Challenge 1: the truth of the draft against the code (2026-11-10)

An independent reader's report on the first draft
(`2026-11-10-proposal-draft.md`, in git history at `1bae2452`). The
reader had the code in front of it and changed no file. Kept as
delivered. The agent running the pass checked the cited lines before
using them.

S is the "sound" list. n.m is improvement n, "Today" statement m, in
the first draft's numbering.

## Part 1

| Statement | Verdict | Correction |
|---|---|---|
| S1 start-up check | Overstated | The hand-written gate never reads the required `functions` block (`ALN-TokenData/game.schema.json:338`), and a folder without `game.json` boots on built-in ALN rules (`backend/src/services/packService.js:1358`). |
| S4 devices show their pack | Wrong for the phone | The phone loads its own nested checkout (`aln-memory-scanner/js/app.js:64`) yet shows the show machine's identity (`:100-102`). They differ on this tree. |
| 1.2 each fact built twice | Overstated | 40 call sites. One builder makes eight of ten service states. Of six callers in `backend/src`, only tests reach one (`backend/src/services/offlineQueueService.js:13-15`). The four recurrences were callers omitting a service (`backend/CLAUDE.md:529`). |
| 2.2 eighteen | Overstated | Sixteen. Two cited rows are not rule copies (`docs/plans/architecture-pass/relationships/2026-11-01-today-client-modules.md:291`). |
| 2.3 no-show-machine setting | Wrong on the profile | The profile declares it and the comparison reads it (`backend/config/profiles/installation-profile.schema.json:65`, `backend/src/gameRules/resolution.js:53`). Only the show machine loads the profile. |
| 3.2 nothing says so | Overstated | A contract test fails on a mismatch (`backend/tests/contract/scanner/client-contract-conformance.test.js:67-79`). Nothing says so at run time. |
| 3.3 the check drops fields | Wrong | The session discards the check's result (`backend/src/models/session.js:97-101`). The fixed list in `toJSON()` drops them (`:308-326`). |
| 4.1 three ways in | Wrong | Six paths write. Add batch upload (`backend/src/routes/scanRoutes.js:202`), device registration on a health read (`backend/src/routes/healthRoutes.js:51-88`), playlist write (`backend/src/routes/musicRoutes.js:40`). |
| 5.1 no interface | Overstated | Six of seven share an unwritten one: `init`, `getState`, `reset`, `cleanup`, and a probe under two names (`backend/src/services/serviceHealthRegistry.js:236-244`). |
| 5.3 sound restart | Wrong | `backend/src/services/soundService.js:75` starts one short player per sound. Nothing restarts it. |
| 6.3 tests on live equipment | Overstated | Jest suites switch video, music and lighting off (`backend/jest.config.base.js:11-43`) but run the audio kill command (`backend/src/services/audioRoutingService.js:110`). Only the browser suite uses a live display. |
| 7.1 two lists | Wrong | Five. Add shutdown (`backend/src/server.js:163-217`) and the start, pause and end cascades (`backend/src/services/sessionService.js:284-559`). |
| S2, S3, S5, S6, 1.1, 1.3, 2.1, 3.1, 4.2, 4.3, 4.4, 5.2, 5.4, 6.1, 6.2, 7.2, 7.3 | True as written | 6.1 counts 13. |

## Part 2. Not covered

1. Nothing builds the engine. Fourteen modules export one shared instance, and thirteen call sites type the service list by hand. One omits music (`backend/src/websocket/adminEvents.js:77-90`). Improvements 5, 6 and 7 each need one place that builds the parts. Belongs to 6.
2. The record is one rewritten snapshot. Delete and reset erase history (`backend/src/services/transactionService.js:721`, `backend/src/services/session/persistenceListeners.js:44`), and the show machine writes a phone's queued scans into the next group's session (`backend/src/routes/scanRoutes.js:317-331`). Capture and hidden state need a log. Belongs to 1.
3. A game is not one thing on a machine. Token media come from the phone app's repo (`backend/src/routes/resourceRoutes.js:19`), the design tool edits only `ALN-TokenData` (`config-tool/lib/configManager.js:30-39`), and the only switch is a test override (`backend/src/services/packService.js:167-175`). The toy pack has no media, so the two-game rule cannot see this. Belongs to none.
4. Install facts sit in five places, including the profile (`backend/src/services/profileService.js:12-15`), `routing.json` (`backend/src/app.js:265`) and `.env` (`backend/src/config/index.js:138`). The default profile is ALN's kit (`backend/src/services/profileService.js:31`). Touring needs one document. Belongs to 5.
5. The whole pack and record are open. Three reads ask for no pass (`backend/src/routes/packRoutes.js:34`, `backend/src/routes/stateRoutes.js:32`, `backend/src/server.js:75`), and each phone loads every token's text (`aln-memory-scanner/js/app.js:64`). Hidden state cannot survive that. Belongs to 1 and 4.

## Part 3. Wrong aim or underpriced

- Improvement 2 aims at the wrong code. The tablet's copy, `ALNScanner/src/core/storage/LocalStorage.js`, mirrors the record in `backend/src/services/transactionService.js`, not the 679 lines of game rules in `backend/src/gameRules/`. So 2 is 1, written for a browser from the first slice.
- Improvement 4 leans on a file that ignores the pack (`backend/src/gameRules/grants.js:7-12`). Neither player scanner carries a pass (`backend/src/routes/scanRoutes.js:19`), so each phone and hardware scanner needs one.
- Improvement 5 adds a second kind of stand-in. The ratified kind is an ordinary profile pointing the real programs at stand-in equipment (`CONTEXT.md:528-536`), already built for tests (`backend/tests/rung1/provision.js`).
- Improvement 6 is not small. Copies also collide on the player's bus name (`backend/src/services/vlcMprisService.js:16`), audio streams matched by program name (`backend/src/services/audioRoutingService.js:36`) and display `:0` (`backend/src/utils/displayDriver.js:56`).
- Improvement 7 calls a new pack one more row. The show machine freezes the pack at start (`backend/src/services/packService.js:96-101`, `backend/src/app.js:199-203`), and so does every device. A restart also drops every tablet's pass (`backend/src/middleware/auth.js:13`).
- All seven must carry about 101,000 lines of show machine and tablet tests with per-file coverage floors (`backend/.coverage-thresholds.json`). The draft prices none.
