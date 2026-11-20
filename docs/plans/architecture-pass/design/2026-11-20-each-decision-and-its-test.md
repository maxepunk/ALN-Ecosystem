# Each decision and its test (draft, 2026-11-20)

Status: draft for the owner. One of the two documents the design hands
over (the program document, section 5; `../DECISIONS.md`, "Five
documents the design half hands over"): each decision with a test in
plain words, what to do and what must happen. The build is finished
when every test here passes on the test rig, on ALN's pack and on the
toy pack. The other document is the revised roadmap
(`2026-11-20-the-roadmap-revised.md`).

How to read a row. "Do" is what a person or a test does. "Must happen"
is what anyone can then see. A test marked (real devices) cannot be
proven on the rig and belongs to the hardware pass on green or to the
venue rehearsal. A test marked (later) belongs to work the roadmap
places after the build.

Every test runs twice. Once with software standing in for the
speakers, lights and TV. And once on the test rig, a computer set up
with the real video and music players.

## 1. How a session's data is kept

| Decision | Do | Must happen |
|---|---|---|
| The session's record only grows. A correction is a new line. (`docs/adr/0001`) | Sell a token. Then delete that sale as GM. | The record holds both lines, the sale and the deletion. The score is back where it was. No earlier line has changed. |
| | Reset the scores in the middle of a session. | The record still holds every line from before, and one more for the reset. Every screen shows zero. |
| The record holds the game, what the room did and what went wrong, one line for each event a person would recognise. (`0002`) | Run a short session: a GM's scans, a player's scan, a video, a cue, a score changed by hand. Stop the music player by force. | From the record alone a person can say that each of those happened, in order, with its time. The record holds no stream of positions or volumes. |
| Every screen is worked out from the record. (the proposal's change 1) | Connect a second GM scanner and a scoreboard in the middle of a session. | Both show what the first GM scanner shows, at once. After every further scan all three agree. |
| | After a scripted session, capture every screen of the GM scanner and the scoreboard. | Each capture says what the record says: scores, used tokens, the session's state, each piece of gear. The current roadmap had a separate piece of work for this, which it called the truth sweep. |
| After a session ends, nothing is accepted but notes, photos and the accusation, until the next session is created. (`0003`) | End a session. Try a sale on a GM scanner. | Refused, and the GM scanner says why. |
| A scan stored during a session goes into that session, marked late, whenever it arrives. (`0003`) | End a session. Then let a player scanner and a GM scanner hand over scans they stored during it. | Both land in that session's record, marked late. The scores change to include the GM's scan. The next session's record never holds them. |
| Creating the next session wipes what the group's play produced. What is about the room stays. (`0003`) | Finish a session with scores, a used token, a set volume and a logged-in GM. Create the next session. | Scores, accounts and used tokens are gone from every screen and scanner. The volume and the login are as they were. The last session's record is whole. |
| Each line names the device, not a person. | Read a record. | Every line names a device. None names a person unless the game's rules put a name there. |
| Moving money between accounts is one action and one line. | As GM, move an amount from one account to another. | One line in the record. Both scores change together. The report shows a transfer. |

## 2. The messages and the files

| Decision | Do | Must happen |
|---|---|---|
| A player sees the same after a scan on the phone page and on the hardware scanner. | Scan one ordinary token on each, with a session running. | Both show the memory at once. The record holds both scans. |
| | The same with no session. | Both show the memory, with the same notice. |
| | Scan a video token on each while another video is playing. | Both show the picture and "Video unavailable, rescan later". The scan is recorded. No second video starts. |
| | The same with no connection. | Both show the memory. The scan is stored and handed over later. A stored scan never starts a video. |
| A device says which pack and version it has when it connects, and an old one is brought up to date or named. | Publish a changed pack. Connect a GM scanner that holds the old one. | It fetches the new pack by itself before its first scan. The GM can see which pack it runs. |
| | Connect a hardware scanner whose firmware is one version behind. | Its screen says "UPDATE NEEDED". The GM scanner shows it red. The preflight lists it. |
| The pack says what each kind of device is sent. | With ALN's pack, capture everything a player scanner receives. | No token's value, type or group is in it. |
| | With a toy pack that lets a player's device see more. | It receives what that pack says. |
| A GM sees the result of a scan when the backend replies. | Scan a token on one GM scanner that another GM has just sold. | The first and only result shown is "already claimed by" the other account. No success is shown first. |
| A token's id is lowercase letters, digits and underscores, matched the same way everywhere. | Give each reader the same id written several ways. | Every reader accepts or refuses the same ones. |
| Every device shows a credential. With none it can read nothing and send nothing. (`0004`) | From a device with no credential, send a scan and ask for the session. | Both refused. |
| | Open the player scanner page on a phone for the first time. | It works with nothing to type. Its credential ends with the session. |
| | Add a scanner to the kit. Remove it again. | Added, it works. Removed, it is refused. (How a device is added is the owner's decision, still open.) |
| | With a phone's credential, try to end the session and to change a score. | Both refused. |
| A tag holds the link first and the id second. Both phones open the link by themselves. (`0005`) | (real devices) Hold an iPhone and an Android phone to a new tag with nothing open. | On both, the token's memory opens in the browser. |
| | Hold a new tag and an old tag to a hardware scanner. | The same id from both, each in one read. |
| | Hold a token to a GM's device while the GM scanner is on screen and no account is chosen. | The GM scanner takes it. No browser page opens. No player scan is recorded. |
| The hardware scanner takes its firmware over the air when it starts, never in a session. (`0006`) | (real devices) Put a newer firmware on the backend. Restart a scanner with no session running. | It updates, and reports the new version. |
| | The same with a session running. | It does not update. |
| | Cut its power in the middle of an update. | It starts on the old firmware. |

## 3. Which device decides what

| Decision | Do | Must happen |
|---|---|---|
| A GM scanner with no connection shows the result at once, marked "not confirmed". (`0007`) | Turn a GM scanner's Wi-Fi off. Scan a token. Turn it on. | The result shows at once, marked "not confirmed". After the connection returns it is confirmed with the same numbers. |
| Of two scans of one token, the first to reach the backend counts. The other GM is told. | Two GM scanners, one with no connection, scan the same token. Reconnect. | The scan that reached the backend first counts. The other GM scanner shows which scan was refused and why. |
| A result the backend has confirmed is never taken back. | After a confirmed sale, let another GM scanner hand over an earlier scan of the same token. | The confirmed sale stands. |
| If the backend's computer dies, the session goes on at the GM scanners. | Stop the backend in the middle of a session. Keep scanning on two GM scanners. Start it again. | Every scan made meanwhile is in the record with the time it was made. The scores are right. |
| No spare computer is required. One can take over. | Start a second computer with the pack and the installation's settings. Let the GM scanners hand over. | The session goes on there. |
| A game that needs the backend says so in its pack. | With such a pack, stop the backend. | Every GM scanner says the session cannot go on. |
| With no connection a GM scanner cannot pause or end the session or run the room. | Turn a GM scanner's Wi-Fi off in a networked game. | Those controls show grey, with the reason. |
| A game with no backend plays by the same rules. (`0008`) | Play one scripted session with a backend and again without. | The same scores, and the same lines for the GMs' scans. |
| The installation's settings say whether there is a backend. | Open a GM scanner in an installation with none. | It starts with no choice of mode. |
| The pack says whether its game can be played without a backend. | In an installation with no backend, load a pack that needs one. | It refuses to start and names the need. |
| The GM scanner keeps the record and can save it. | Save the record at the end. Start the next session. | The saved file is whole. |
| Several GM scanners' parts are put together afterwards. | Save the records of two GM scanners that played one session with no backend. Put them together. | One session with the right totals. |
| With no backend, the GM scanner runs the clock and shows the scoreboard. A video token shows its picture and a line. | Play a session with no backend. Scan a video token on a player scanner. | The clock runs on the GM scanner. Its scoreboard shows scores and exposed evidence. The player scanner shows the picture and a line saying the video cannot be played here. |

## 4. How the engine is extended

| Decision | Do | Must happen |
|---|---|---|
| A designer designs the game's rules in the pack. (`0011`) | Play real ALN sessions again through ALN's pack, with its rules written as pack rules. | The same final scores as blue gave. (Needs session files from blue.) |
| | Run a toy pack scored another way: a deposit doubled in the last ten minutes, a steal, a bonus for one of every colour. | It plays with no change to the engine's code. |
| | Change one number in a formula. Publish. Start a session. | The new scoring applies in the backend and in a GM scanner with no backend alike. |
| | Publish a pack whose rule needs a capability the engine does not have. | Refused at publish and at start, naming the capability. |
| | Publish a pack whose rule would start a session or change a score by hand. | Refused. Those stay with staff. |
| A new capability is part of the engine. It is one file in a known place. (`0009`) | As a drill, add one new operation for formulas. | One new file. No other file of the engine's code is edited. The toy pack uses it. Every program reports the new version. |
| | As a drill, add a stand-in kind of gear. | One new file. It shows on the GM scanner's health panel and in the preflight with no change to the GM scanner's code. |
| After a restart the background comes back by itself. What was cut off is listed for the GM. (`0010`) | Restart the backend with music playing, the scoreboard on the TV, a video half-way, a cue half-way, and a clock cue falling due while it is down. | The session, the clock and the logins are back. The music goes on from where it stopped. The TV shows the scoreboard. The video and both cues are on the GM's list, each with run and drop. Nothing replays by itself. |
| | Stop only the music player by force. Then only the video player, in the middle of a video. | Each is started again. The music goes on. The video is on the GM's list. |
| A copy started for a test or a rehearsal leaves the installed backend as it was. | With the installed backend running and no session, start a second copy on the same computer, use it, stop it. | The installed backend's programs, files and screen are exactly as before. The copy used software standing in for the equipment, and never the real TV, speakers or lights. |

## 5. What the build must still do from before this pass

These were ruled before the pass. The current roadmap grouped them as
the hardening block. They are built inside the build.

| Ruling | Do | Must happen |
|---|---|---|
| A crashed program is restarted a set number of times, then the backend stops and says so. | Stop the video player by force again and again. | After the set number the backend stops trying. The GM scanner shows it red, with why and a button to restart it. |
| Gear that is not installed shows grey, never red. | Run the toy pack with lighting not installed. | Lighting shows grey with its reason. A cue that needs it is refused with that reason. |
| A session cannot start when something the pack requires is missing, unless the GM types the override. | Start a session with a required piece of gear down. | Refused, naming the piece. With the typed override it starts, and the record holds the override. |
| The preflight says what it checked and how deeply. | Run it with one video file missing. | It names the file. Every row says whether it was checked from files alone or against the running equipment. It states what only a person can check. |
| The backend's computer powers on into a running system. | (real devices) Switch green off and on. | The backend, the players and the TV come up by themselves. A GM scanner connects. The preflight is green. |
| The phone page and the hardware scanner stay equal in what they can do. | Run every row of section 2 on both. | The same result on both. |

## What is not here

- The capture (roster, notes, photos, the accusation) is part of the
  record by the owner's decision. Its tests are written when the
  capture block is designed.
- How a device is added to a kit. The owner's decision, still open.
- The redesign of the GM scanner's screens.
