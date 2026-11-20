# Each decision and its test (fourth draft, 2026-11-20)

Status: draft for the owner. It is the first of the five documents the
design hands over. The list of the five is in the program document
(`docs/plans/2026-10-30-architecture-pass.md`, section 4.2) and in
`../DECISIONS.md` ("Five documents the design half hands over"). That
decision asks for each rule "with a proof test in plain words (what to
do, and what must happen)". Where the other four documents are is in
the revised roadmap, section 12 (`2026-11-20-the-roadmap-revised.md`).

This is the fourth draft. Three independent readers checked the first
two and found forty-two faults between them. What each one changed is
in `2026-11-20-the-check-of-the-two-drafts.md`. On 2026-11-20 the
owner moved eight items from after show-ready into the build
(`2026-11-20-what-is-put-off-until-after-show-ready.md`). Their tests
are rows 1.20 to 1.22, 2.31, 5.20 and 5.22 to 5.27, and every row
that used to restart the backend to apply a pack. Rows 1.23 and 4.27
to 4.29 are what the build owes to items that stay after show-ready.

## How to read it

A row. "Do" is what a person or a test does. "Must happen" is what
anyone can then see. "Passes when this is built" names the area of the
build that makes the test passable. The areas are defined in the
revised roadmap, section 3. The column names them like this:

| In the column | The area |
|---|---|
| the test bench | The test bench, and what the new engine is checked against |
| the first version | The first version: a scan passes through every part of the new design |
| the web name in service | The production's web name put into service, with its certificate |
| a whole game session | A whole game session on the GM scanner, the scoreboard page and the player scanner page |
| the room's equipment | The room's equipment, each piece driven the same way and shown as it really is |
| cues and videos | Cues, the video queue and held items |
| the hardware scanner's firmware | The hardware scanner's firmware |
| the preflight | The preflight |
| the tag tools, the checks after a session, the report | Three parts of one area: the tag tools, the checks after a session and the report. Today's config tool is rewired in the same area if the owner decides so. |
| releasing and installing | Releasing and installing the engine, and ALN's content and settings in the new form |
| moving ALN to the new engine | Moving ALN to the new engine |

One piece of the build has no row of its own: the GM scanner's layout,
which is design with the owner. The tests say what must be true
whatever the layout is.

Two words used in the rows:

- **Publish a pack.** Run the command that checks the pack, stamps it
  and makes it the pack in force. A session takes the pack in force
  when it is created. Nothing is restarted.
- **One read of a tag.** One command from the hardware scanner to the
  tag and the tag's reply, which is 60 bytes at most. A tag's link and
  id both fit in it when the link after `https://` is 36 characters
  or fewer, a six-character id included
  (`docs/plans/2026-11-13-phone-tap-to-web-tag-research.md`).

Where a test is proven:

- No mark. On the test bench. A test that involves the room's
  equipment runs twice there. Once with software standing in for each
  program. And once on the test rig, where the real video player, music
  player, sound system and lights program run, with stand-ins for the
  TV, the speakers, the lamps and the Bluetooth speaker.
- "real devices". The test needs a real hardware scanner, phone, tag
  or TV, and the rig has none. It is proven on green at home, and again
  at the venue rehearsal. The owner ruled on 2026-09-12 that green
  becomes the place at home with real equipment for this (ruling R17).
- "later". The test belongs to work the roadmap places after the
  build. The row says which.

When the build is finished. Every test in sections 1 to 6 with no mark
passes on the test bench. Where a test does not name a pack it passes
with ALN's pack and with the toy pack. The tests marked "real
devices" pass on green at home with the new engine installed. The
owner ratified this on 2026-10-30 as "It ends, and the pass with it,
when every rule's test passes on the rig" (the program document,
section 5). Proving the real-device tests on green and not on the rig
is the agent's reading, and the owner can correct it.

## 1. How a session's data is kept

| No. | Decision | Do | Must happen | Passes when this is built |
|---|---|---|---|---|
| 1.1 | The session's record only grows. A correction is a new line. Decision note `0001`. | Sell a token. Then delete that sale as GM. | The record holds both lines, the sale and the deletion. The score is back where it was. No earlier line has changed. The token can be scanned again on every GM scanner, with no reload. | a whole game session |
| 1.2 | | Reset the scores in the middle of a session while one GM scanner is disconnected. Reconnect it. | The record holds every line from before, and one more for the reset. Every screen shows zero, the reconnected GM scanner included. It accepts the tokens again. | a whole game session |
| 1.3 | | Scan a token that another account has already claimed. | The scan is refused. The record holds the refused scan with the reason. | the first version |
| 1.4 | A score change by hand is a line with the amount, the account, the GM scanner it came from and the reason if one was typed. | Change a score by hand and type a reason. | One line with those four things. Every screen shows the new score. | a whole game session |
| 1.5 | The record holds the game, what the room did and what went wrong, one line for each event a person would recognise. Decision note `0002`. | Run a short session: a GM's scan, a player's scan, a video that a rule asks for. Stop the stand-in video player by force. | From the record alone a person can say that each of those happened, in order, with its time. | the first version |
| 1.6 | | Run a short session with a video, a cue, music that a GM pauses and a scanner that loses its connection. Stop the music player by force. | The same, for each of those. The record holds no stream of positions or volumes. No score depends on any of these lines. | cues and videos |
| 1.7 | The record names the pack the session ran and holds the texts the players saw. | Play a session. Publish a pack with other wording and create the next session. Read the first session's record. | It names the pack it ran. It holds the texts its players were shown. | a whole game session |
| 1.8 | Every screen is worked out from the record. The proposal's first change. | Connect a second GM scanner and a scoreboard page in the middle of a session. | Both show what the first GM scanner shows, at once. After every further scan all three agree. | the first version |
| 1.9 | | Disconnect a GM scanner. On another, scan, delete a sale, change a score by hand and reset the scores. Reconnect the first. | It shows exactly what the GM scanner that stayed connected shows, on every game screen. | a whole game session |
| 1.10 | | At the end of each area, run a scripted session. A test reads every value off each screen that area built: each score, each token marked as used, the session's state, each piece of equipment's row. A picture of each screen is kept. | Every value read off a screen equals what the record or the equipment's report says. A person looks through the pictures. Comparing pictures automatically stays out until it is sized, as the owner ruled on 2026-09-12 (ruling R22). The current roadmap had a separate piece of work for this, which it called the truth sweep. | each area that builds a screen |
| 1.11 | After a session ends, nothing is accepted but notes, photos and the accusation, until the next session is created. Decision note `0003`. | End a session. Try a sale on a GM scanner. | Refused, and the GM scanner says why. | the first version |
| 1.12 | | End a session. Restart the backend. Scan a token on the player scanner page. | The session is still ended. The player sees the memory with the notice that the scan was not recorded. Nothing is added to the ended session. | a whole game session |
| 1.13 | A scan stored during a session goes into that session, marked late, whenever it arrives. Decision note `0003`. | End a session. Then let a GM scanner hand over a scan it stored during it. | It lands in that session's record, marked late. The scores change to include it. The next session's record never holds it. | the first version |
| 1.14 | | The same with a scan the player scanner page stored. | It lands in that session's record, marked late. | a whole game session |
| 1.15 | Creating the next session wipes what the group's play produced. What is about the room stays. Decision note `0003`. | Finish a session with scores, accounts, a used token and a logged-in GM. Create the next session. | Scores, accounts and used tokens are gone from every GM scanner, the scoreboard page and the player scanner page. The GM is still logged in. The last session's record is whole. | the first version |
| 1.16 | | The same with a changed volume, a chosen audio route and a connected Bluetooth speaker. | All three are as they were. | the room's equipment |
| 1.17 | | Fire a once-only cue. Hold a video because the TV is down. Leave a cue running. End the session and create the next. | The once-only cue can fire again. No held item is left. No cue shows as running. | cues and videos |
| 1.18 | The pack changes only when a new pack is applied, never in the middle of a session. Decision note `0003`. | Publish a changed pack while a session runs. Go on scanning. | The running session keeps its scoring, its texts and what each device is sent. Its record still names the pack it started with. The next session created runs the new pack, with nothing restarted. | a whole game session |
| 1.19 | A backend runs one session at a time. Each line names the device, not a person. | Read the records of two sessions played one after the other. | Every line names a device. None names a person unless the game's rules put a name there. At no time were two sessions open. | the first version |
| 1.20 | Moving value between two accounts is one action and one line. The owner, 2026-11-13; moved into the build on 2026-11-20. | As GM, move an amount from one account to another. Then undo it. | One line in the record for the move. Both scores change together. Undone, both scores are back, by one more line. | a whole game session |
| 1.21 | The roster, notes and the accusation are lines of the record. Decision note `0002`; moved into the build on 2026-11-20. | Before a session starts, enter the roster. During it, add two notes. At the end, enter the accusation. | The record holds each as a line, with its time and the device it came from. The session's file holds them. No score changes. | a whole game session |
| 1.22 | | End the session. Add a note. Create the next session. Try to add a note to the ended one. | The first note is accepted into the ended session. The second is refused. | a whole game session |
| 1.23 | Photos are lines of the record too. Decision note `0002`. | | These tests are written when sending and keeping photos is designed. The record's line for a photo is designed with the other lines, in the first version. | later: photos |

## 2. The messages and the files

| No. | Decision | Do | Must happen | Passes when this is built |
|---|---|---|---|---|
| 2.1 | A player sees the same after a scan on the player scanner page and on the hardware scanner. | Scan one ordinary token on the player scanner page with a session running. | The memory shows at once, without waiting for the backend's reply. The record holds the scan. | a whole game session |
| 2.2 | | The same with no session, and again after the session has ended. | The memory shows, with the notice that the scan was not recorded. | a whole game session |
| 2.3 | | Scan a video token while no video is playing. | The token's picture shows, with the line that the video is starting on the TV. The video plays. | cues and videos |
| 2.4 | | Scan a video token while another video is playing. | The picture shows, with "Video unavailable, rescan later". The scan is recorded. No second video starts. | cues and videos |
| 2.5 | | Turn the connection off. Scan an ordinary token and a video token. Turn it on. | The ordinary token shows the memory and nothing else. The video token shows "Video unavailable, rescan later". Both scans are stored and handed over. Neither starts a video when it arrives. | cues and videos |
| 2.6 | | Do tests 2.1 and 2.2 on a hardware scanner. | The same on its screen, each time. | the hardware scanner's firmware; real devices |
| 2.7 | | Do tests 2.3 to 2.5 on a hardware scanner. | The same on its screen, each time. | the hardware scanner's firmware, once cues and videos are built; real devices |
| 2.8 | | Change the wording of a notice in the pack. Publish it and create the next session. | The player scanner page shows the new wording. | a whole game session |
| 2.9 | | The same, then restart a hardware scanner. | It shows the new wording. It needed no cable. | the hardware scanner's firmware; real devices |
| 2.10 | A device says which pack it holds and which version of the messages it speaks. One that is out of date is brought up to date, or named. | Publish a changed pack between sessions. Connect a GM scanner that holds the old one. | It fetches the new pack by itself before its first scan, and says so once. The GM can see which pack it runs. | a whole game session |
| 2.11 | | The same with the player scanner page and the scoreboard page. | Each fetches the right pack by itself. | a whole game session |
| 2.12 | | Make a pack fetch that never finishes. Make two fetches at once. | The first is given up after a set time, and the device keeps the whole pack it had. The second leaves one whole pack. These are the two tests the roadmap's row 8.5 names. | a whole game session |
| 2.13 | | Give the backend a newer version of the pages while a GM scanner, a player scanner page and a scoreboard page still have the old pages open. | Each page reloads itself from the backend once, and then works. | a whole game session |
| 2.14 | | Connect a hardware scanner whose firmware is too old for the backend's messages, when it cannot fetch an update. | Its screen says "UPDATE NEEDED". The GM scanner shows it red with what to do. | the hardware scanner's firmware; real devices |
| 2.15 | | The same, with the preflight run. | The preflight lists it. | the preflight; real devices |
| 2.16 | | Connect a hardware scanner whose firmware is older but speaks messages the backend still accepts. | Its scans are recorded. The GM scanner's list of devices shows it as out of date. | the hardware scanner's firmware, with the firmware's message code built for a computer |
| 2.17 | The pack says what each kind of device is sent. | With ALN's pack, capture everything the player scanner page receives. | It holds each token's picture, sound and video name. It holds no token's value, type, group, owner or summary. | a whole game session |
| 2.18 | | With a toy pack that lets a player's device see more. | It receives what that pack says. | a whole game session |
| 2.19 | | Capture everything the scoreboard page receives during a session. | Scores and exposed evidence. No list of transactions and no table of tokens. | a whole game session |
| 2.20 | A GM sees the result of a scan when the backend replies. | Scan a token on one GM scanner that another GM has just sold. | The first and only result shown is that the token is already claimed, with the name of the other account. No success shows first. | the first version |
| 2.21 | A token's id is lowercase letters, digits and underscores, matched the same way everywhere. | Give the backend, the GM scanner and the player scanner page the same list of ids written several ways. | Each accepts and refuses the same ones. | the first version |
| 2.22 | | Give the same list to the firmware's code that reads an id, and to the tag tools. | Each accepts and refuses the same ones as the backend. | the hardware scanner's firmware; the tag tools |
| 2.23 | Every device shows a credential. With none it can read nothing and send nothing. Decision note `0004`. | From a device with no credential, send a scan, ask for the session and ask for the pack. | All three refused. | the first version |
| 2.24 | | Open the player scanner page on a phone for the first time, once with a session running and once with none. | Both times it works with nothing to type. Its credential names no person. It is not carried into the next session: after the next session is created the phone is given a new one. Reading "lasts for one session" this way is the agent's, and the owner can correct it. | the first version |
| 2.25 | | Add a GM scanner and a scoreboard page to the kit. Restart the backend. Remove the GM scanner. | Added, each works, and still works after the restart. Removed, the GM scanner is refused. How a device is added is the owner's decision, made in this area's detailed design. | the first version |
| 2.26 | | Add a hardware scanner to the kit. Remove it. | Added, it works. Removed, it is refused. | the hardware scanner's firmware; real devices |
| 2.27 | Starting and ending a session, running the show and changing a score always stay with staff. Decision note `0004`. | With a phone's credential and with a kit device's credential, try to end the session and to change a score. | Refused. | the first version |
| 2.28 | | With the same two credentials, try to fire a cue, play a video and change a volume. | Refused. | cues and videos |
| 2.29 | The backend knows which devices are connected, with or without a session. The proposal's fourth change. | With no session, connect two GM scanners and a scoreboard page. | A GM scanner lists all three. | a whole game session |
| 2.30 | | With no session, switch a hardware scanner on. | The GM scanner's list of devices shows it. | the hardware scanner's firmware; real devices |
| 2.31 | A tag holds the web link first and the token's id second. Decision note `0005`. | Hold an iPhone and an Android phone to a tag written with the production's link first, with nothing open. | On both, the token's memory opens in the browser. | the web name in service; real devices |
| 2.32 | | Hold a spare tag written with a link first, and one of today's tags, to a hardware scanner. | The same kind of id from both, each in one read of the tag. On the bench, the reading code is given the bytes of both. | the hardware scanner's firmware; real devices |
| 2.33 | | Hold a spare tag written with a link first to a GM's device while the GM scanner is on screen. | The GM scanner takes it. No browser page opens. | a whole game session; real devices |
| 2.34 | | Open a tag's link on a device that holds a staff credential. | The memory shows. No player scan is recorded. | a whole game session |
| 2.35 | | Open the links of two tokens one after the other. Then open a link on a device with no credential. | Each shows its own token. The device with no credential gets a phone's credential and shows the token. | a whole game session |
| 2.36 | | Read a tag written by the tag tool. | The link comes first and the id second. The link names the production, never one kit. It has no port number. Link and id fit in one read of the tag. | the tag tools |
| 2.37 | | Give one token a code that cannot be guessed. Open its link with a wrong code. | Refused. ALN does not use this. The link's form leaves room for it from the first tag written. | later: players' own phones |
| 2.38 | The hardware scanner takes its firmware over the air when it starts, never in a session. Decision note `0006`. | Put a newer firmware on the backend. Restart a scanner with no session running. | It updates and reports the new version. | the hardware scanner's firmware; real devices |
| 2.39 | | The same with a session running. | It does not update. | the hardware scanner's firmware; real devices |
| 2.40 | | Cut its power in the middle of an update. Then give it a firmware that starts and fails its own checks. | Both times it starts on the old firmware. | the hardware scanner's firmware; real devices |
| 2.41 | | Start a scanner on the kit's network, which has no internet. Then point it at a computer that shows another certificate. | Its scans carry the right time, taken from the backend. It refuses the other computer and says so. | the hardware scanner's firmware; real devices |
| 2.42 | | Renew the backend's certificate, as happens about every three months. | Every scanner goes on working, and none needs a cable. | the hardware scanner's firmware; real devices |
| 2.43 | The messages and the files are defined in one place, and every program is checked against the definition. The proposal's third change. | Change one message in the definition and change no program. | The engine's checks fail and name each of its programs that no longer agrees: the backend, the GM scanner, the player scanner page, the scoreboard page. The firmware's own checks fail too when they are run against the changed definition. The config tool joins the engine's check when it is next built against the engine. | the first version |
| 2.44 | | Give the backend a pack and a session's file that break the definition. | Each is refused, with the field named. | the first version |

## 3. Which device decides what

| No. | Decision | Do | Must happen | Passes when this is built |
|---|---|---|---|---|
| 3.1 | A GM scanner with no connection shows the result at once, marked "not confirmed". Decision note `0007`. | Turn a GM scanner's Wi-Fi off. Scan a token. Turn it on. | The result shows at once, marked "not confirmed". After the connection returns it is confirmed with the same numbers. | the first version |
| 3.2 | Of two scans of one token, the first to reach the backend counts. The other GM is told. | Two GM scanners, one with no connection, scan the same token. Reconnect. | The scan that reached the backend first counts. The other GM scanner shows which scan was refused and why. | the first version |
| 3.3 | A result the backend has confirmed is never taken back. | After a confirmed sale, let another GM scanner hand over an earlier scan of the same token. | The confirmed sale stands. | the first version |
| 3.4 | If the backend's computer dies, the session goes on at the GM scanners. | Stop the backend in the middle of a session. Keep scanning on two GM scanners. Start it again. | Every scan made meanwhile is in the record with the time it was made. The scores are right. | the first version |
| 3.5 | | The same. Look at each GM scanner while the backend is down. | Each says that the backend cannot be reached, and shows which of its controls still work. | a whole game session |
| 3.6 | No spare computer is required. One can take over. | Stop the backend for good in the middle of a session. Start a second computer at the first one's address, with the pack and a copy of the installation's settings. | The GM scanners reach it with nothing done to them but, at most, a new login. They hand over what they hold. The session goes on there with the right scores. | a whole game session |
| 3.7 | A game that needs the backend says so in its pack. | With such a pack, stop the backend. | Every GM scanner says the session cannot go on. | a whole game session |
| 3.8 | With no connection a GM scanner cannot pause or end the session or run the room. | Turn a GM scanner's Wi-Fi off in a networked game. | The controls for the session show grey, with the reason. | a whole game session |
| 3.9 | | The same. Look at the controls for the room. | They show grey, with the reason. | the room's equipment |
| 3.10 | A game with no backend plays by the same rules. Decision note `0008`. | Play one scripted session with a backend and again without, with the toy pack and with three of ALN's tokens. | The same scores, and the same lines for the GMs' scans. | the first version |
| 3.11 | | The same with every one of ALN's rules, the group bonus included. | The same scores. | a whole game session |
| 3.12 | The installation's settings say whether there is a backend. | Open a GM scanner in an installation with none. | It starts with no choice of mode. | the first version |
| 3.13 | The pack says whether its game can be played without a backend. | In an installation with no backend, load a pack that needs one. | It refuses to start and names the need. | a whole game session |
| 3.14 | The GM scanner keeps the record and can save it. | In an installation with no backend, play a session and save the record at the end. | The saved file is whole, and it passes the same check of its form as a backend's. | the first version |
| 3.15 | Several GM scanners' parts are put together afterwards. | Save the records of two GM scanners that played one session with no backend. Put them together. | One session with the right totals. | a whole game session |
| 3.16 | With no backend, the GM scanner runs the clock and shows the scoreboard. A player scanner shows memories and sends nothing. | Play a session with no backend. Open a video token on the player scanner page, from wherever that installation's pages are kept. | The clock runs on the GM scanner. Its scoreboard shows scores and exposed evidence. The player scanner page shows the picture and a line saying the video cannot be played here. It sends nothing. Where the pages are kept is part of the owner's decision on how a device is added to a kit. | a whole game session |
| 3.17 | | Set a hardware scanner for an installation with no backend. Scan a token. | The memory shows. The scanner shows no connection fault and stores nothing to send. | the hardware scanner's firmware; real devices |
| 3.18 | | Play a session with no backend. Download the report on the GM scanner. | The report has the same form as one made with a backend. It holds what the GMs scanned and nothing of what players looked at. | the report |

## 4. How the engine is extended

| No. | Decision | Do | Must happen | Passes when this is built |
|---|---|---|---|---|
| 4.1 | A designer designs the game's rules in the pack. Decision note `0011`. | Play a session with a toy pack scored its own way, and with three of ALN's tokens whose two verbs are written as pack rules. | The toy pack gives its own numbers. ALN's tokens give ALN's numbers. The engine's code holds neither game's formulas. | the first version |
| 4.2 | | Play real ALN sessions from blue again through ALN's pack, with all its rules written as pack rules. | The same final scores as blue gave. This needs session files from blue. | a whole game session |
| 4.3 | | Run a toy pack with a deposit that is doubled in the last ten minutes, a steal from another account, and a bonus for one of every colour. | It plays, with no change to the engine's code. | a whole game session |
| 4.4 | | Change one number in a formula. Publish the pack. Create a session. | The new scoring applies in the backend, with nothing restarted. It applies the same in a GM scanner with no backend, once that GM scanner has fetched the pack. | the first version |
| 4.5 | | Publish a pack whose rule needs a capability the engine does not have. | Refused at publish and at start, with the capability named. | the first version |
| 4.6 | | Publish a pack with a formula that uses an operation that does not exist, or reads a value no token carries. | Refused at publish, with the place named. A pack holds rules and formulas, never program code. | the first version |
| 4.7 | | Publish a pack with a verb that gives points to one account and takes them from another, uses the token up and changes what is shown. | Accepted. Scanning with that verb does all of it. | the first version |
| 4.8 | | Publish a pack that lets a player's device start or end a session, run the show by hand or change a score by hand. | Refused. Those three actions stay with staff. Nothing else about a game's rules is refused on this ground. | the first version |
| 4.9 | | Do a scan with a verb that gives points. | The record shows the verb and the points, with the name of the rule that caused them and the values the formula read. | the first version |
| 4.10 | | Do a scan that completes a set. | The bonus is its own entry in the record, with the name of the rule that caused it. | a whole game session |
| 4.11 | | With a pack whose rule says a GM's scan of one token plays a video, scan that token as GM. Then do it in an installation with no backend. | The video plays. With no backend the request to the room is skipped and the scan still counts. This answers the roadmap's row 8.16. | cues and videos |
| 4.12 | | With ALN's pack, scan a video token on a player scanner, then as GM. | The player's scan plays the video. The GM's scan does not. Both follow from ALN's pack, not from the engine's code. | cues and videos |
| 4.13 | | Fire every cue of ALN's pack and of the toy pack. Then publish a pack whose cue would change a score. | No score, token or account changes. The pack is refused at publish. A cue never changes the game. | cues and videos |
| 4.14 | | In the config tool, with no developer, write a verb and a formula and play it. | It plays. Until this is built, a pack's rules are written in the pack's files and pass the same checks. | later: the config tool's pages for previewing a game |
| 4.15 | | Change a text, a picture and what a player's scan of one token does. Publish, create the next session, restart a hardware scanner. | The scanner shows the new text and picture, and the scan does the new thing. No cable. Nothing a designer changes needs a hardware scanner re-flashed. | the hardware scanner's firmware; real devices |
| 4.16 | A new capability is part of the engine. It is one file in a known place. Decision note `0009`. | As a drill, add one new operation for formulas. | One new file. No other file of the engine's code is edited. The toy pack uses it, in the backend and in a GM scanner with no backend alike. | the first version |
| 4.17 | | As a drill, add a stand-in kind of equipment. | One new file. It shows on the GM scanner's health panel with no change to the GM scanner's code. It shows in the preflight when the preflight is built. | the room's equipment |
| 4.18 | After a restart the background comes back by itself. What was cut off is listed for the GM. Decision note `0010`. | Restart the backend in the middle of a session. | The session, the scores and the GMs' logins are back. Nobody logs in again. | the first version |
| 4.19 | | The same with the game clock running. | The clock is back, at the right time. | a whole game session |
| 4.20 | | The same with music playing, the scoreboard on the TV, the lights in a scene and a changed volume. | The music goes on from where it stopped. The TV shows the scoreboard. The lights and the volume are as they were. | the room's equipment |
| 4.21 | | The same with a video half-way, a cue half-way, and a clock cue falling due while the backend is down. | The video and both cues are on the GM's list, each with run and drop. Nothing replays by itself. The clock cue is marked as fired. | cues and videos |
| 4.22 | | Stop only the music player by force. Then stop only the video player, in the middle of a video. | Each is started again. The music goes on. The video is on the GM's list. | the room's equipment |
| 4.23 | A copy started for a test or a rehearsal leaves the installed backend as it was. The proposal's seventh change. | With the installed backend running and no session, start a second copy on the same computer, use it, stop it. | The installed backend's programs, files and screen are exactly as before. The copy used stand-ins, and never the real TV, speakers or lights. | the room's equipment |
| 4.24 | | Run the engine's whole test set on a computer where an installed backend is running. | The installed backend's programs, files and screen are exactly as before. | the room's equipment |
| 4.25 | | Start a second copy that asks for the real TV, speakers and lights while the installed backend holds them. | Refused, with the reason. Only one copy at a time holds the real equipment. | the room's equipment |
| 4.26 | The backend is assembled in one place. A restart follows the same steps as a normal start. The proposal's seventh change. | Play music. Start over between groups, each way a GM can: end the session and create the next, and reset the system where the GM scanner still has that button. Start a playlist. Fire a cue that waits for a music event. | Each time, the music panel shows the new track and the cue fires once. | cues and videos |
| 4.27 | A designer's rules say who may do a verb, and on which kind of device. Decision note `0011`. | With a toy pack that gives a player's device a verb worth points, do it on the player scanner page. | The points change as the pack's rule says. The record holds the scan with the device it came from. | a whole game session |
| 4.28 | | The same on a hardware scanner. | The same. The scanner shows what the backend's reply says to show. | the hardware scanner's firmware; real devices |
| 4.29 | A new capability is part of the engine, also when it keeps state of its own. Decision note `0009`. | As a drill, add a capability that keeps a count of its own from scan to scan, and a toy rule that reads the count. | One new file. The count is in the record. It is right after a restart of the backend, and the same in a GM scanner with no backend. | the first version |

## 5. Rulings from before the pass that the build must still meet

The owner made these on 2026-09-12 and earlier. The current roadmap
grouped most of them as the hardening block. They are built inside the
build's areas. The source of each is named so the wording can be
checked.

| No. | Ruling | Do | Must happen | Passes when this is built |
|---|---|---|---|---|
| 5.1 | A crashed program is restarted a set number of times within a set time. Then the backend stops trying and says so. The hardening plan, pin P10. | Stop the video player by force again and again. | After the set number the backend stops trying. The GM scanner shows it red, with why and a Restart button. Pressing it starts the player. | the room's equipment |
| 5.2 | Restarting ships switched on. The host file can set the number to zero, which means restarts by hand only. Rulings R6, R13 and R18. | Set the number to zero. Stop the video player by force. | It is not restarted. The GM scanner shows it red with the Restart button. | the room's equipment |
| 5.3 | A host can mark a program as run by something else on that computer. Ruling R18. | Mark the video player that way. Stop it by force. Start it by hand. | The backend does not start it. When it is back, the backend uses it again and says so. | the room's equipment |
| 5.4 | One part of the backend starts and restarts every program, the TV's browser included. Ruling R20. | Stop the TV's browser by force while the scoreboard shows. Then again while a video shows. | The first time it is started again and shows the scoreboard. The second time it is started when the scoreboard is next wanted. | the room's equipment |
| 5.5 | A GM can put a piece of equipment out of service, and back in. Pin P12. | Put the lights out of service and type a reason. Put them back. | Out of service, the row shows grey with the reason and restarts stop. Back in service, the lights program is started and checked. | the room's equipment |
| 5.6 | | Hold a cue because the lights are down. Then put the lights out of service. | The held cue is dropped. | cues and videos |
| 5.7 | Equipment that is not installed shows grey, never red. Pins P1 to P5. | Run the toy pack with lighting not installed. Reconnect a GM scanner. | Lighting shows grey with its reason, after the reconnect too. | the room's equipment |
| 5.8 | | Fire a cue that needs only lighting. Fire a cue that needs lighting and sound. | The first is refused with that reason. The second plays the sound, and its result says the lighting command did not run. | cues and videos |
| 5.9 | The installation's settings file is checked when the backend starts. Pins P17 to P19, ruling R12. | Start the backend with the path to the settings file mistyped. | The check row says no-go, with the reason. The health panel does not read as all calm. | the room's equipment |
| 5.10 | A session cannot start when the pack requires equipment the installation does not have, when fewer devices of a kind are connected than the pack's minimum, or when the settings file fails its check. A GM can override with a typed reason. Pins P7 and P19. | Try to start a session in each of the three cases. Then type a reason. | Refused each time, with what is missing named. With the typed reason it starts. The record holds the override, the reason and the device it came from. | the room's equipment |
| 5.11 | A program that is installed and has crashed never blocks a start. Pin P1. | Start a session with the video player stopped. | It starts. The video player shows red with its buttons. | the room's equipment |
| 5.12 | The preflight says what it checked and how deeply, and says what it cannot check. The roadmap's honesty rule of 2026-09-05; pin P8. | Run it with one video file missing. | It names the file. Every row says whether it was checked from files alone or against the running equipment. It states what only a person can check. | the preflight |
| 5.13 | The preflight runs from the command line and shows on the GM scanner. | Run it both ways at the same moment. | The same rows. From the command line with no backend running, it gives the rows that files alone can answer. | the preflight |
| 5.14 | The preflight counts the scanners and scoreboards that are connected against what the installation's settings say, and says whether the TV's scoreboard page is really showing. Ruling R21; the roadmap's table of what serves each trouble. | Run it with one hardware scanner switched off and the second scoreboard's browser closed. | It names both as missing. | the preflight; real devices |
| 5.15 | The backend's computer powers on into a running system. The roadmap's fifth trouble. | Switch green off and on. | The backend, the video and music players and the TV come up by themselves. A GM scanner connects. The preflight runs with no terminal opened. | moving ALN to the new engine; real devices |
| 5.16 | The phone page and the hardware scanner can do the same things. The roadmap, section 2.5. | Tests 2.6, 2.7, 2.9 and 4.15. | What a player sees and what a scan does are the same on both. | the hardware scanner's firmware; real devices |
| 5.17 | Anything held for a piece of equipment is dropped when the session ends. Pin P13. | Hold a video because the TV is down. End the session. | No held item is left. | cues and videos |
| 5.18 | The report's structure is fixed in the engine and its wording comes from the pack. The ★ marks a place ALN's Director Console reads. The owner, 2026-08-29. | Download the report after a scripted session with ALN's pack. | It has the fixed structure, with ALN's wording. Each ★ is where the Director Console expects it. The test that pins the report's form passes. Its times agree with each other. | the report |
| 5.19 | The checks after a session find scoring that does not add up, videos that did not play and scans counted twice. | Run them on the record of a clean scripted session, and on one with a wrong score planted. | The clean one passes. The planted fault is named. They read the record and nothing else. | the checks after a session |
| 5.20 | A designer changes a game's values in the config tool, applies the change and plays it. The roadmap, section 2.4. Applying needs no restart since 2026-11-20. | Change one of ALN's base values in the pack's files, which is how it is done until the config tool is built against the new engine. Publish. Create a session. Sell a token of that value. | The new value is scored. From the change to the sale took under two minutes, the measure the owner set on 2026-09-04. | the first version |
| 5.21 | | The same, with the value changed in the config tool. | The same. The config tool wrote none of the backend's own files and holds no copy of the backend's secret. | the area with the tag tools, if the owner has today's config tool rewired (the roadmap draft, section 11). Otherwise later: the config tool's pages. |
| 5.22 | A GM can advance the game to its next phase by hand. The owner, 2026-08-22; moved into the build on 2026-11-20. | With a toy pack in three phases, where the second starts on an event that never comes, press the control to advance. Pause and resume the session. Restart the backend. End the session and press the control again. Create the next session. | The second phase starts. The record holds a line for it, with the device it came from. The phase is the same after the pause and after the restart. After the end the control is refused. The next session starts in its first phase. | a whole game session |
| 5.23 | A cue's time can be set from the start of a phase. The owner, 2026-08-22; moved into the build on 2026-11-20. | With a cue set to fire two minutes into the second phase, advance to the second phase by hand. | The cue fires two minutes later, once. | cues and videos |
| 5.24 | Each kind of equipment a pack names is tied to real equipment by the installation's settings, with no fallback. The owner's rulings of 2026-08-29 and 2026-09-04; moved into the build on 2026-11-20. | With the lights installed, leave one of the pack's lighting looks tied to no scene. Ask for that look from the GM scanner. | That look shows as a fault and is named. No scene name written in the pack is used. | the room's equipment |
| 5.25 | | Leave the idle loop's video tied to no file. | The idle loop counts as not installed and shows grey. The engine's own settings supply no file. | the room's equipment |
| 5.26 | | Read ALN's pack. On the rig, fire its cue that plays the police sounds. | The pack names no speaker. The cue names a kind of sound output. The installation's settings tie that kind to a speaker, and the sound plays there. | cues and videos |
| 5.27 | The secrets in today's repository are changed before an outside person touches the system. The owner, 2026-09-05; changed when green is set up for the new engine since 2026-11-20. | On green, set up for the new engine, try the Home Assistant token and the admin password that are in today's repository. | Both are refused. | moving ALN to the new engine; real devices |

## 6. Faults recorded in today's engine, as tests

The program document asks that the faults found on blue and in the
evidence be used as tests, not derived again. The cause analysis
(`../2026-10-30-cause-analysis.md`, section 4) lists each as something
to do and what happens today. The rows here are the ones that would be
worst at a session. The four the program document names are tests
1.1, 1.12, 4.26 and 6.1. The five the retired truth sweep was to test
again are tests 1.9, 5.7 and 6.1 to 6.5.

Every other reproduction in the cause analysis's section 4, and every
item of the truth sweep's census
(`docs/plans/2026-09-12-block3-truth-sweep-census.md`), goes on the
list of pending cases of the area that builds its part. That area's
detailed design turns each into a test or sets it aside with a reason.
A fault fixed on blue during the build is added to the same list.

| No. | The fault today | Do | Must happen | Passes when this is built |
|---|---|---|---|---|
| 6.1 | The music panel falls behind the music. | Play music from the GM scanner. Stop the music player by force with the panel open. Let it restart. | The panel shows at once that the music player has stopped. The progress bar stops. After the restart the panel follows the music again, with no reload. | the room's equipment |
| 6.2 | A change made at the player itself reaches no GM scanner. | Change the track and the volume at the music player, outside the engine. | Every GM scanner follows. | the room's equipment |
| 6.3 | A volume slider shows the GM scanner's own remembered value. | Change a volume on one GM scanner. Disconnect and reconnect the Bluetooth speaker. | Every GM scanner's slider shows the backend's value. | the room's equipment |
| 6.4 | Setting a volume with nothing playing gives a bare error. | Set the music volume while the music is stopped. Move the video slider with no video playing. | The volume is set and shows, or the refusal says why. | the room's equipment |
| 6.5 | A GM scanner that reconnects misses part of the room's state. | Disconnect a GM scanner. Play a sound, change a route and hold a video. Reconnect. | It shows what a GM scanner that stayed connected shows, on every panel. | cues and videos |
| 6.6 | "Check now" on a piece of equipment that is down gives no sign. | With a piece of equipment down, press "check now". | The row shows the time of the check and its result. | the room's equipment |
| 6.7 | A GM scanner with a dead connection goes on showing its last numbers as if live. | Cut a GM scanner's connection for a minute. | It says the backend cannot be reached. Its panels are marked as last known, with the time. | the room's equipment |
| 6.8 | The scoreboard goes on counting down after it loses the backend. | Stop the backend while the scoreboard page shows. | The scoreboard page shows that it has lost the backend. | a whole game session |
| 6.9 | The backend says a video has started long after the picture. | On the rig, play a video and compare the time the backend says "started" with the time the video player itself began to play. | Within half a second, every time. The figure is the cause analysis's. On green, a person checks it against the picture on a real TV. | the room's equipment |
| 6.10 | A cue with a two-second video never completes. | Fire such a cue. | It completes. | cues and videos |
| 6.11 | A paused video is played over. | Pause a video. Scan a video token on a player scanner. Release a held video. | The player is told the video is unavailable. The released video waits and does not play over the paused one. | cues and videos |
| 6.12 | Music stays lowered after the video queue is cleared. | Start a video so that the music is lowered. Clear the queue. | The music returns to its volume. | cues and videos |
| 6.13 | A cue with half its commands skipped reports a clean finish. | Fire a cue while one piece of equipment it needs is down. | The cue's result says which commands did not run. | cues and videos |
| 6.14 | Stored scans sent twice are stored twice. | Hand over the same stored scans twice, with a backend restart in between. | Each scan is in the record once. | the first version |
| 6.15 | A scan the backend can never accept is sent again and again. | Send a scan with a verb the pack does not have. | Refused once, with its reason shown to the GM. It is not sent again. | the first version |
| 6.16 | A device is told its stored scans were processed when nothing was stored. | Hand over stored scans that belong to no session the backend holds. | The device is told they were not recorded. | a whole game session |
| 6.17 | Reloading a GM scanner wipes the scans it had not sent. | Scan on a GM scanner with no connection. Reload its page. Reconnect. | The scan is still there and is handed over. | the first version |
| 6.18 | A GM scanner that reloads after losing Wi-Fi is refused for over a minute. Two devices can take the same name. | Drop a GM scanner's connection without closing it. Reload it. | It is connected again within seconds, as the same device. No two devices ever hold one name. | the first version |
| 6.19 | A sale and a score change are stamped by two clocks. | Set a GM scanner's clock ten minutes wrong. Sell a token and change a score by hand. | The record's lines are in the order they happened. The game clock on that GM scanner agrees with the backend's. | a whole game session |
| 6.20 | A file edited on the disk is served while the engine scores by the old one. | Edit a pack file on the disk without publishing. | The backend, every device and the scoreboard page go on with the published pack. What the backend serves matches its own list of the pack's files. | a whole game session |
| 6.21 | Starting over brings an earlier session's transactions back. | Scan three tokens. End the session and create the next. Scan two. Reset the scores. | No transaction or evidence from the earlier session comes back on any screen. | a whole game session |
| 6.22 | A watcher of the sound system stops for good and nothing says so. | Stop the watcher of the sound system by force five times. | It is running again. The audio panel still follows a change made at the sound system. | the room's equipment |
| 6.23 | Going back a release leaves parts of the newer one in place. | Install a release. Install the next. Go back to the first. | The backend, every page it serves and the firmware it offers are the first release's. Every program says which release it runs, and the GM scanner shows it. | releasing and installing |
| 6.24 | A computer built from the documents pairs a speaker that plays nothing. | Build a clean computer from the new guide and pair a speaker. | The speaker plays sound. | moving ALN to the new engine; real devices |
| 6.25 | A test run passes while it skips what it could not do. | Run the whole test set with the video player missing from the rig. | The run fails and names what is missing. No test is skipped unless it is listed with its reason. | the test bench |
| 6.26 | A stand-in behaves differently from the program it stands for. | On the rig, give each stand-in and its real program the same commands. | The same reports from both. | the room's equipment |
| 6.27 | ALN's content tools write a pack the engine cannot take. | Run ALN's sync from Notion. | The pack it writes passes the pack's check, with ALN's rules left as they were. | releasing and installing |

## 7. Each cause found in today's engine, and what removes it

The design ends only when "every finding and every fix made on the
show machine in use now is assigned to a rule, or set aside with a
reason" (`../DECISIONS.md`, "When the design half is finished"). The
cause analysis assigns each of its 358 findings to one of sixteen
causes, or sets it aside, in its sections 3 and 5. This table assigns
each cause.

| Cause, in the cause analysis's order | What removes it | Tests |
|---|---|---|
| 1. Each GM scanner keeps its own copy of each game fact and updates it by its own rule. | The record only grows and every screen is worked out from it. Decision note `0001`. | 1.1, 1.2, 1.8, 1.9, 2.20 |
| 2. A program's health and its state reach the GM scanner as two separate things. | Each piece of equipment gives one report: what it is doing, whether it is working, and when that was last checked. The proposal's fourth change. | 6.1, 6.2, 6.3 |
| 3. The backend's picture of each outside program is a stored copy that it never checks against the program. | The same way of driving equipment: the report is read from the program, and what the backend asked for is checked against what the program says. | 6.4, 6.9, 6.10, 6.22, 6.26 |
| 4. No fact says what happens to it when a session starts or ends, at a restart or at a reload. | Three lifetimes: a session, an installation, the production. Decision note `0003`. What comes back after a restart: `0010`. | 1.11 to 1.18, 4.18 to 4.22, 6.17 |
| 5. Starting the backend and resetting it are two hand-kept sequences. | The backend is assembled in one place, and a restart follows the same steps as a start. The proposal's seventh change. | 4.26, 6.21 |
| 6. What a device gets when it connects and what it gets live are built by different code. | One piece of code updates every screen from the record, connected or reconnecting. The proposal's first change. | 1.8, 1.9, 6.5 |
| 7. A reply does not say which request it answers, whether it is final, or whether the scan was stored. | Every scan and command gets one kind of reply: accepted, refused with the reason, held for later, or failed and worth sending again. The proposal's first change. | 6.14, 6.15, 6.16 |
| 8. The backend assumes it owns the computer, and the tests assume they may use it. | A copy started for a test or a rehearsal leaves the installed backend as it was. The proposal's seventh change; the owner's decision of 2026-11-12. | 4.23, 4.24, 4.25 |
| 9. The GM scanner and the player scanners decide things the backend is the authority for, from their own copy of the rules. | The GM scanner runs the same rules code as the backend, and marks what the backend has not confirmed. Decision notes `0007`, `0008`. | 2.20, 3.1 to 3.4, 3.10, 3.11, 6.19 |
| 10. Nothing on a screen says whether a value is known, unknown or old. | The one report carries when it was last checked. A result is marked "not confirmed". The settings file's check says no-go. The preflight labels how deeply each row was checked. | 3.1, 5.9, 5.12, 6.6, 6.7, 6.8, 6.13 |
| 11. One question has several answers inside one program, such as "is a video playing". | Game facts are read from the record and the room's from each piece's one report. Cues, the video queue and held items are changed to read those. | 6.11, 6.12, 5.17 |
| 12. The pack is read at scattered moments, and nothing says the pack changed. | The pack belongs to the production and changes only when applied, never in a session. Every device says which pack it holds and fetches the right one. Decision note `0003`; "A device that is out of date". | 1.7, 1.18, 2.10 to 2.12, 6.20 |
| 13. The backend does not know who is connected, and every device is sent everything. | Every device shows a credential, and the pack says what each kind of device is sent. Decision note `0004`. | 2.17 to 2.19, 2.23 to 2.30, 6.18 |
| 14. Names and shapes that join two programs are kept by hand on each side. | The messages and the files are defined in one place and every program is checked against the definition. The proposal's third change. | 2.43, 2.44, 2.21 |
| 15. The installed game is several separately versioned checkouts, hand-copied files and hand-run steps. | No decision of the owner's covers it. The agent's engineering call: a release is one numbered package that is installed and can be gone back from. The revised roadmap, section 7. | 6.23, 6.24, 5.15 |
| 16. A passing test run does not show that the real path works. | Tests drive the engine from outside, on a test bench outside the engine, and what each screen shows is read and checked. The owner's decision of 2026-11-01, "One published protocol and an outside test bench". | 1.10, 6.25, 6.26 |

The cause analysis set twenty-one findings aside, and they stay set
aside for the reasons it gives. One was a question for the owner,
whether a refused GM scan is recorded anywhere. It is answered: the
record holds refused scans (test 1.3). Six it called plain fixes to be
made in the build. Each goes on the pending list of the area that
writes the code it is in:

- A name supplied by a device that can match a built-in word of the
  programming language, in four places (the cause analysis's B-80 and
  X-02): the first version, and the room's equipment.
- The player scanner page loading one library from the internet
  (D-19), and the GM scanner's red "Disconnected" mark in a game with
  no backend (A-35): a whole game session.
- The tests' helper that switches off certificate checks for the whole
  test run (D-57): the test bench.
- The second way of running outside commands inside the code for the
  TV's browser (B-91): the room's equipment.

## 8. How each decision serves the work after the build

The design also ends only when "every rule says how it serves the
planned capabilities and standalone games". The planned capabilities
named when that was decided are: applying a changed pack without
restarting the backend, a rehearsal on a copy of the backend,
recording a session as it is played, and players' own phones. Since
2026-11-20 the first is built in the build, and so is the third
except for photos. The table says what each decision gives to them
and to the work that still comes after.

| Decision | What it gives the work after the build |
|---|---|
| The session's record only grows. `0001` | The roster, notes and the accusation are lines of it, and photos are added as lines later. Scans from players' phones are added in order. A game with no backend keeps the same kind of record on the GM scanner. |
| One record for the game, the room and what went wrong. `0002` | The roster, notes, photos and the accusation already have their place. The report and the checks after a session read one file. |
| What belongs to a session, an installation and the production. `0003` | A published pack is taken up when the next session is created and never inside one, so the config tool's editor needs only a button to apply a change. A rehearsal has its own session and its own settings. |
| Every device shows a credential. `0004` | A player's phone gets one with nothing to type. The pack can then say what a phone may do. |
| A tag holds the link first. `0005` | Both kinds of phone open a token by themselves. |
| The hardware scanner takes firmware over the air. `0006` | A change to the messages for phones or for the second game reaches every hardware scanner with no cable. |
| A GM scanner carries on without the backend. `0007` | The same rules code runs in the backend, in a GM scanner and in a rehearsal's copy. |
| A game with no backend. `0008` | Standalone games are a kind of installation, not a mode a GM picks. A pack says whether it can be played that way. |
| A new capability is part of the engine. `0009` | What the second game needs is added once, in a known place, and every designer can use it. |
| What comes back after a restart. `0010` | A rehearsal's copy and the installed backend start by the same steps. |
| A designer designs the rules in the pack. `0011` | The config tool's editor edits rules and formulas as pack data, and a designer plays the change. Actions that take two tokens are verbs like any other. |
| The pack says what each kind of device is sent. | A game can show different players different things. A phone is sent only what it may show. |
| A device that is out of date fetches the right pack by itself. | Applying a changed pack reaches every device with nothing done by hand. |
| The messages and files are defined in one place. | The config tool, a phone page and another production's tools are checked against the same definition. |
| A copy of the backend leaves the installed one alone. | A rehearsal can run on the backend's own computer between sessions. |

## 9. What is not here

- The detailed form of anything. Each area's detailed design is made
  just before the area is built, and adds its own tests.
- How a device is added to a kit, and where the pages of an
  installation with no backend are kept. Both are the owner's
  decision, made in the first version's detailed design. Tests 2.25,
  2.26 and 3.16 say only what must be true afterwards.
- The layout of the GM scanner's screens. It is designed with the
  owner before the areas that build them. The tests here say what
  must be true whatever the layout is.
- Choosing among several verbs on a player's device, and actions that
  take two tokens. They wait for the second game's design. The form of
  a rule is written in the first version so that a verb of two steps
  fits.
- Whether paper documents join the pack. The owner left this open on
  2026-11-01, and nothing in the build depends on it.
