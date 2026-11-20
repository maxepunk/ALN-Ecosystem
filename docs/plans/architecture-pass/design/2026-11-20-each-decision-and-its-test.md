# Each decision and its test (second draft, 2026-11-20)

Status: draft for the owner. It is the first of the five documents the
design hands over. The list of the five is in the program document
(`docs/plans/2026-10-30-architecture-pass.md`, section 4.2) and in
`../DECISIONS.md` ("Five documents the design half hands over"). That
decision asks for each rule "with a proof test in plain words (what to
do, and what must happen)". Where the other four documents are is in
the revised roadmap, section 12 (`2026-11-20-the-roadmap-revised.md`).

This is the second draft. An independent reader found sixteen faults
in the first. What each one changed is in
`2026-11-20-the-check-of-the-two-drafts.md`.

## How to read it

A row. "Do" is what a person or a test does. "Must happen" is what
anyone can then see. "Passes when this is built" names the area of the
build that makes the test passable. The areas are defined in the
revised roadmap, section 3. Their short names:

| Short name | The area |
|---|---|
| bench | The test bench, and what the new engine is checked against |
| first version | The first version: a scan passes through every part of the new design |
| game session | A whole game session on the GM scanner, the scoreboard and the player scanner page |
| equipment | The room's equipment, each piece driven the same way and shown as it really is |
| cues and video | Cues, videos and held items |
| hardware scanner | The hardware scanner's firmware |
| web name and tags | The production's web name and certificate, and tags with the link first |
| preflight | The preflight |
| tools | The config tool's link to the engine, the tag tools, the checks after a session and the report |
| release | Releasing and installing the engine, and ALN's content in the new form |
| cutover | Moving ALN to the new engine |

Where a test is proven:

- No mark. On the test bench. A test that involves the room's
  equipment runs twice there. Once with software standing in for each
  program. And once on the test rig, where the real video player, music
  player, sound system and lights program run, with stand-ins for the
  TV, the speakers, the lamps and the Bluetooth speaker.
- "real devices". The test needs a real hardware scanner, phone, tag
  or TV, and the rig has none. It is proven on green at home, and again
  at the venue rehearsal.
- "later". The test belongs to work the roadmap places after the
  build. The row says which.

When the build is finished. Every test in sections 1 to 6 with no mark
passes on the test bench, on ALN's pack and on the toy pack. The tests
marked "real devices" pass on green at home with the new engine
installed. The owner ratified this on 2026-10-30 as "It ends, and the
pass with it, when every rule's test passes on the rig" (the program
document, section 5). Proving the real-device tests on green instead
of the rig is the agent's reading, and the owner can correct it.

## 1. How a session's data is kept

| No. | Decision | Do | Must happen | Passes when this is built |
|---|---|---|---|---|
| 1.1 | The session's record only grows. A correction is a new line. Decision note `0001`. | Sell a token. Then delete that sale as GM. | The record holds both lines, the sale and the deletion. The score is back where it was. No earlier line has changed. The token can be scanned again on every GM scanner, with no reload. | game session |
| 1.2 | | Reset the scores in the middle of a session while one GM scanner is disconnected. Reconnect it. | The record holds every line from before, and one more for the reset. Every screen shows zero, the reconnected GM scanner included. It accepts the tokens again. | game session |
| 1.3 | | Scan a token that another account has already claimed. | The scan is refused. The record holds the refused scan with the reason. | first version |
| 1.4 | A score change by hand is a line with the amount, the account, the GM scanner it came from and the reason if one was typed. | Change a score by hand and type a reason. | One line with those four things. Every screen shows the new score. | game session |
| 1.5 | The record holds the game, what the room did and what went wrong, one line for each event a person would recognise. Decision note `0002`. | Run a short session: a GM's scan, a player's scan, a sound that a rule asks for. Stop the stand-in sound player by force. | From the record alone a person can say that each of those happened, in order, with its time. | first version |
| 1.6 | | Run a short session with a video, a cue, music that a GM pauses and a scanner that loses its connection. Stop the music player by force. | The same, for each of those. The record holds no stream of positions or volumes. No score depends on any of these lines. | cues and video |
| 1.7 | The record names the pack the session ran and holds the texts the players saw. | Play a session. Publish a pack with other wording. Read the first session's record. | It names the pack it ran. It holds the texts its players were shown. | game session |
| 1.8 | Every screen is worked out from the record. The proposal's first change. | Connect a second GM scanner and a scoreboard in the middle of a session. | Both show what the first GM scanner shows, at once. After every further scan all three agree. | first version |
| 1.9 | | Disconnect a GM scanner. On another, scan, delete a sale, change a score by hand and reset the scores. Reconnect the first. | It shows exactly what the GM scanner that stayed connected shows, on every game screen. | game session |
| 1.10 | | At the end of each area, run a scripted session and capture every screen that area built, on the GM scanner and on the scoreboard. | Each capture says what the record and the equipment's reports say: scores, used tokens, the session's state, each piece of equipment. The current roadmap had a separate piece of work for this, which it called the truth sweep. | each area that builds a screen |
| 1.11 | After a session ends, nothing is accepted but notes, photos and the accusation, until the next session is created. Decision note `0003`. | End a session. Try a sale on a GM scanner. | Refused, and the GM scanner says why. | first version |
| 1.12 | | End a session. Restart the backend. Scan a token on a player scanner. | The session is still ended. The player sees the memory with the notice that the scan was not recorded. Nothing is added to the ended session. | game session |
| 1.13 | A scan stored during a session goes into that session, marked late, whenever it arrives. Decision note `0003`. | End a session. Then let a GM scanner hand over a scan it stored during it. | It lands in that session's record, marked late. The scores change to include it. The next session's record never holds it. | first version |
| 1.14 | | The same with a scan the player scanner page stored. | It lands in that session's record, marked late. | game session |
| 1.15 | Creating the next session wipes what the group's play produced. What is about the room stays. Decision note `0003`. | Finish a session with scores, accounts, a used token and a logged-in GM. Create the next session. | Scores, accounts and used tokens are gone from every screen and scanner. The GM is still logged in. The last session's record is whole. | first version |
| 1.16 | | The same with a changed volume, a chosen audio route and a connected Bluetooth speaker. | All three are as they were. | equipment |
| 1.17 | | Fire a once-only cue. Hold a video because the TV is down. Leave a cue running. End the session and create the next. | The once-only cue can fire again. No held item is left. No cue shows as running. | cues and video |
| 1.18 | The pack changes only when a new pack is applied, never in the middle of a session. Decision note `0003`. | Publish a changed pack while a session runs. Go on scanning. | The running session keeps its scoring, its texts and what each device is sent. Its record still names the pack it started with. | game session |
| 1.19 | A backend runs one session at a time. Each line names the device, not a person. | Read the records of two sessions played one after the other. | Every line names a device. None names a person unless the game's rules put a name there. At no time were two sessions open. | first version |
| 1.20 | Moving value between two accounts is one action and one line. | As GM, move an amount from one account to another. | One line in the record. Both scores change together. It is undone as one. | later: with the GM scanner's redesign, where the owner placed it on 2026-11-13. Until then GMs make two score changes by hand. |
| 1.21 | The roster, notes, photos and the accusation are lines of the record. Decision note `0002`. | | These tests are written when recording a session as it is played is designed. | later: recording a session as it is played |

## 2. The messages and the files

| No. | Decision | Do | Must happen | Passes when this is built |
|---|---|---|---|---|
| 2.1 | A player sees the same after a scan on the player scanner page and on the hardware scanner. | Scan one ordinary token on the player scanner page with a session running. | The memory shows at once, without waiting for the backend's reply. The record holds the scan. | game session |
| 2.2 | | The same with no session, and again after the session has ended. | The memory shows, with the notice that the scan was not recorded. | game session |
| 2.3 | | Scan a video token while no video is playing. | The token's picture shows, with the line that the video is starting on the TV. The video plays. | cues and video |
| 2.4 | | Scan a video token while another video is playing. | The picture shows, with "Video unavailable, rescan later". The scan is recorded. No second video starts. | cues and video |
| 2.5 | | Turn the connection off. Scan an ordinary token and a video token. Turn it on. | The ordinary token shows the memory and nothing else. The video token shows "Video unavailable, rescan later". Both scans are stored and handed over. Neither starts a video when it arrives. | cues and video |
| 2.6 | | Do tests 2.1 to 2.5 on a hardware scanner. | The same on its screen, each time. | hardware scanner; real devices |
| 2.7 | | Change the wording of a notice in the pack. | Both player scanners show the new wording. The hardware scanner needed no cable. | hardware scanner; real devices |
| 2.8 | A device says which pack it holds and which version of the messages it speaks. One that is out of date is brought up to date, or named. | Publish a changed pack between sessions. Connect a GM scanner that holds the old one. | It fetches the new pack by itself before its first scan, and says so once. The GM can see which pack it runs. | game session |
| 2.9 | | The same with the player scanner page and the scoreboard. | Each fetches the right pack by itself. | game session |
| 2.10 | | Make a pack fetch that never finishes. Make two fetches at once. | The first is given up after a set time, and the device keeps the whole pack it had. The second leaves one whole pack. These are the two tests the roadmap's row 8.5 names. | game session |
| 2.11 | | Give the backend a newer version of the pages while a GM scanner, a player scanner page and a scoreboard still have the old pages open. | Each page reloads itself from the backend once, and then works. | game session |
| 2.12 | | Connect a hardware scanner whose firmware is too old for the backend's messages, when it cannot fetch an update. | Its screen says "UPDATE NEEDED". The GM scanner shows it red with what to do. The preflight lists it. | hardware scanner and preflight; real devices |
| 2.13 | | Connect a hardware scanner whose firmware is older but speaks messages the backend still accepts. | Its scans are recorded. It is listed as out of date. | hardware scanner, with the firmware's message code built for a computer |
| 2.14 | The pack says what each kind of device is sent. | With ALN's pack, capture everything a player scanner receives. | It holds each token's picture, sound and video name. It holds no token's value, type, group, owner or summary. | game session |
| 2.15 | | With a toy pack that lets a player's device see more. | It receives what that pack says. | game session |
| 2.16 | | Capture everything the scoreboard receives during a session. | Scores and exposed evidence. No list of transactions and no table of tokens. | game session |
| 2.17 | A GM sees the result of a scan when the backend replies. | Scan a token on one GM scanner that another GM has just sold. | The first and only result shown is that the token is already claimed, with the name of the other account. No success shows first. | first version |
| 2.18 | A token's id is lowercase letters, digits and underscores, matched the same way everywhere. | Give the backend, the GM scanner, the player scanner page and the firmware's reading code the same list of ids written several ways. | Each accepts and refuses the same ones. The tag tools pass the same test when they are rebuilt. | first version |
| 2.19 | Every device shows a credential. With none it can read nothing and send nothing. Decision note `0004`. | From a device with no credential, send a scan, ask for the session and ask for the pack. | All three refused. | first version |
| 2.20 | | Open the player scanner page on a phone for the first time. | It works with nothing to type. Its credential ends with the session and names no person. | first version |
| 2.21 | | Add a scanner to the kit. Restart the backend. Remove the scanner. | Added, it works, and it still works after the restart. Removed, it is refused. How a device is added is the owner's decision, made in this area's detailed design. | first version |
| 2.22 | Starting and ending a session, running the show and changing a score always stay with staff. Decision note `0004`. | With a phone's credential and with a kit scanner's credential, try to end the session and to change a score. | Refused. | first version |
| 2.23 | | With the same two credentials, try to fire a cue, play a video and change a volume. | Refused. | cues and video |
| 2.24 | The backend knows which devices are connected, with or without a session. The proposal's fourth change. | With no session, connect two GM scanners, a scoreboard and a player scanner page. | A GM scanner lists all four. | game session |
| 2.25 | A tag holds the web link first and the token's id second. Decision note `0005`. | Hold an iPhone and an Android phone to a new tag with nothing open. | On both, the token's memory opens in the browser. | web name and tags; real devices |
| 2.26 | | Hold a new tag and one of today's tags to a hardware scanner. | The same id from both, each in one read. On the bench, the reading code is given the bytes of both. | hardware scanner; real devices |
| 2.27 | | Hold a token to a GM's device while the GM scanner is on screen. | The GM scanner takes it. No browser page opens. | web name and tags; real devices |
| 2.28 | | Open a tag's link on a device that holds a staff credential. | The memory shows. No player scan is recorded. | game session |
| 2.29 | | Open the links of two tokens one after the other. Then open a link on a device with no credential. | Each shows its own token. The device with no credential gets a phone's credential and shows the token. | game session |
| 2.30 | | Read a tag written by the tag tool. | The link comes first and the id second. The link names the production, never one kit. It has no port number. It is short enough for the hardware scanner to read the tag in one read. | tools |
| 2.31 | | Give one token a code that cannot be guessed. Open its link with a wrong code. | Refused. ALN does not use this. The link's form leaves room for it from the first tag written. | later: players' own phones |
| 2.32 | The hardware scanner takes its firmware over the air when it starts, never in a session. Decision note `0006`. | Put a newer firmware on the backend. Restart a scanner with no session running. | It updates and reports the new version. | hardware scanner; real devices |
| 2.33 | | The same with a session running. | It does not update. | hardware scanner; real devices |
| 2.34 | | Cut its power in the middle of an update. Then give it a firmware that starts and fails its own checks. | Both times it starts on the old firmware. | hardware scanner; real devices |
| 2.35 | | Start a scanner on the kit's network, which has no internet. Then point it at a computer that shows another certificate. | Its scans carry the right time, taken from the backend. It refuses the other computer and says so. | hardware scanner; real devices |
| 2.36 | The messages and the files are defined in one place, and every program is checked against the definition. The proposal's third change. | Change one message in the definition and change no program. | The checks fail. They name each program that no longer agrees: the backend, the GM scanner, the player scanner page, the scoreboard, the firmware's code. The config tool joins this check when its link to the engine is rebuilt. | first version |
| 2.37 | | Give the backend a pack and a session's file that break the definition. | Each is refused, with the field named. | first version |

## 3. Which device decides what

| No. | Decision | Do | Must happen | Passes when this is built |
|---|---|---|---|---|
| 3.1 | A GM scanner with no connection shows the result at once, marked "not confirmed". Decision note `0007`. | Turn a GM scanner's Wi-Fi off. Scan a token. Turn it on. | The result shows at once, marked "not confirmed". After the connection returns it is confirmed with the same numbers. | first version |
| 3.2 | Of two scans of one token, the first to reach the backend counts. The other GM is told. | Two GM scanners, one with no connection, scan the same token. Reconnect. | The scan that reached the backend first counts. The other GM scanner shows which scan was refused and why. | first version |
| 3.3 | A result the backend has confirmed is never taken back. | After a confirmed sale, let another GM scanner hand over an earlier scan of the same token. | The confirmed sale stands. | first version |
| 3.4 | If the backend's computer dies, the session goes on at the GM scanners. | Stop the backend in the middle of a session. Keep scanning on two GM scanners. Start it again. | Every scan made meanwhile is in the record with the time it was made. The scores are right. | first version |
| 3.5 | | The same. Look at each GM scanner while the backend is down. | Each says that the backend cannot be reached, and shows which of its controls still work. | game session |
| 3.6 | No spare computer is required. One can take over. | Start a second computer with the pack and the installation's settings. Let the GM scanners hand over to it. | The session goes on there. | game session |
| 3.7 | A game that needs the backend says so in its pack. | With such a pack, stop the backend. | Every GM scanner says the session cannot go on. | game session |
| 3.8 | With no connection a GM scanner cannot pause or end the session or run the room. | Turn a GM scanner's Wi-Fi off in a networked game. | The controls for the session show grey, with the reason. | game session |
| 3.9 | | The same. Look at the controls for the room. | They show grey, with the reason. | equipment |
| 3.10 | A game with no backend plays by the same rules. Decision note `0008`. | Play one scripted session with a backend and again without, with the toy pack and with three of ALN's tokens. | The same scores, and the same lines for the GMs' scans. | first version |
| 3.11 | | The same with every one of ALN's rules, the group bonus included. | The same scores. | game session |
| 3.12 | The installation's settings say whether there is a backend. | Open a GM scanner in an installation with none. | It starts with no choice of mode. | first version |
| 3.13 | The pack says whether its game can be played without a backend. | In an installation with no backend, load a pack that needs one. | It refuses to start and names the need. | game session |
| 3.14 | The GM scanner keeps the record and can save it. | In an installation with no backend, play a session and save the record at the end. | The saved file is whole, and it passes the same check of its form as a backend's. | first version |
| 3.15 | Several GM scanners' parts are put together afterwards. | Save the records of two GM scanners that played one session with no backend. Put them together. | One session with the right totals. | game session |
| 3.16 | With no backend, the GM scanner runs the clock and shows the scoreboard. A player scanner shows memories and sends nothing. | Play a session with no backend. Scan a video token on the player scanner page. | The clock runs on the GM scanner. Its scoreboard shows scores and exposed evidence. The player scanner page shows the picture and a line saying the video cannot be played here. It sends nothing. | game session |
| 3.17 | | Set a hardware scanner for an installation with no backend. Scan a token. | The memory shows. The scanner shows no connection fault and stores nothing to send. | hardware scanner; real devices |

## 4. How the engine is extended

| No. | Decision | Do | Must happen | Passes when this is built |
|---|---|---|---|---|
| 4.1 | A designer designs the game's rules in the pack. Decision note `0011`. | Play a session with a toy pack scored its own way, and with three of ALN's tokens whose two verbs are written as pack rules. | The toy pack gives its own numbers. ALN's tokens give ALN's numbers. The engine's code holds neither game's formulas. | first version |
| 4.2 | | Play real ALN sessions from blue again through ALN's pack, with all its rules written as pack rules. | The same final scores as blue gave. This needs session files from blue. | game session |
| 4.3 | | Run a toy pack with a deposit that is doubled in the last ten minutes, a steal from another account, and a bonus for one of every colour. | It plays, with no change to the engine's code. | game session |
| 4.4 | | Change one number in a formula. Publish. Start a session. | The new scoring applies in the backend and in a GM scanner with no backend alike. | first version |
| 4.5 | | Publish a pack whose rule needs a capability the engine does not have. | Refused at publish and at start, with the capability named. | first version |
| 4.6 | | Publish a pack with a formula that uses an operation that does not exist, or reads a value no token carries. | Refused at publish, with the place named. A pack holds rules and formulas, never program code. | first version |
| 4.7 | | Publish a pack with a verb that gives points to one account and takes them from another, uses the token up and changes what is shown. | Accepted. Scanning with that verb does all of it. | first version |
| 4.8 | | Publish a pack that lets a player's device start or end a session, run the show by hand or change a score by hand. | Refused. Those three actions stay with staff. Nothing else about a game's rules is refused on this ground. | first version |
| 4.9 | | Do a scan that completes a set. | The record shows the verb, the points and the bonus, each with the name of the rule that caused it, and with the values the formula read. | first version |
| 4.10 | | With a pack whose rule says a GM's scan of one token plays a video, scan that token as GM. Then do it in an installation with no backend. | The video plays. With no backend the request to the room is skipped and the scan still counts. This answers the roadmap's row 8.16. | cues and video |
| 4.11 | | With ALN's pack, scan a video token on a player scanner, then as GM. | The player's scan plays the video. The GM's scan does not. Both follow from ALN's pack, not from the engine's code. | cues and video |
| 4.12 | | Fire every cue of ALN's pack and of the toy pack. Then publish a pack whose cue would change a score. | No score, token or account changes. The pack is refused at publish. A cue never changes the game. | cues and video |
| 4.13 | | In the config tool, with no developer, write a verb and a formula and play it. | It plays. Until this is built, a pack's rules are written in the pack's files and pass the same checks. | later: the config tool's pages for previewing a game |
| 4.14 | | Change a rule, a text and a picture in the pack. | The hardware scanner shows them after its next start, with no cable. Nothing a designer changes needs a hardware scanner re-flashed. | hardware scanner; real devices |
| 4.15 | A new capability is part of the engine. It is one file in a known place. Decision note `0009`. | As a drill, add one new operation for formulas. | One new file. No other file of the engine's code is edited. The toy pack uses it. Every program reports the new version. | first version |
| 4.16 | | As a drill, add a stand-in kind of equipment. | One new file. It shows on the GM scanner's health panel with no change to the GM scanner's code. It shows in the preflight when the preflight is built. | equipment |
| 4.17 | After a restart the background comes back by itself. What was cut off is listed for the GM. Decision note `0010`. | Restart the backend in the middle of a session. | The session, the scores and the GMs' logins are back. Nobody logs in again. | first version |
| 4.18 | | The same with the game clock running. | The clock is back, at the right time. | game session |
| 4.19 | | The same with music playing, the scoreboard on the TV, the lights in a scene and a changed volume. | The music goes on from where it stopped. The TV shows the scoreboard. The lights and the volume are as they were. | equipment |
| 4.20 | | The same with a video half-way, a cue half-way, and a clock cue falling due while the backend is down. | The video and both cues are on the GM's list, each with run and drop. Nothing replays by itself. The clock cue is marked as fired. | cues and video |
| 4.21 | | Stop only the music player by force. Then stop only the video player, in the middle of a video. | Each is started again. The music goes on. The video is on the GM's list. | cues and video |
| 4.22 | A copy started for a test or a rehearsal leaves the installed backend as it was. The proposal's seventh change. | With the installed backend running and no session, start a second copy on the same computer, use it, stop it. | The installed backend's programs, files and screen are exactly as before. The copy used stand-ins, and never the real TV, speakers or lights. | equipment |
| 4.23 | | Run the engine's whole test set on a computer where an installed backend is running. | The installed backend's programs, files and screen are exactly as before. | equipment |
| 4.24 | | Start a second copy that asks for the real TV, speakers and lights while the installed backend holds them. | Refused, with the reason. Only one copy at a time holds the real equipment. | equipment |
| 4.25 | The backend is assembled in one place. A restart follows the same steps as a normal start. The proposal's seventh change. | Play music. Start over from the GM scanner the way a GM does between groups. Start a playlist. Fire a cue that waits for a music event. | The music panel shows the new track. The cue fires once. | cues and video |

## 5. Rulings from before the pass that the build must still meet

The owner made these on 2026-09-12 and earlier. The current roadmap
grouped most of them as the hardening block. They are built inside the
build's areas. The source of each is named so the wording can be
checked.

| No. | Ruling | Do | Must happen | Passes when this is built |
|---|---|---|---|---|
| 5.1 | A crashed program is restarted a set number of times within a set time. Then the backend stops trying and says so. The hardening plan, pin P10. | Stop the video player by force again and again. | After the set number the backend stops trying. The GM scanner shows it red, with why and a Restart button. Pressing it starts the player. | equipment |
| 5.2 | Restarting ships switched on. The host file can set the number to zero, which means restarts by hand only. Rulings R6, R13 and R18. | Set the number to zero. Stop the video player by force. | It is not restarted. The GM scanner shows it red with the Restart button. | equipment |
| 5.3 | A host can mark a program as run by something else on that computer. Ruling R18. | Mark the video player that way. Stop it by force. Start it by hand. | The backend does not start it. When it is back, the backend uses it again and says so. | equipment |
| 5.4 | One part of the backend starts and restarts every program, the TV's browser included. Ruling R20. | Stop the TV's browser by force while the scoreboard shows. Then again while a video shows. | The first time it is started again and shows the scoreboard. The second time it is started when the scoreboard is next wanted. | equipment |
| 5.5 | A GM can put a piece of equipment out of service, and back in. Pin P12. | Put the lights out of service and type a reason. Put them back. | Out of service, the row shows grey with the reason, restarts stop, and anything held for the lights is dropped. Back in service, the lights program is started and checked. | equipment |
| 5.6 | Equipment that is not installed shows grey, never red. Pins P1 to P5. | Run the toy pack with lighting not installed. Reconnect a GM scanner. | Lighting shows grey with its reason, after the reconnect too. | equipment |
| 5.7 | | Fire a cue that needs only lighting. Fire a cue that needs lighting and sound. | The first is refused with that reason. The second plays the sound, and its result says the lighting command did not run. | cues and video |
| 5.8 | The installation's settings file is checked when the backend starts. Pins P17 to P19, ruling R12. | Start the backend with the path to the settings file mistyped. | The check row says no-go, with the reason. The health panel does not read as all calm. | equipment |
| 5.9 | A session cannot start when the pack requires equipment the installation does not have, when fewer devices of a kind are connected than the pack's minimum, or when the settings file fails its check. A GM can override with a typed reason. Pins P7 and P19. | Try to start a session in each of the three cases. Then type a reason. | Refused each time, with what is missing named. With the typed reason it starts. The record holds the override, the reason and the device it came from. | equipment |
| 5.10 | A program that is installed and has crashed never blocks a start. Pin P1. | Start a session with the video player stopped. | It starts. The video player shows red with its buttons. | equipment |
| 5.11 | The preflight says what it checked and how deeply, and says what it cannot check. The roadmap's honesty rule of 2026-09-05; pin P8. | Run it with one video file missing. | It names the file. Every row says whether it was checked from files alone or against the running equipment. It states what only a person can check. | preflight |
| 5.12 | The preflight runs from the command line and shows on the GM scanner. | Run it both ways at the same moment. | The same rows. From the command line with no backend running, it gives the rows that files alone can answer. | preflight |
| 5.13 | The preflight counts the scanners and scoreboards that are connected against what the installation's settings say, and says whether the TV's scoreboard page is really showing. Ruling R21; the roadmap's table of what serves each trouble. | Run it with one hardware scanner switched off and the second scoreboard's browser closed. | It names both as missing. | preflight; real devices |
| 5.14 | The backend's computer powers on into a running system. The roadmap's fifth trouble. | Switch green off and on. | The backend, the video and music players and the TV come up by themselves. A GM scanner connects. The preflight runs with no terminal opened. | cutover; real devices |
| 5.15 | The phone page and the hardware scanner can do the same things. The roadmap, section 2.5. | Run every row of section 2 that names a player scanner on both. | The same result on both. | hardware scanner; real devices |
| 5.16 | Anything held for a piece of equipment is dropped when the session ends. Pin P13. | Hold a video because the TV is down. End the session. | No held item is left. | cues and video |

## 6. Faults recorded in today's engine, as tests

The program document asks that the faults found on blue and in the
evidence be used as tests, not derived again. The cause analysis
(`../2026-10-30-cause-analysis.md`, section 4) lists each as something
to do and what happens today. The rows here are the four the program
document names, the five the retired truth sweep was to re-test, and
the ones that would be worst at a session. Four of the named ones are
rows above: 1.1, 1.2, 1.12 and 2.17.

Every other reproduction in the cause analysis's section 4 goes on the
list of pending cases of the area that builds its part. That area's
detailed design turns each into a test or sets it aside with a reason.
A fault fixed on blue during the build is added to the same list.

| No. | The fault today | Do | Must happen | Passes when this is built |
|---|---|---|---|---|
| 6.1 | The music panel falls behind the music. | Play music from the GM scanner. Stop the music player by force with the panel open. Let it restart. | The panel shows at once that the music player has stopped. The progress bar stops. After the restart the panel follows the music again, with no reload. | equipment |
| 6.2 | A change made at the player itself reaches no GM scanner. | Change the track and the volume at the music player, outside the engine. | Every GM scanner follows. | equipment |
| 6.3 | A volume slider shows the GM scanner's own remembered value. | Change a volume on one GM scanner. Disconnect and reconnect the Bluetooth speaker. | Every GM scanner's slider shows the backend's value. | equipment |
| 6.4 | Setting a volume with nothing playing gives a bare error. | Set the music volume while the music is stopped. Move the video slider with no video playing. | The volume is set and shows, or the refusal says why. | equipment |
| 6.5 | A GM scanner that reconnects misses part of the room's state. | Disconnect a GM scanner. Play a sound, change a route and hold a video. Reconnect. | It shows what a GM scanner that stayed connected shows, on every panel. | cues and video |
| 6.6 | "Check now" on a piece of equipment that is down gives no sign. | With a piece of equipment down, press "check now". | The row shows the time of the check and its result. | equipment |
| 6.7 | A GM scanner with a dead connection goes on showing its last numbers as if live. | Cut a GM scanner's connection for a minute. | It says the backend cannot be reached. Its panels are marked as last known, with the time. | equipment |
| 6.8 | The scoreboard goes on counting down after it loses the backend. | Stop the backend while the scoreboard shows. | The scoreboard shows that it has lost the backend. | game session |
| 6.9 | The backend says a video has started long after the picture. | Play a video on the rig and time the backend's "started" against the picture. | Within half a second, every time. The figure is the cause analysis's. | cues and video |
| 6.10 | A cue with a two-second video never completes. | Fire such a cue. | It completes. | cues and video |
| 6.11 | A paused video is played over. | Pause a video. Scan a video token on a player scanner. Release a held video. | The player is told the video is unavailable. The released video waits and does not play over the paused one. | cues and video |
| 6.12 | Music stays lowered after the video queue is cleared. | Start a video so that the music is lowered. Clear the queue. | The music returns to its volume. | cues and video |
| 6.13 | A cue with half its commands skipped reports a clean finish. | Fire a cue while one piece of equipment it needs is down. | The cue's result says which commands did not run. | cues and video |
| 6.14 | Stored scans sent twice are stored twice. | Hand over the same stored scans twice, with a backend restart in between. | Each scan is in the record once. | first version |
| 6.15 | A scan the backend can never accept is sent again and again. | Send a scan with a verb the pack does not have. | Refused once, with its reason shown to the GM. It is not sent again. | first version |
| 6.16 | A device is told its stored scans were processed when nothing was stored. | Hand over stored scans that belong to no session the backend holds. | The device is told they were not recorded. | game session |
| 6.17 | Reloading a GM scanner wipes the scans it had not sent. | Scan on a GM scanner with no connection. Reload its page. Reconnect. | The scan is still there and is handed over. | first version |
| 6.18 | A GM scanner that reloads after losing Wi-Fi is refused for over a minute. Two devices can take the same name. | Drop a GM scanner's connection without closing it. Reload it. | It is connected again within seconds, as the same device. No two devices ever hold one name. | first version |
| 6.19 | A sale and a score change are stamped by two clocks. | Set a GM scanner's clock ten minutes wrong. Sell a token and change a score by hand. | The record's lines are in the order they happened. The report's times agree with each other. The game clock on that GM scanner agrees with the backend's. | game session |
| 6.20 | A file edited on the disk is served while the engine scores by the old one. | Edit a pack file on the disk without publishing. | The backend, every device and the scoreboard go on with the published pack. What the backend serves matches its own list of the pack's files. | game session |
| 6.21 | Starting over brings an earlier session's transactions back. | Scan three tokens. Start over the way a GM does between groups. Scan two. Reset the scores. | No transaction or evidence from before comes back on any screen. | game session |
| 6.22 | A watcher of the sound system stops for good and nothing says so. | Stop the watcher of the sound system by force five times. | It is running again. The audio panel still follows a change made at the sound system. | equipment |
| 6.23 | Going back a release leaves parts of the newer one in place. | Install a release. Install the next. Go back to the first. | The backend, every page it serves and the firmware it offers are the first release's. The GM scanner shows that release's number. | release |
| 6.24 | A computer built from the documents pairs a speaker that plays nothing. | Build a clean computer from the guide and pair a speaker. | The speaker plays sound. | cutover; real devices |
| 6.25 | A test run passes while it skips what it could not do. | Run the whole test set with the video player missing from the rig. | The run fails and names what is missing. No test is skipped unless it is listed with its reason. | bench |
| 6.26 | A stand-in behaves differently from the program it stands for. | On the rig, give each stand-in and its real program the same commands. | The same reports from both. | equipment |

## 7. Each cause found in today's engine, and what removes it

The design ends only when "every finding and every fix made on the
show machine in use now is assigned to a rule, or set aside with a
reason" (`../DECISIONS.md`, "When the design half is finished"). The
cause analysis assigns each of its 358 findings to one of sixteen
causes, or sets it aside, in its sections 3 and 5. This table assigns
each cause.

| Cause, in the cause analysis's order | What removes it | Tests |
|---|---|---|
| 1. Each GM scanner keeps its own copy of each game fact and updates it by its own rule. | The record only grows and every screen is worked out from it. Decision note `0001`. | 1.1, 1.2, 1.8, 1.9, 2.17 |
| 2. A program's health and its state reach the GM scanner as two separate things. | Each piece of equipment gives one report: what it is doing, whether it is working, and when that was last checked. The proposal's fourth change. | 6.1, 6.2, 6.3 |
| 3. The backend's picture of each outside program is a stored copy that it never checks against the program. | The same one pattern: the report is read from the program, and what the backend asked for is checked against what the program says. | 6.4, 6.9, 6.10, 6.22, 6.26 |
| 4. No fact says what happens to it when a session starts or ends, at a restart or at a reload. | Three lifetimes: a session, an installation, the production. Decision note `0003`. What comes back after a restart: `0010`. | 1.11 to 1.18, 4.17 to 4.21, 6.17 |
| 5. Starting the backend and resetting it are two hand-kept sequences. | The backend is assembled in one place, and a restart follows the same steps as a start. The proposal's seventh change. | 4.25, 6.21 |
| 6. What a device gets when it connects and what it gets live are built by different code. | One piece of code updates every screen from the record, connected or reconnecting. The proposal's first change. | 1.8, 1.9, 6.5 |
| 7. A reply does not say which request it answers, whether it is final, or whether the scan was stored. | Every scan and command gets one kind of reply: accepted, refused with the reason, held for later, or failed and worth sending again. The proposal's first change. | 6.14, 6.15, 6.16 |
| 8. The backend assumes it owns the computer, and the tests assume they may use it. | A copy started for a test or a rehearsal leaves the installed backend as it was. The proposal's seventh change; the owner's decision of 2026-11-12. | 4.22, 4.23, 4.24 |
| 9. The GM scanner and the player scanners decide things the backend is the authority for, from their own copy of the rules. | The GM scanner runs the same rules code as the backend, and marks what the backend has not confirmed. Decision notes `0007`, `0008`. | 2.17, 3.1 to 3.4, 3.10, 3.11 |
| 10. Nothing on a screen says whether a value is known, unknown or old. | The one report carries when it was last checked. A result is marked "not confirmed". The settings file's check says no-go. The preflight labels how deeply each row was checked. | 3.1, 5.8, 5.11, 6.6, 6.7, 6.8, 6.13 |
| 11. One question has several answers inside one program, such as "is a video playing". | Game facts are read from the record and the room's from each piece's one report. Cues, the video queue and held items are fitted to them. | 6.11, 6.12, 5.16 |
| 12. The pack is read at scattered moments, and nothing says the pack changed. | The pack belongs to the production and changes only when applied, never in a session. Every device says which pack it holds and fetches the right one. Decision note `0003`; "A device that is out of date". | 1.7, 1.18, 2.8 to 2.10, 6.20 |
| 13. The backend does not know who is connected, and every device is sent everything. | Every device shows a credential, and the pack says what each kind of device is sent. Decision note `0004`. | 2.14 to 2.16, 2.19 to 2.24, 6.18 |
| 14. Names and shapes that join two programs are kept by hand on each side. | The messages and the files are defined in one place and every program is checked against the definition. The proposal's third change. | 2.36, 2.37, 2.18 |
| 15. The installed game is several separately versioned checkouts, hand-copied files and hand-run steps. | No decision of the owner's covers it. The agent's engineering call: a release is one numbered package that is installed and can be gone back from. The revised roadmap, section 7. | 6.23, 6.24, 5.14 |
| 16. A passing test run does not show that the real path works. | Tests drive the engine from outside, on a test bench outside the engine, and screens are captured and checked. The owner's decision of 2026-11-01, "One published protocol and an outside test bench". | 1.10, 6.25, 6.26 |

The twenty-one findings the cause analysis set aside stay set aside,
for the reasons it gives. One of them was a question for the owner,
whether a refused GM scan is recorded anywhere. It is answered: the
record holds refused scans (test 1.3).

## 8. How each decision serves the work after the build

The design also ends only when "every rule says how it serves the
planned capabilities and standalone games". The planned capabilities
are: applying a changed pack without restarting the backend, a
rehearsal on a copy of the backend, recording a session as it is
played, and players' own phones.

| Decision | What it gives the work after the build |
|---|---|
| The session's record only grows. `0001` | Recording a session adds its notes and photos as lines. Scans from players' phones are added in order. A game with no backend keeps the same kind of record on the GM scanner. |
| One record for the game, the room and what went wrong. `0002` | The roster, notes, photos and the accusation already have their place. The report and the checks after a session read one file. |
| What belongs to a session, an installation and the production. `0003` | A changed pack is taken up between sessions and never inside one, which is what applying it without a restart needs. A rehearsal has its own session and its own settings. |
| Every device shows a credential. `0004` | A player's phone gets one with nothing to type. The pack can then say what a phone may do. |
| A tag holds the link first. `0005` | Both kinds of phone open a token by themselves. |
| The hardware scanner takes firmware over the air. `0006` | A change to the messages for phones or for the second game reaches every hardware scanner with no cable. |
| A GM scanner carries on without the backend. `0007` | The same rules code runs in the backend, in a GM scanner and in a rehearsal's copy. |
| A game with no backend. `0008` | Standalone games are a kind of installation, not a mode a GM picks. A pack says whether it can be played that way. |
| A new capability is part of the engine. `0009` | What the second game needs is added once, in a known place, and every designer can use it. |
| What comes back after a restart. `0010` | A rehearsal's copy and the installed backend start by the same steps. Applying a changed pack can use those steps too. |
| A designer designs the rules in the pack. `0011` | The config tool's editor edits rules and formulas as pack data, and a designer plays the change. Actions that take two tokens are verbs like any other. |
| The pack says what each kind of device is sent. | A game can show different players different things. A phone is sent only what it may show. |
| A device that is out of date fetches the right pack by itself. | Applying a changed pack reaches every device with nothing done by hand. |
| The messages and files are defined in one place. | The config tool, a phone page and another production's tools are checked against the same definition. |
| A copy of the backend leaves the installed one alone. | A rehearsal can run on the backend's own computer between sessions. |

## 9. What is not here

- The detailed form of anything. Each area's detailed design is made
  just before the area is built, and adds its own tests.
- How a device is added to a kit. It is the owner's decision, made in
  the first version's detailed design. Test 2.21 says only what must
  be true afterwards.
- The redesign of the GM scanner's screens, and the transfer between
  accounts that the owner placed with it.
- Whether paper documents join the pack. The owner left this open on
  2026-11-01, and nothing in the build depends on it.
