# Check of the engine-jobs document (refute by default)

**Status: check, for the orchestrator to apply.** It tests `docs/plans/architecture-pass/2026-10-31-engine-jobs.md` (EJ) and its page data `docs/plans/architecture-pass/report/2026-10-31-engine-jobs.json` (EJS) against five claims: (1) every capability and flaw is placed in EJ section 5 and agrees with the mapping sheets; (2) every long-term goal traces to the roadmap, the direction map or an owner decision, or is marked open; (3) every "falls short" sentence agrees with the analysis and the standalone pass; (4) every test case comes from the analysis's candidate proving tests and would fail today; (5) capability ids and flaw ids are never confused and owner-facing fields carry no file names, codes or finding ids. A claim that could not be confirmed is "corrected". Nothing here decides a design.

- **Date:** 2026-11-01. **Tree:** `/home/user/ALN-Ecosystem`, branch `claude/nice-curie-hescfv`. Nothing was run except `sed`, `grep`, `awk` and short Python scripts that compare tables and scan the JSON. The stale clones beside the repository were not read. `backend/.env` was not opened.
- **Citation keys.** EJ as above (a citation `EJ:N` is line N). AN = `docs/plans/architecture-pass/2026-10-30-cause-analysis.md` (it has sections 1 to 7; there is no section 8). SP = `docs/plans/architecture-pass/2026-10-31-standalone-pass.md`. JC = `docs/plans/architecture-pass/2026-10-31-jobs-capabilities.md`. JF = `docs/plans/architecture-pass/2026-10-31-jobs-flaws.md`. MD = `docs/plans/architecture-pass/2026-10-30-map-direction.md`. K = `docs/plans/architecture-pass/consistency/2026-10-31-consistency-causes-9-16.md`. CS = `docs/plans/CURRENT-STATE.md`. PD = `docs/plans/2026-10-30-architecture-pass.md`. CARDS = `docs/plans/architecture-pass/report/2026-10-31-cause-cards.json`. PR = `docs/agents/process.md`.
- **Ids.** A capability is named in words with "capability N" in brackets. C1 to C16 and N1 are the design flaws only. Finding ids (A-05, SG-03 and so on) appear only in evidence cells.
- **What the checks found, in short.** The flaw table and every flaw sentence's placement match JF exactly, and the capability table matches JC's table row for row. Five capability mentions in EJ section 3 sit under a job their row does not list, an inconsistency EJ inherits from JC (its section 3 and its table disagree). One citation names capabilities by the direction map's row ids C16, C18 and C20, which clash with the flaw ids. Ten "falls short" or standalone sentences overstate scope or name the wrong mechanism, and two more need only plain words. Three tests are not from the analysis's proving tests (one of them need not fail today), and one inverts the analysis's expected result; one more drops a caveat it needs to be runnable. One goal states an inference as settled. The page data carries a dozen technical words in owner-facing fields; it carries no file names and no finding ids.

## 1. Job entries

One table per job. "Field" names the part of the entry; tests are numbered as in EJ. The corrected text replaces the EJ text in full, and the same text replaces the matching EJS field (EJS mirrors EJ word for word; checked by script: every `meaning`, `goal`, `standalone`, `needs`, `flaws[].how` and `tests` string of EJS occurs in EJ).

### J1. Run any game from its pack (EJ:47-77)

| Claim (field) | Verdict | Evidence | Corrected text in full |
|---|---|---|---|
| Goal traces to the roadmap and direction map | corrected (wording only) | Every sentence traces: MD:53 (designer, RM:48-54), MD:62 (parity, RM:137-149), MD:63 (no opinion), MD:60 (media model, RM:112-126), MD:71 (toy pack). The only fault is the owner-facing word "hash" (claim 5). | A designer builds a complete game as a pack and never touches code or configuration; everything a designer iterates on is pack data, never firmware. The engine holds no opinion about game design. The pack names media by fingerprint; a bundle carries the files. A second game stays in the repository, and every change passes the two-pack run. |
| Needs: capability placements agree with EJ section 5 | corrected | EJ:59 lists hot-apply (capability 16) under J1, but its section 5 row (EJ:433) lists J6 primary and J2, J5, J10 secondary, not J1. JC does the same (JC:105 vs JC:39). The demand is real (MD:143-144, the list of pack copies). Fix the row, not the bullet: see section 4, capability 16. Also "hash" in the media-bundle bullet (claim 5). | Needs bullet 3 unchanged. Needs bullet 2 (EJ:58, EJS `needs[2]`): "The media bundle (capability 40) and the ledger retirements (capability 50): the pack names its files by a fingerprint of their contents and carries no venue-hardware name." |
| C12 (primary): "read at scattered moments ... TV, the engine and a tablet can end up running different versions" | holds | AN:41 (C12: scattered reads, no change message; D-03 TV by new rules, engine by old; B-20 / C-08 tablet on a different pack). | |
| C14 (secondary): "the hardware scanner cannot read the pack's own token file" | holds | SP:195 (SP-14: the pack's token file is flat, the device reads only a wrapped one); SP:131. | |
| C15 (secondary): "Media files reach the devices by hand copy, outside any check the pack provides" | corrected | Overstated scope. AN:766 (A-95) and AN:47 say media is copied by hand onto the show machine and nothing lists missing files; the hardware scanner gets its pictures and audio from the engine's own asset sync, not by hand (root `CLAUDE.md`, ESP32 Asset Sync; SP:194 says only a fresh card has no other source). | C15 (secondary). The videos and other media files the pack names are copied onto the show machine by hand, and nothing checks that every file the pack names is there. |
| N1 (secondary): pack has no standalone field, yet declares a scoreboard, a clock and videos | holds | SP:243 (N1); SP:171 (SG-07 scoreboard evidence), SP:174 (SG-10 clock), SP:187 (SP-06 video); SP:19 (no pack field). | |
| Standalone line | holds | SP:119 (card line), SP:167 (SG-03), SP:291. | |
| Questions 6, 5, 8 | holds | AN:41 ("Questions 6, 5 and 8"). | |
| Test 1 (edit a rating on disk) | corrected (wording only) | AN:634 (B-07 / D-04); fails today, AN:975 ("the file's sha1 differs from the manifest's"). Only "hash" is jargon (claim 5). | 1. Edit one token's rating on disk with the engine running and no restart: the token list, the pack file and the points a scan awards all agree, and the file's fingerprint matches the one in the engine's own list of pack files. |
| Test 2 (tablet on a different pack) | holds | AN:634 (B-20 / C-08); fails today, AN:976 ("only a backend log line"). | |
| Test 3 (group test on both packs) | holds | AN:835 (A-82); fails today on the real-pack leg, AN:996 ("no group-completion test runs on real content"); AN:835 notes the toy leg alone could pass. | |
| Test 4 (standalone mid-game pack publish) | corrected | Not from the analysis's proving tests: it comes from the standalone pass's candidate change (SP:118) and finding SG-03 (SP:167); the standalone pass has no proving-test field. The analysis's C12 tests (AN:634) include one that fits J1's new clause and fails today: D-05, the phone's token file is pinned to an older pack (SP:115; AN:610 status "present"). The SG-03 behaviour stays in J1's standalone line. | 4. With no alternate pack chosen, compare the phone scanner's token file with the engine's own pack: they are the same version. [AN:634 (D-05)] |
| Entry as a whole | corrected | Five rows above. | |

### J2. Keep one true record of the game, and show it truly everywhere (EJ:79-115)

| Claim (field) | Verdict | Evidence | Corrected text in full |
|---|---|---|---|
| Goal traces | holds | MD:64 (authority split, CMD:89-93, CTX:241-244); MD:232 (engine-side filtering, PRG:244-249; "fatal" for hidden-information games); PD:98 (question 1). "How copies are kept correct is step 3's work" marks the open part. | |
| Needs: capability placements | corrected | EJ:89 names photo capture (capability 31) under J2; its row (EJ:448) lists J3 primary, J7 secondary. EJ:92 names remote displays (capability 39) under J2; its row (EJ:456) lists J7, J4, J8. Both copied from JC:112 and JC:115 against JC's own table (JC:54, JC:62). Fix the rows: section 4, capabilities 31 and 39. | Bullets unchanged; rows corrected in section 4. |
| C1 (primary): "after a delete or a Reset All Scores a tablet keeps refusing a token the engine has freed" | corrected | Scope. The delete case hits every connected tablet (AN:19, A-05 / C-04); the Reset All Scores case hits only a tablet that was disconnected during the reset (AN:19, A-06 / C-30). EJ's own J5 line says so (EJ:203). | C1 (primary). Every tablet keeps its own list of claimed tokens that only grows, so after a delete every connected tablet keeps refusing the token the engine has freed, and a tablet that was offline during a Reset All Scores keeps the old claims when it reconnects. |
| C6 (primary) | holds | AN:29. | |
| C9 (primary) | holds | AN:35 (C-07 result screen before the engine answers; D-10 "revisited"). | |
| C11 (primary) | holds | AN:39 (B-39 video; C-26, C-28, C-25 the scan-gate copies; K:19 for C-25's window); teams C-24 at SP:222. | |
| C2 (secondary) | holds | AN:21. | |
| C4 (secondary) | holds | AN:25 ("clients infer boundaries from whatever arrives"; A-01 / C-39, C-05). | |
| C5 (secondary): "the broadcasts are wired before the saved record, so an old transaction list comes back to the TV" | corrected | Mechanism and scope. AN:27: the reset wires the broadcasts before the persistence listeners, so a *later Reset All Scores* sends *every tablet and the TV* the old transaction list and cleared evidence returns (A-53 / B-02 / C-37 / D-30). J2 is about every screen, so the tablets belong in the sentence. | C5 (secondary). After a Reset System the broadcasts are wired before the saving step, so a later Reset All Scores sends every tablet and the TV the old transaction list, and cleared evidence comes back. |
| C7 (secondary) | holds | AN:31 (B-64 / C-32 replay; B-69 / C-35). | |
| C12 (secondary) | holds | AN:41 (B-20 / C-08 "only logged"). | |
| C14 (secondary): "reads a score field the facade does not have" | corrected (wording) | Mechanism agrees with AN:45 and AN:698 (A-03 / C-06: reads `backendScores` off the facade; the scoreboard shows the real total), but "facade" is a code word in an owner-facing field (claim 5; PR:236-238). | C14 (secondary). Team Details reads the score from a place the tablet never fills, so it shows the wrong score while the scoreboard screen shows the right one. |
| Standalone line | holds | SP:31 (card line), SP:170 (SG-06), CS:60 (question 24). | |
| Questions 1, 5, 8, 9 | holds | AN:19 (C1: 1, 8), AN:29 (C6: 9, 8), AN:35 (C9: 1, 5), AN:39 (C11: 5). | |
| Test 1 (delete, rescan, no reload) | holds | AN:95 (A-05 / C-04, "accepted (fails today)"); EJ keeps only the half that fails today. | |
| Test 2 (Reset All Scores while disconnected) | holds | AN:95 (A-06 / C-30). | |
| Test 3 (live message vs connect entry) | holds | AN:313 (B-30); AN:291 status present. | |
| Test 4 (refused scan never says complete) | holds | AN:473 (C-07); AN:954 (today: "Transaction Complete!" with local points). | |
| Entry as a whole | corrected | Four rows above. | |

### J3. Answer every action, and remember what happened (EJ:117-147)

| Claim (field) | Verdict | Evidence | Corrected text in full |
|---|---|---|---|
| Goal traces | holds | MD:55 (RM:62-65); MD:108-112 and MD:223-228 (RM's Block 4: capture touches the game-session model and persistence across restart, so "the engine's own record" is the roadmap's); CS:55-57 (question 19 open, marked as open). | |
| Needs: capability placements | holds | Capabilities 30, 31, 32, 33, 34 and 14 all list J3 in EJ section 5 (EJ:447-451, EJ:431). | |
| C7 (primary) | holds | AN:31 (B-22 / D-13 deletes scans never stored; B-64 / C-32 replays a scan that can never succeed). | |
| C4 (secondary) | holds | AN:25, AN:202 (A-01 / C-39). | |
| C9 (secondary): "A refused scan is recorded nowhere, so the night's record misses what GMs and players tried" | corrected | Wrong home and overstated. The finding behind it, B-08 (a refused GM scan recorded nowhere), is set aside in the analysis as the owner's question 19, not filed under C9 (AN:863; SP:225; CS:55-57); JF:92 gives C9 this line on B-08. "Players" overstates: networked player scans are stored as the session's player scans (SP:186). What C9 does give J3 is the tablet answering before the engine (AN:442, C-07) and, standalone, a paused-game scan shown complete and recorded nowhere (SP:212). | C9 (secondary). The tablet shows its own verdict before the engine answers, so the GM can see "Transaction Complete" for a scan the engine then refuses; in a standalone game a scan into a paused game shows complete and records nothing. Whether refused scans belong in the night's record is the owner's open question, not this flaw. |
| C11 (secondary) | holds | AN:562 (A-08, the report's two totals). | |
| C13 (secondary): "because a device's own word decides what it is called" | corrected | Mechanism. B-71 / D-32 (AN:662): the hardware scanner's health check sends no type and the route accepts only "player", so the route's default decides, not the device's word. AN:43 names both ("a client's word or a route's default"). | C13 (secondary). The device list records a hardware scanner as a phone scanner, because the route it checks in on assumes "player" when a device sends no type. |
| N1 (secondary) | holds | SP:186 (SP-05). | |
| Standalone line | holds | SP:79 (C7 card line), SP:186 (SP-05), SP:166 (SG-02), D-17 at SP:235. | |
| Questions 1, 8 | holds | AN:31. | |
| Test 1 (batch with no game) | holds | AN:359 (B-22 / D-13); present. | |
| Test 2 (batch, restart, resend) | holds | AN:359 (B-21 / D-15); present. | |
| Test 3 (end, reconnect, history kept) | holds | AN:239 (A-01 / C-39); AN:914 (today the tablet loses history and the wall goes blank). | |
| Test 4 (Skip twice) | holds | AN:359 (B-65 / C-33); AN:332 status present. "Each matched to its own press" adds C7's own demand (AN:31) and still fails today. | |
| Entry as a whole | corrected | Two rows above. | |

### J4. Run the show's equipment, and know its true state (EJ:149-180)

| Claim (field) | Verdict | Evidence | Corrected text in full |
|---|---|---|---|
| Goal traces | holds | MD:273 (health words, ratified); MD:274 and MD:168-169 (supervisor, ratified; "one supervision path is owner-ruled", HP:57); MD:172 (host modes); PD Appendix A decision 3 (PD:336-339: "An outside program can be an authority"). | |
| Needs: capability placements | corrected (wording only) | Capabilities 9, 10, 11, 8, 15, 39, 40 all list J4 (EJ:426-432, EJ:456-457). Two owner-facing code words (claim 5): "kiosk" in bullet 1 and "health registry" in bullet 5. | Bullet 1: "The supervisor (capability 9): each program gets one restart rule with bounded tries and then a red row, and the engine tells its own video or music player from a stranger's. Today four different restart shapes exist and the TV's browser has none." Bullet 5: "Service domains (capability 15): no service keeps a private 'connected' note beside the shared health list, and one store for hold expiry instead of two." |
| C2 (primary) | holds | AN:21. | |
| C3 (primary) | holds | AN:23 (a cache re-read only in part, no age; the queue, cues and health rows trust it). | |
| C5 (secondary) | holds | AN:27, AN:257 (B-01). | |
| C10 (secondary): "Services that are not installed tonight read as a calm green count" | corrected | Mechanism. B-72 / C-48 (AN:491): a missing or broken profile makes installed services read "not installed" and the panel reads calm green; services that really are not installed tonight showing grey is the intended design (MD:69). | C10 (secondary). When the venue profile fails to load, six services that are installed read "not installed", and the panel shows a calm green count. |
| C11 (secondary): eight answers, paused counts as not playing for four | holds | K:18 (K4: eight answers, ducking the eighth); AN:536 ("four of seven answerers"); "four of them" is true of the eight. | |
| Standalone line | holds | SP:33-47 (C2 and C3 do not apply). | |
| Questions 2, 3, 5 | holds | AN:21 (C2: 2, 9), AN:23 (C3: 3, with 5 for the gates). | |
| Test 1 (video started within half a second) | holds | AN:183 (A-68); AN:149 "present (fix absent)". | |
| Test 2 (kill the music player) | holds | AN:183 (A-72 / A-73); AN:153 present. | |
| Test 3 (lighting stop and start) | holds | AN:131 (A-11); AN:897 (today: stays unavailable, dead tiles). | |
| Test 4 (paused video and the queue) | holds | AN:587 (B-39); AN:967. | |
| Entry as a whole | corrected | Two rows above. | |

### J5. Move each game through its life cleanly (EJ:182-215)

| Claim (field) | Verdict | Evidence | Corrected text in full |
|---|---|---|---|
| Goal (marked open) traces | holds | MD:183 (PGS:490-492), MD:245 (RM:567-570), MD:176 (HP:256-271), MD:255 (BCM:137); open items PD:103 (question 6) and MD:200 (standing cues in setup). | |
| Needs: "eleven list it as a secondary job"; dormancy (capability 8) and the second game (capability 38) listed | corrected | EJ:194 and EJ:197 name capabilities 8 and 38 under J5, but neither row lists J5 (EJ:425, EJ:455); the eleven at EJ:191 are 7, 11, 13, 14, 16, 18, 27, 30, 32, 44, 46 (counted from EJ section 5). JC has the same split (JC:140 and JC:143 vs its table rows JC:31 and JC:61). Both demands are lifecycle demands (MD:160-163 recompute at reset; MD:236 hidden state across a restart), so the rows gain J5: section 4. | Needs bullet 1: "No capability exists mainly for J5, but thirteen list it as a secondary job (the eleven in the capabilities sheet's table, plus dormancy (capability 8) and the second game's modules (capability 38), which that sheet's section 3 places here); together they ask for one table of every fact against every moment." |
| C4 (primary) | holds | AN:25 (B-61 / D-31, B-17 / C-38). | |
| C5 (primary) | holds | AN:27 (B-01 music; the later Reset All Scores sends the old list, A-53 / B-02). | |
| C1 (secondary) | holds | AN:19 (A-06 / C-30). | |
| C6 (secondary) | holds | AN:29; SP:67 (A-22: the restore fires no live event). | |
| C7 (secondary) | holds | AN:31, AN:334 (B-69 / C-35). | |
| Standalone line: "opens into an unnamed Active game that no screen can restart ... the phone's seen list and the hardware scanner's queue outlive every game and are sent into a later networked game" | corrected | Two overstatements. SG-01 (SP:165) says no screen can *start a named or second game*, not "restart". Only the hardware scanner's queue lines are sent into a later engine game, and those stamped 1970 (every line taken without WiFi) are refused there (SP:199, SP-18); the phone's seen list is never sent (SP:51). | The tablet decides every boundary, but start, pause, end, reload, a day change and a pack change each run their own code; the tablet opens into an unnamed Active game, no screen can start a named or second game, and Pause cannot work on the opening one; the phone's seen list and the hardware scanner's queue outlive every game, and the queue's lines are sent into a later networked game, which refuses those without a real time. |
| Questions: 6 only, "reached by no other" | holds | AN:25, AN:27 (C4, C5: question 6). JC:265 says J5 is reached by one question only (on the six-question list of PD decision 1); within EJ's own entries no other question reaches J5. | |
| Test 1 (end, restart, scan) | holds | AN:239 (B-61 / D-31); AN:882 (today the ended game is current again). | |
| Test 2 (once-only cue in game two) | holds | AN:239 (B-17 / C-38); AN:915 ("It does not fire"). | |
| Test 3 (Reset System, every tablet empty) | holds | AN:239 (C-36); AN:924. | |
| Test 4 (reset, then Reset All Scores) | holds | AN:273 (A-53 / B-02 / C-37 / D-30); present. | |
| Entry as a whole | corrected | Two rows above. | |

### J6. Let designers build, change and try games safely (EJ:217-244)

| Claim (field) | Verdict | Evidence | Corrected text in full |
|---|---|---|---|
| Goal traces | holds | MD:61 (RM:128-135), MD:182-183 (PGS:344-352, PGS:490-492), MD:197 (PGS:502-505); the open item "where a preview engine runs" is marked (MD:40, MD:305). | |
| Needs: capability placements | holds | Capabilities 17, 4, 16, 18, 20, 21, 19, 48, 41, 52 all list J6 (EJ section 5). | |
| Citation EJ:232: "MD rows C16, C18, C20" | corrected | Claim 5: the direction map's row ids C16, C18 and C20 name capabilities and clash with the flaw ids C16 (and the flaw range). | [JF:140 (why no flaw is primary: hot-apply, the loop and the preview engine are not built; the direction map's rows for capabilities 16, 18 and 20, MD:94, MD:96, MD:98)] |
| C8 (secondary): "kills the live engine's helpers, writes into its records and mints passes the live engine accepts" | corrected | Overstated. The analysis's finding is the kill: a second engine kills the live sound-server listener, kiosk and music player (AN:424, "fails today on the sound-server listener, the kiosk and MPD"; AN:377). Writing into the live records and minting accepted passes is the design-tool plan's warning about a preview engine, which the analysis quotes under capabilities C8 burdens (AN:430; MD:194, PGS:302), not a finding. | C8 (secondary). A second engine on the same machine kills some of the live engine's helpers (the sound system's watcher, the TV's browser and the music player); the design-tool plan warns that a preview engine would also write into the live engine's saved records and issue passes the live engine accepts. |
| C12 (secondary) | holds | AN:606 (B-28 / D-38); AN:977. | |
| Standalone line | holds | JF:149; SG-03 at SP:167 filed under J1. | |
| Questions 4, 6 | holds | PD:101, PD:103. | |
| Test 1 (publish a rating) | holds | AN:634 (B-28 / D-38); AN:977 (today nothing changes until a restart). | |
| Test 2 (second engine) | corrected (wording only) | AN:424 (B-63, D-72 to D-74), fails today. Owner-facing code words "kiosk" and "sound-server listener" (claim 5). | 2. Start a second engine on the same machine while a show runs: the first engine's video player, music player, the TV's browser and the sound system's watcher are untouched. [AN:424 (B-63, D-72 to D-74)] |
| Test 3 (swap a pack mid-game) | corrected | AN:634 (B-29) carries a caveat EJ drops: "in this tree a swap needs a restart, since a pack is activated once per process, so the test swaps across a restart with the game record kept". Without it the test cannot be run today. | 3. Swap a pack mid-game and delete a transaction: scores equal what the original rules awarded, or the swap is refused during a game. Today a swap needs an engine restart, so the test swaps across a restart and keeps the game. [AN:634 (B-29); SP:223] |
| Entry as a whole | corrected | Four rows above. | |

### J7. Give each person exactly what their role needs, and let each do only what their role allows (EJ:246-273)

| Claim (field) | Verdict | Evidence | Corrected text in full |
|---|---|---|---|
| Goal traces | holds | MD:58 (RM:81-100); MD:90 and MD:177 (HP:272-285; ruling R5, MD:286; "handshake `deviceType` retired"); MD:232 (PRG:244-249); MD:67 (floor); MD:70 (secrets). | |
| Needs: capability placements | holds | Capabilities 12, 13, 35, 38, 39, 27, 47 all list J7 (EJ section 5). | |
| C13 (primary) | holds | AN:43 ("every socket gets everything"; same station name; B-24 / C-59). | |
| Standalone line | holds | SP:127. | |
| Questions 7, 1 | holds | AN:43. | |
| Test 1 (no credential, "scanner") | holds | AN:680 (B-04); AN:652 present. | |
| Test 2 (state with no credential) | holds | AN:680 (B-27 / D-27); present. | |
| Test 3 (connect as a TV) | corrected (wording only) | AN:680 (D-25, D-26), fails today. "Connect payload" is a code word (claim 5). | 3. Connect as a TV: it receives only the events its role needs, and what it receives on connecting holds only exposed evidence and team totals. [AN:680 (D-25, D-26)] |
| Test 4 (reconnect under its own name) | holds | AN:680 (B-24 / C-59; a clean reload passes today, so the test uses a dropped network or a killed browser, as EJ does). | |
| Entry as a whole | corrected | One wording row. | |

### J8. Run wherever the venue and the game need (EJ:275-306)

| Claim (field) | Verdict | Evidence | Corrected text in full |
|---|---|---|---|
| Goal traces, open parts marked | holds | MD:59 (RM:102-111), MD:54 (RM:55-61), MD:62 (RM:137-149), CS:35-44 (decision 22), CS:60-62 and SP:251 (one tablet; where the standalone fact lives, both marked open). | |
| Needs: capability placements | holds | Capabilities 5, 23, 24, 22, 10, 42, 43, 49, 25 all list J8 (EJ section 5). | |
| N1 (primary) | holds | SP:243; SP:19. | |
| C4, C8, C9, C10, C15 (secondary) | holds | SP:52 (C4); AN:33 (C8); SP:91 (C9); SP:99 (C10); AN:47, AN:772-773 (B-98, B-100). | |
| Standalone line ("behind the phone in seven rows") | holds | SP:19; SP:284 (rows 1 to 4, 17, 23, 24 = seven). | |
| Questions 1, 6 | holds | SP:288-289. | |
| Test 1 (standalone pause and end) | holds | AN:473 (A-02 / C-09); SP:212 and K:16 (K2: today it shows complete and locks the token until a reload; an ended game accepts). | |
| Test 2 (same transactions through both rule sets) | corrected | Not from the analysis's proving tests (it is the standalone pass's candidate change, SP:150), and as written it need not fail today: on plain transactions the existing cross-mode run already compares tablet and engine scores (SP:147). Replaced by the analysis's C15 proving test for a new machine, which fails today (AN:772: the TV's browser still defaults to the older system's name). | 2. On a new machine whose operating system gives the speaker rule and the TV's browser their new names, start the engine: it logs no warning and the TV page opens. [AN:786 (B-98)] |
| Test 3 (standalone device says "standalone") | corrected | Not from the analysis's proving tests: it comes from the standalone pass's parity row 17 (SP:275) and card change (SP:102). The analysis has no proving test for N1, J8's primary flaw, because N1 is the standalone pass's proposal (SP:243; CS:59, question 23). It fails today (nothing can declare a game standalone, SP:19; the phone says Offline, SP:184). Kept, with its source stated. | 3. Start a player device with no engine in a game declared standalone: it says "standalone", not "offline" or "disconnected". [Not an analysis proving test: the standalone pass, parity row 17 (SP:275) and the card change at SP:102; N1 has no proving test in the analysis.] |
| Test 4 (clean machine; install line) | holds | AN:786 (A-88 / X-03, B-100); AN:769 present; AN:773 (B-100 "the same bare `pip install` instruction remains" in the player scanner's files, so it fails today). | |
| Entry as a whole | corrected | Two rows above. | |

### J9. Tell the truth about what it knows (EJ:308-337)

| Claim (field) | Verdict | Evidence | Corrected text in full |
|---|---|---|---|
| Goal traces | holds | MD:68 (RM:309-317, CTX:434-442), MD:69, MD:157 (C23:251), MD:156 ("the ruled fix is a failed-check row and a start refusal", HP:49), MD:193 (PGS:483-489). | |
| Needs: capability placements | holds | Capabilities 6, 7, 8, 19, 28, 29 all list J9 (EJ section 5). | |
| C10 (primary) | holds | AN:37. | |
| C2 (secondary): "A panel cannot tell that it is behind" | corrected | Mechanism. The sentence describes C10's missing age, not C2. C2 is health and state on two routes, so a panel's state falls behind its health row (AN:21, A-12 / B-33). | C2 (secondary). A service's own state travels on a different route from its health, so a panel can keep showing an old state after the health row has changed, with nothing to say it is behind. |
| C3 (secondary) | holds | AN:23 ("carrying no age"). | |
| N1 (secondary) | holds | SP:102, SP:243. | |
| Standalone line | holds | SP:103, SP:173 (SG-09). | |
| Questions 8, 2 | holds | AN:37. | |
| Test 1 (mistyped profile path) | holds | AN:524 (B-72 / C-48); AN:960. | |
| Test 2 (mixed standing cue) | holds | AN:524 (B-76 / C-47). | |
| Test 3 (cut a tablet's connection) | holds | AN:524 (C-03); AN:956. | |
| Test 4 (kill the engine) | holds | AN:524 (D-16, D-22); AN:962 (today about 100 seconds on the hardware scanner). | |
| Entry as a whole | corrected | One row above. | |

### J10. Stay trustworthy as it changes (EJ:339-369)

| Claim (field) | Verdict | Evidence | Corrected text in full |
|---|---|---|---|
| Goal: "One naming layer serves tests and preview engines alike" | corrected | Decides a design the owner has not decided. The preview engine's isolation seam is in the design-tool plan (MD:194, PGS:354-364); that the same layer serves tests is the direction map's own inference (MD:256 "Inference: a test run and a preview engine need the same namespace seam. Build it once"; MD:244 "Inference"). The rest traces: MD:251, MD:252, MD:71, MD:65, MD:122. | A ladder of test environments, with a first rung that runs the real software stack with fake physics. Tests skip loudly with a reason, never silently. Every slice passes the two-pack run. Nothing deploys to the live machine until the owner's show-ready decision; rollback is plugging the old machine back in. Open: whether tests and previews share one naming layer. |
| Needs: capability placements | corrected (wording only) | Capabilities 46, 42, 20, 9, 29, 44, 45, 51 all list J10 (EJ section 5). Bullet 1's "audio-init off switch for harness children" is code wording (claim 5). | Bullet 1: "The test environment (capability 46): tests cannot touch the live machine's tracking files, the TV or its players; they skip loudly with a reason; a switch that stops test copies of the engine from starting the sound system is not built." |
| C8 (primary): "so a test run killed the live show's video player" | corrected | Scope. That kill was on blue's tree; in today's tree the same run kills the live engine's video-signal monitor and overwrites its process files (AN:33, AN:377, AN:936). | C8 (primary). The engine names its helper files in fixed places and kills by pattern across the whole machine, and the tests adopt the real display and audio, so a test run killed the live show's video player on blue, and in today's tree the same run kills the live engine's video-signal watcher and overwrites its helper files. |
| C14 (primary) | holds | AN:45. | |
| C15 (primary) | holds | AN:47 (A-91, A-92); K:22 (K8: the damage happens between shows and reaches the next show; the sentence names no time). | |
| C16 (primary) | holds | AN:49. | |
| Standalone line | corrected (wording only) | SP:147, SP:191, SP:204, SP:237 agree. "CI job" is code wording (claim 5). | The phone's pack-identity test passes on a file the deployed folder lacks, the hardware scanner's production boot path has no test, and no automatic test run covers either device's standalone path end to end; the one cross-mode proof compares tablet and engine scores only, and its group case skips on the real pack. |
| Questions 4, 5 | holds | AN:33 (C8: 4), AN:45 (C14: 5 nearest), AN:47 and AN:49 (gaps), CS:55 (question 18). | |
| Test 1 (unit suite beside a live engine) | corrected (wording only) | AN:424 (A-75 / D-52), fails today (AN:936). Code words "signal monitors", "sound-server listener", "kiosk", "process file" (claim 5). | 1. Start a live engine and run the unit tests: the music player, the video-signal watchers, the sound system's watcher and the TV's browser all keep running, and the files that track them are unchanged. [AN:424 (A-75 / D-52)] |
| Test 2 (fakes against real classes) | holds | AN:835 (A-51); AN:804 present. | |
| Test 3 ("the two reset tests that pass today only under the test flag fail on it") | corrected | Inverts the analysis. AN:835 (X-04): on a test layer where the wiring between services behaves as in production, "the B-03 and B-01 tests fail on it today", which shows today's faults; EJ makes failing the thing that must happen, and "pass today only under the test flag" is not what AN says (B-01's music-cue half passes in production, AN:273, AN:883). "Listener registry" and "test flag" are code words (claim 5). | 3. Give the tests a layer that runs Reset System the way the show does (today the wiring between services is undone only under test): on it, after a reset the music panel shows the new track within a second, and a cue on video start fires exactly once. Both fail today on that layer. [AN:835 (X-04); AN:273 (B-01, B-03)] |
| Test 4 (rollback) | holds | AN:786 (A-91); AN:990. | |
| Entry as a whole | corrected | Six rows above. | |

## 2. The rest of the document

| Claim | Verdict | Evidence | Corrected text in full |
|---|---|---|---|
| EJ section 1 (purpose and standing rules, EJ:12-28) | holds | MD:52-71, line for line; RM keys via MD. | |
| EJ section 2 (the jobs at a glance) | holds | J1, J7 and J8 carry the marked changes of questions A to C; the rest is the orchestrator's draft word for word. | |
| EJ:5 decision 26 at CS section 0, item 26, lines 45-53 | holds | CS:45-53. | |
| EJ:373 section 4 rule: "Three wording changes met that bar [both mapping sheets give a strong reason]" | corrected | No change has both sheets asking for the same words. A: each sheet asked for a different clause (JC:278; JF:234). B and C: only the flaws sheet asked for wording (JF:227, JF:229); the capabilities sheet reads the draft J7 as already holding "who is allowed to do what" and keeps it whole (JC:275), and for J8 lists the need with no wording proposal (JC:171). | The rule for this document: keep the draft jobs unless the mapping sheets give a strong reason to change one. Three wording changes are applied (A to C): in A each sheet asked for one of the two clauses; in B and C the flaws sheet asked for the wording and the capabilities sheet already files the same rules or need under that job. The owner can undo any of them with a word. Four more proposals are not applied (D to G). Nothing below decides a design. |
| Question A | holds | JC:278 (proposal 8), JF:234. | |
| Question B: "Both sheets put permissions here, so the title now reads" | corrected | JC:203, JC:212, JC:215, JC:228 file the rules under J7 (true), but JC:275 keeps J7 whole and reads the draft as already joining "who is allowed to do what" and "what each screen shows"; only JF:227 asked for new wording. | The flaws sheet proposed widening J7 from "who gets what" to "who gets what and who may do what", because the operator-only floor, the unpinned certificate and the secrets rotation had no job (JF:227, proposal 3; JF:220). The capabilities sheet files the identity rule, the floor and the secrets rule under J7 as its primary rules (JC:203, JC:212, JC:215, JC:228) and reads the draft J7 as already holding who may do what, so it asked for no new words (JC:275). The title now reads "...and let each do only what their role allows". Question: agree? |
| Question C: "...the owner's question 23 (CS:59) is unchanged by it. Question: agree, and does that settle question 23?" | corrected | The paragraph says question 23 is unchanged, then asks whether the clause settles it. JF:229 says only that question 23 "matters less"; CS:59 keeps it open. The capabilities sheet proposed no wording (JC:171). | The flaws sheet proposed "with or without an engine, as a choice the game declares" (JF:229, proposal 4), and the capabilities sheet lists the same need under J8 without proposing words: something must say a game is standalone, where today it is a tap, a URL path or nothing (JC:171; SP:19). The words are decision 22's own (CS:36-40). With this clause the standalone finding N1 has a home under J8; whether N1 is a seventeenth flaw stays the owner's question 23 (CS:59). Question: agree? |
| Question D | holds | JF:223; JC:120, JC:249. | |
| Question E | holds | JC:271 (proposal 1), JC:241, MD:54. | |
| Question F | holds | JC:272 (proposal 2); JF:231 (proposal 5); AN:47, AN:49; CS:55. | |
| Question G | holds | JF:225 (proposal 2); JC:38, JC:274. | |
| Kept note "J5 kept": "the flaws sheet rejects merging it into J2 because the boundary table is what finds bugs like a display row left red after a reset (JF:240)" | corrected | Misattributed. The display-row reason is the capabilities sheet's (JC:273, citing MD:161). JF:240 rejects the merge because J5 is the moment a fact changes fate and J2 is copies agreeing. | **J5 kept, and explained.** Both sheets keep J5 although no capability and only two flaws have it as their main home. The capabilities sheet asks that it be stated as a table of every fact against every moment with no deliverable of its own, because that table is what finds bugs like a display row left red after a reset (JC:273); the flaws sheet rejects merging it into J2 because J5 is the moment a fact changes fate and J2 is copies agreeing (JF:240). J5's entry says so. |
| Kept note "J2 and J9 kept apart" | holds | JC:274, JF:238. | |
| Kept note "J6 and J10 overlap on purpose" | holds | JC:276, JF:241. It rests on MD:256's inference; the J10 goal row above marks that open. | |
| Kept note "Base rows before grading" | holds | JC:277 (proposal 7). | |
| EJ:412 "Both tables are copied from the mapping sheets ... and checked against section 3 by the script" | corrected | True for the flaw table (every flaw's primary and secondary jobs match section 3, checked here by script). Not true for the capability table: five capabilities are named in section 3 under a job their row does not list (8 and 38 under J5; 16 under J1; 31 and 39 under J2), copied from JC, whose section 3 and table disagree in the same five places. | Primary job is the one the capability exists for, or the job the flaw's strongest show-night finding is filed under; secondary jobs are the others it touches. "Loose" means the capability fits the job only because no better job exists (JC:20, JC:239-242). Both tables are copied from the mapping sheets (JC:22-75; JF:27-45). The flaw table is checked against section 3 by the script that built this file. Five capability rows (8, 16, 31, 38, 39) add a secondary job that the capabilities sheet's section 3 lists but its table omits; the jobs added are J5, J1, J2, J5 and J2. |
| EJ:471 capability primary counts | holds | Recomputed from EJ section 5: J1 8, J2 2, J3 5, J4 4, J5 0, J6 10, J7 6, J8 10, J9 2, J10 5; total 52 (JC:83-93). Unchanged by the five secondary additions. | |
| EJ:473 heading "The 17 design flaws" and EJ:495 "total 17" | corrected | N1 is a proposal; whether it is a seventeenth flaw is the owner's open question 23 (CS:59; SP:251). | Heading: "5.2 The 16 design flaws and the proposed N1". EJ:495, first sentence: "Primary counts: J1 1, J2 4, J3 1, J4 2, J5 2, J6 0, J7 1, J8 1, J9 1, J10 4; total 17, counting the proposed N1 (JF:47)." |
| EJ:495 standalone findings by job | holds | JF:248 (J1 7, J2 4, J3 4, J5 2, J8 8, J9 8, J10 2; 35). | |
| EJ section 6, first bullet (every field, word limits) | holds | Script: every job has every field; `meaning` 52-60 words, `goal` 54-60 words. | |
| EJ section 6, second bullet (flaw placement checked) | holds | Script comparison of EJ:475-493 with JF:27-45 and with section 3: no difference. | |
| EJ section 6, third bullet ("its owner-facing fields carry no file names and no finding ids") | holds, with a note | True as worded: no file names, no finding ids. The fields do carry code words (section 3 below), which PR:236-238 asks to leave out. | |

## 3. Owner-facing fields in the page data (claim 5)

Scan of every string in EJS for file extensions, finding ids, code-style words and capability or flaw ids. Result: no file names, no finding ids, no capability id written as C-number; `flaws[].id` holds flaw ids C1 to C16 and N1 as the orchestrator directs. The code words below break PR:236-238 ("Leave out internal codes and jargon"). Each is corrected in the job tables above; this table lists them in one place.

| Field | Word | Verdict | Corrected in |
|---|---|---|---|
| `jobs[0].goal`, `jobs[0].needs[2]`, `jobs[0].tests[0]` | hash | corrected | J1 table: goal, needs, test 1 |
| `jobs[1].flaws[9].how` (C14) | facade | corrected | J2 table: C14 |
| `jobs[3].needs[0]` | kiosk | corrected | J4 table: needs |
| `jobs[3].needs[4]` | health registry | corrected | J4 table: needs |
| `jobs[5].tests[1]` | kiosk, sound-server listener | corrected | J6 table: test 2 |
| `jobs[6].tests[2]` | connect payload | corrected | J7 table: test 3 |
| `jobs[9].needs[0]` | audio-init off switch, harness children | corrected | J10 table: needs |
| `jobs[9].tests[0]` | signal monitors, sound-server listener, kiosk, process file | corrected | J10 table: test 1 |
| `jobs[9].tests[2]` | listener registry, test flag | corrected | J10 table: test 3 |
| `jobs[9].standalone` | CI job | corrected | J10 table: standalone line |
| `jobChanges[0]` to `jobChanges[6]` | none | holds | |
| `purpose[0]` to `purpose[7]` | none | holds | |

## 4. Coverage rows (EJ section 5)

Method: each EJ row was compared by script with the mapping sheet's row (name, primary job, secondary jobs; JC's parenthetical notes ignored), and each flaw's jobs with the flaw lists in EJ section 3. "Holds" means the row agrees with the sheet and with EJ section 3. Where a row is corrected, the corrected text is the whole row.

### 4.1 The 52 capabilities

| Row (EJ line) | Claim: placement | Verdict | Evidence | Corrected text in full |
|---|---|---|---|---|
| 1 (EJ:418) | The pack (capability 1): primary J1; secondary J3 | holds | JC:24 row matches; every EJ section 3 mention of it sits under a listed job. JC's note on the J3 link is "media named, never stored" (JC:24); the link is the sheet's, kept as copied. | |
| 2 (EJ:419) | The activation gate (capability 2): primary J1; secondary J6, J10 | holds | JC:25 row matches; every EJ section 3 mention of it sits under a listed job. | |
| 3 (EJ:420) | Pack channel and identity reporting (capability 3): primary J1; secondary J2, J9 | holds | JC:26 row matches; every EJ section 3 mention of it sits under a listed job. | |
| 4 (EJ:421) | Draft and publish pack store (capability 4): primary J6; secondary J1 | holds | JC:27 row matches; every EJ section 3 mention of it sits under a listed job. | |
| 5 (EJ:422) | Installation profiles (capability 5): primary J8 (loose); secondary J4, J9 | holds | JC:28 row matches; every EJ section 3 mention of it sits under a listed job. | |
| 6 (EJ:423) | One truth: collectPackNeeds and resolve() (capability 6): primary J9; secondary J6, J8 | holds | JC:29 row matches; every EJ section 3 mention of it sits under a listed job. | |
| 7 (EJ:424) | The preflight (capability 7): primary J9; secondary J4, J5, J8 | holds | JC:30 row matches; every EJ section 3 mention of it sits under a listed job. | |
| 8 (EJ:425) | Dormancy (capability 8): primary J4; secondary J9, J8 | corrected | Agrees with JC:31, but EJ section 3 names it under J5 and the row does not. JC:140 and EJ:194 place dormancy's recompute at reset, game create and restore under J5 (MD:160-163); JC's table row omits it. | \| 8 \| Dormancy \| J4 \| J5, J8, J9 \| |
| 9 (EJ:426) | The supervisor (capability 9): primary J4; secondary J9, J10 | holds | JC:32 row matches; every EJ section 3 mention of it sits under a listed job. | |
| 10 (EJ:427) | The host-config file (capability 10): primary J8; secondary J4 | holds | JC:33 row matches; every EJ section 3 mention of it sits under a listed job. | |
| 11 (EJ:428) | Self-heal (capability 11): primary J4; secondary J2, J5, J9 | holds | JC:34 row matches; every EJ section 3 mention of it sits under a listed job. | |
| 12 (EJ:429) | Credentials on every connection (capability 12): primary J7; secondary J2 | holds | JC:35 row matches; every EJ section 3 mention of it sits under a listed job. | |
| 13 (EJ:430) | Auth tiers, the floor, the observe token (capability 13): primary J7; secondary J5 | holds | JC:36 row matches; every EJ section 3 mention of it sits under a listed job. | |
| 14 (EJ:431) | Held items (capability 14): primary J4; secondary J3, J5, J9 | holds | JC:37 row matches; every EJ section 3 mention of it sits under a listed job. | |
| 15 (EJ:432) | Service domains and service:state (capability 15): primary J2; secondary J4, J9 | holds | JC:38 row matches; every EJ section 3 mention of it sits under a listed job. | |
| 16 (EJ:433) | Hot-apply (capability 16): primary J6; secondary J2, J5, J10 | corrected | Agrees with JC:39, but EJ section 3 names it under J1 and the row does not. JC:105 and EJ:59 place hot-apply under J1 (the list of every copy of the pack, MD:143-144); JC's table row omits it. | \| 16 \| Hot-apply \| J6 \| J1, J2, J5, J10 \| |
| 17 (EJ:434) | The five Design workspace pages (capability 17): primary J6; secondary J1, J8 | holds | JC:40 row matches; every EJ section 3 mention of it sits under a listed job. | |
| 18 (EJ:435) | The design-iteration loop (capability 18): primary J6; secondary J5 | holds | JC:41 row matches; every EJ section 3 mention of it sits under a listed job. | |
| 19 (EJ:436) | Live verdict badges in the editor (capability 19): primary J6; secondary J9, J8 | holds | JC:42 row matches; every EJ section 3 mention of it sits under a listed job. | |
| 20 (EJ:437) | Rehearsing on a preview engine (capability 20): primary J6; secondary J10, J8 | holds | JC:43 row matches; every EJ section 3 mention of it sits under a listed job. | |
| 21 (EJ:438) | Simulation and preview profiles (capability 21): primary J6; secondary J10, J8 | holds | JC:44 row matches; every EJ section 3 mention of it sits under a listed job. | |
| 22 (EJ:439) | The Deploy stage (capability 22): primary J8 (loose); secondary J6, J7 | holds | JC:45 row matches; every EJ section 3 mention of it sits under a listed job. | |
| 23 (EJ:440) | Bindings page and profile-manager page (capability 23): primary J8 (loose); secondary J4 | holds | JC:46 row matches; every EJ section 3 mention of it sits under a listed job. | |
| 24 (EJ:441) | Hardware/roles editor, tech rider, capability catalog, reference kit (capability 24): primary J8 (loose); secondary J1, J6 | holds | JC:47 row matches; every EJ section 3 mention of it sits under a listed job. | |
| 25 (EJ:442) | Planning view (capability 25): primary J8 (loose); secondary J6 | holds | JC:48 row matches; every EJ section 3 mention of it sits under a listed job. | |
| 26 (EJ:443) | The GM scanner's four domains (capability 26): primary J7; secondary J3, J4 | holds | JC:49 row matches; every EJ section 3 mention of it sits under a listed job. | |
| 27 (EJ:444) | The GM scanner redesign (capability 27): primary J7; secondary J1, J2, J5 | holds | JC:50 row matches; every EJ section 3 mention of it sits under a listed job. | |
| 28 (EJ:445) | The truth sweep (capability 28): primary J2; secondary J9, J10 | holds | JC:51 row matches; every EJ section 3 mention of it sits under a listed job. | |
| 29 (EJ:446) | Screen baselines and screen-capture tests (capability 29): primary J10; secondary J9 | holds | JC:52 row matches; every EJ section 3 mention of it sits under a listed job. | |
| 30 (EJ:447) | Capture: roster, notes, accusation (capability 30): primary J3; secondary J2, J5, J7 | holds | JC:53 row matches; every EJ section 3 mention of it sits under a listed job. | |
| 31 (EJ:448) | Photo capture and the photo store (capability 31): primary J3; secondary J7 | corrected | Agrees with JC:54, but EJ section 3 names it under J2 and the row does not. JC:112 and EJ:89 place photo capture under J2 (a decider and a reconnect home, MD:223, MD:226); JC's table row omits it. | \| 31 \| Photo capture and the photo store \| J3 \| J2, J7 \| |
| 32 (EJ:449) | The session-bundle emitter (capability 32): primary J3; secondary J5 | holds | JC:55 row matches; every EJ section 3 mention of it sits under a listed job. | |
| 33 (EJ:450) | Report pipeline migration to the bundle (capability 33): primary J3; secondary none | holds | JC:56 row matches; every EJ section 3 mention of it sits under a listed job. | |
| 34 (EJ:451) | The Review stage (capability 34): primary J3; secondary J6, J7 | holds | JC:57 row matches; every EJ section 3 mention of it sits under a listed job. | |
| 35 (EJ:452) | Players' phones (capability 35): primary J7; secondary J2, J8 | holds | JC:58 row matches; every EJ section 3 mention of it sits under a listed job. | |
| 36 (EJ:453) | Interaction primitives v1 (capability 36): primary J1; secondary J7, J8 | holds | JC:59 row matches; every EJ section 3 mention of it sits under a listed job. | |
| 37 (EJ:454) | Entity-field wire migration (capability 37): primary J1; secondary J2, J3 | holds | JC:60 row matches; every EJ section 3 mention of it sits under a listed job. | |
| 38 (EJ:455) | The second game's modules (capability 38): primary J1; secondary J2, J7 | corrected | Agrees with JC:61, but EJ section 3 names it under J5 and the row does not. JC:143 and EJ:197 place the second game under J5 (hidden state across a restart, MD:236); JC's table row omits it. | \| 38 \| The second game's modules \| J1 \| J2, J5, J7 \| |
| 39 (EJ:456) | Remote displays (capability 39): primary J7; secondary J4, J8 | corrected | Agrees with JC:62, but EJ section 3 names it under J2 and the row does not. JC:115 and EJ:92 place remote displays under J2 (which record each screen may see, MD:237); JC's table row omits it. | \| 39 \| Remote displays \| J7 \| J2, J4, J8 \| |
| 40 (EJ:457) | Media bundle and asset channel (capability 40): primary J1; secondary J4, J8 | holds | JC:63 row matches; every EJ section 3 mention of it sits under a listed job. | |
| 41 (EJ:458) | Content tooling and the source adapter (capability 41): primary J6; secondary J1 | holds | JC:64 row matches; every EJ section 3 mention of it sits under a listed job. | |
| 42 (EJ:459) | Seams for more kits and packs (capability 42): primary J8; secondary J1, J10 | holds | JC:65 row matches; every EJ section 3 mention of it sits under a listed job. | |
| 43 (EJ:460) | Kit network, DNS and certificate (capability 43): primary J8 (loose); secondary J7, J9 | holds | JC:66 row matches; every EJ section 3 mention of it sits under a listed job. | |
| 44 (EJ:461) | Blue/green cutover (capability 44): primary J10 (loose); secondary J5, J8 | holds | JC:67 row matches; every EJ section 3 mention of it sits under a listed job. | |
| 45 (EJ:462) | Block 1 deliverables (capability 45): primary J10 (loose); secondary J8, J9 | holds | JC:68 row matches; every EJ section 3 mention of it sits under a listed job. | |
| 46 (EJ:463) | Test environment (capability 46): primary J10; secondary J4, J5, J8 | holds | JC:69 row matches; every EJ section 3 mention of it sits under a listed job. | |
| 47 (EJ:464) | Open-sourcing and the release block (capability 47): primary J8 (loose); secondary J7, J10 | holds | JC:70 row matches; every EJ section 3 mention of it sits under a listed job. | |
| 48 (EJ:465) | First-run state (capability 48): primary J6; secondary J7 | holds | JC:71 row matches; every EJ section 3 mention of it sits under a listed job. | |
| 49 (EJ:466) | Hardware-scanner parity (capability 49): primary J8; secondary J7, J1 | holds | JC:72 row matches; every EJ section 3 mention of it sits under a listed job. | |
| 50 (EJ:467) | Ledger retirements L7, L8, L12 (capability 50): primary J1; secondary J8, J10 | holds | JC:73 row matches; every EJ section 3 mention of it sits under a listed job. | |
| 51 (EJ:468) | Block 6 close (capability 51): primary J10 (loose); secondary J6 | holds | JC:74 row matches; every EJ section 3 mention of it sits under a listed job. | |
| 52 (EJ:469) | Preset-load differential gate (capability 52): primary J6; secondary J10 | holds | JC:75 row matches; every EJ section 3 mention of it sits under a listed job. | |

### 4.2 The flaws

| Row (EJ line) | Claim: placement | Verdict | Evidence | Corrected text in full |
|---|---|---|---|---|
| C1 (EJ:477) | C1: primary J2; secondary J5 | holds | JF:29 row matches; EJ section 3 lists it as primary under J2 and under each secondary job (checked by script). | |
| C2 (EJ:478) | C2: primary J4; secondary J9, J2 | holds | JF:30 row matches; EJ section 3 lists it as primary under J4 and under each secondary job (checked by script). | |
| C3 (EJ:479) | C3: primary J4; secondary J9; name is "the card's title" | corrected (name only) | JF:31 row matches; EJ section 3 lists it as primary under J4 and under each secondary job (checked by script). The column says "the card's title", but CARDS gives "Engine trusts its stale picture of outside programs"; EJ's name is JF's plain rewording. Placement holds. | \| C3 \| Engine trusts its stale picture of outside programs \| J4 \| J9 \| |
| C4 (EJ:480) | C4: primary J5; secondary J2, J3, J8 | holds | JF:32 row matches; EJ section 3 lists it as primary under J5 and under each secondary job (checked by script). | |
| C5 (EJ:481) | C5: primary J5; secondary J4, J2 | holds | JF:33 row matches; EJ section 3 lists it as primary under J5 and under each secondary job (checked by script). | |
| C6 (EJ:482) | C6: primary J2; secondary J5; name is "the card's title" | corrected (name only) | JF:34 row matches; EJ section 3 lists it as primary under J2 and under each secondary job (checked by script). The column says "the card's title", but CARDS gives "Reconnect snapshot and live update are built apart"; EJ's name is JF's plain rewording. Placement holds. | \| C6 \| Reconnect snapshot and live update are built apart \| J2 \| J5 \| |
| C7 (EJ:483) | C7: primary J3; secondary J2, J5 | holds | JF:35 row matches; EJ section 3 lists it as primary under J3 and under each secondary job (checked by script). | |
| C8 (EJ:484) | C8: primary J10; secondary J6, J8 | holds | JF:36 row matches; EJ section 3 lists it as primary under J10 and under each secondary job (checked by script). | |
| C9 (EJ:485) | C9: primary J2; secondary J3, J8 | holds | JF:37 row matches; EJ section 3 lists it as primary under J2 and under each secondary job (checked by script). | |
| C10 (EJ:486) | C10: primary J9; secondary J4, J8 | holds | JF:38 row matches; EJ section 3 lists it as primary under J9 and under each secondary job (checked by script). | |
| C11 (EJ:487) | C11: primary J2; secondary J4, J3 | holds | JF:39 row matches; EJ section 3 lists it as primary under J2 and under each secondary job (checked by script). | |
| C12 (EJ:488) | C12: primary J1; secondary J6, J2 | holds | JF:40 row matches; EJ section 3 lists it as primary under J1 and under each secondary job (checked by script). | |
| C13 (EJ:489) | C13: primary J7; secondary J3 | holds | JF:41 row matches; EJ section 3 lists it as primary under J7 and under each secondary job (checked by script). | |
| C14 (EJ:490) | C14: primary J10; secondary J2, J1 | holds | JF:42 row matches; EJ section 3 lists it as primary under J10 and under each secondary job (checked by script). | |
| C15 (EJ:491) | C15: primary J10; secondary J8, J1 | holds | JF:43 row matches; EJ section 3 lists it as primary under J10 and under each secondary job (checked by script). | |
| C16 (EJ:492) | C16: primary J10; secondary none | holds | JF:44 row matches; EJ section 3 lists it as primary under J10 and under each secondary job (checked by script). | |
| N1 (EJ:493) | N1: primary J8; secondary J1, J9, J3; listed as one of "the 17 design flaws" | corrected (status only) | JF:45 row matches and placement holds. N1 is the standalone pass's proposal, not a ruled flaw (SP:243, SP:251; CS:59, question 23 open). | \| N1 \| Nobody declares that a game is standalone (proposed; the owner's question 23) \| J8 \| J1, J9, J3 \| |

## 5. Tally and completion check

- **Tally.** 224 verdict rows, not counting the section 3 index (whose twelve rows repeat corrections already made in section 1): **171 hold, 53 corrected**. By part: job entries 94 hold, 39 corrected (ten of the corrected rows are the "entry as a whole" verdicts, every job's entry being corrected in at least one field); the rest of the document 16 hold, 6 corrected; capability rows 47 hold, 5 corrected; flaw rows 14 hold, 3 corrected (two names, one status).
- **By claim.** (1) Placement: every capability 1 to 52 and every flaw C1 to C16 and N1 appears once in EJ section 5 and agrees with its sheet; five capability rows are corrected because EJ section 3 places them under a job their row omits. (2) Goals: nine hold; J10's states an inference as settled and is corrected; J1's is corrected for one word. (3) "Falls short": ten sentences corrected for scope or mechanism, two for plain words; the rest agree with AN (sections 1, 2, 6 and 7; there is no section 8) and SP. (4) Tests: 36 of the 39 come from AN's candidate proving tests; J1 test 4 and J8 tests 2 and 3 do not (and J8 test 2 need not fail today), and are replaced or labelled. Of the 36, J10 test 3 inverts the analysis's expected result and J6 test 3 drops the caveat that makes it runnable today; both are corrected. Four more are corrected for plain words only. The other 30 hold. (5) Ids and words: one citation uses capability row ids that clash with flaw ids (EJ:232); EJS has no file names and no finding ids but carries code words in ten fields.
- **Done condition.** Every job entry, J1 to J10, has a verdict for its goal, its needs, each flaw sentence, its standalone line, its questions and each test, and an overall verdict. Every coverage row, 52 capabilities and 17 flaw rows, has a verdict.
- **Not checked.** No test, build or server was run, so "fails today" rests on the analysis's own status cells and its section 4 "today" column, not on a run. The roadmap and plan lines quoted through the direction map were read only where this check names them (PD Appendix A, CS section 0, PR section 5, RM capture block).
- **Files written:** this document only.
