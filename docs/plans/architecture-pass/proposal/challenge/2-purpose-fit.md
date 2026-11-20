# Challenge 2: fit to what the engine is supposed to be (2026-11-10)

An independent reader's report on the first draft
(`2026-11-10-proposal-draft.md`, in git history at `1bae2452`), read
against `../rework/2026-11-10-what-the-engine-is.md`, the roadmap, the
glossary, the engine design notes and the kit decision. Kept as
delivered. Paths are under the repository root.

**1. The pieces**

- Automatic restarts. 5 and 6 serve them, but the GM's "out of service" mark lives only in memory at `backend/src/services/dormancyService.js:41`, so a restart forgets it.
- Stale pack. It stands on 3 and 7, not 5 and 6, and must reach hardware scanners, which sync only at power-on.
- Preflight. Devices must be known before a session exists, yet `backend/src/routes/healthRoutes.js:86` drops a check-in when none does. 5's interface needs "try this one". The hand checklist belongs to the pack, not to three lines fixed for ALN's room at `backend/src/services/preflightService.js:49`.
- Applying a pack, design pages. Not "one more row". Every copy of the pack needs telling, the profile too. Put the tool through the door before its pages get built.
- Rehearsal. 5 stands in for outputs only. Add stand-ins for taps and time, where `backend/src/services/gameClockService.js:96` follows the wall clock, and a room view to watch. Square this with "a simulation is an ordinary profile".
- Venue pages, touring, several games. Separate "gear in this install" from "this game's names for it". Name speakers and screens in the pack, as lights are. Hardware scanners delete the other game's files on sync, at `arduino-cyd-player-scanner/ALNScanner_v5/services/AssetService.h:219`.
- Capture, many sessions. The record must only grow and stay open after "end". "Reset scores" erases the list at `backend/src/services/session/persistenceListeners.js:44`, a tablet drops queued taps when the next session appears at `ALNScanner/src/network/networkedSession.js:258`, and only one session exists.
- Phones. `backend/src/routes/packRoutes.js` serves the whole pack with no pass, so any phone can read every token's text and value. Filter the pack too.
- Second game. Nothing says where a new rule plugs in, and the record has ALN's shape. "Filtered" is too weak, since that game shows some players a false picture on purpose.
- Scanners and tokens alone. The seven live on the show machine and GM tablet. Contrary to the draft, the profile says whether a show machine exists and `backend/src/gameRules/resolution.js:53` reads it, but no device can. Nothing gathers a record.
- Release. Five repositories. Say where the one copy of rules and messages lives. Until then, check the tablet's rule copy by tests.

**2. ALN and physical/digital**

- Four replies fit ALN's single tap. Missing are "scan the next object" and "counted, but the room did nothing". Hardware scanners compile today's replies in at `arduino-cyd-player-scanner/ALNScanner_v5/services/ScanResponse.h:41` and take firmware only by cable, so a reply must carry what to show.
- "What each kind of device may do" should be who is acting. The grants file caps stations at viewing, at `backend/src/gameRules/grants.js:35`, and does not "already compute it".
- The record holds taps and typed entries, never what happened in the room. 7 covers one session, and nothing holds what belongs to an install.
- The draft never mentions the tag. What is written on it joins object to data and belongs in the protocol.
- The draft assumes answers to three open owner questions, on the cut-off tablet, mismatched devices and where the trial copy runs.

**3. Leave for later**

- Generated code for four kinds of program. Build-time checks exist in `backend/tests/contract/scanner/client-contract-conformance.test.js`. Add a version number.
- Rules as data for hardware scanners. They run none.

**4. Order**

- 6 first, with the stand-in half of 5. Separate names do not make two TVs.
- I would build 5 next, not a scan. No owner question blocks it, no game rule can leak in, the paused work resumes, and ten service domains already travel one way.
- The scan slice third, with a player's device and one non-ALN tap. The toy game is ALN-shaped by design, so "both games" proves nothing. Write the second game's taps as test cases first.
- The order forgets the old machine stays the fallback, so scanners must work with both.

**5. The split**

- Merge 1 and 4 into "one record per session, one way in, one way out". Make 3 its rulebook.
- Widen 7 into "what lasts how long", for a session, an install and a production.
- Give tablets, scanners, phones and displays the same standing as gear in 5. Make 6 a chore.
- Add "where new rules and new gear plug in", which the owner named.
