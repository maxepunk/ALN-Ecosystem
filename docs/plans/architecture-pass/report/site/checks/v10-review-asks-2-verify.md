# Check of the version 10 review, lens 2 (questions G to J, the readings, the calls, the reviews, the Decisions page as a whole)

Written 2026-11-10 for the agent running the pass. The review it checks, `v10-review-asks-2.md`, is dated 2026-11-09. Read-only: nothing but this file was written.

## Scope and method

I read the owner's comments of 2026-11-02 first, then the review, then the Decisions page as published (`v10text/decisions.md`) from its first line to its last. I refuted by default. For each of the twenty findings I went to the page's own words, `report/site/v9/decisions.json`, `report/build_site.py`, the decision record, the panel's brief, the two requirements files, the glossary and today's code, and kept a finding only where I could confirm it there myself. I checked every proposed site text against the owner's rules, and every move between "the owner's question" and "the agent's call" against the page's four tests.

## Result

No finding is refuted whole. Five are confirmed as written. Fifteen are confirmed as problems, and I give a better change for each. Four sub-claims inside those are refuted and named in the table. I add eight items the review missed.

The review's main line holds. H asks the owner to choose a rule the owner already ratified. G and I ask one thing three times and leave out the fact that prices it. The page's fourth test contradicts its own first paragraph. Three of the review's changes need correcting before they are applied, because each would put a wrong or unbacked statement in front of the owner:

1. The new lead for the readings says an unconfirmed reading "stays out of the panel's folder". That is false for the reading on the show machine. It is already inside the target "The GMs know their fallbacks at a failure" and the brief.
2. The fact "a web page cannot accept connections from other devices" is too strong, and "that night needs an installed app or a small computer" follows only from the strong form.
3. The new reading on who declares a night standalone is credited to the owner's words "design and set-up of games". The words do not say it. The basis is today's behaviour and the glossary.

## Every finding

| Id | Verdict | The final change | The evidence |
|---|---|---|---|
| A2-H1 | Confirmed with a better change | Keep the two marks, with a stated rule for which mark a question gets, and say that only J is strictly needed. Text under "A2-H1" below. Do not apply item 4 (the review's sorting of A to F): it is outside this lens and gives no reasons. Give that lane the rule instead. | `intro[0]`: "answer any of them, in any order, and leave the rest for later". `intro[1]`: "And it is needed before the panel's blind round." J, `evidence[2]`: "give the panel the open questions instead, so it designs for both answers". Brief lines 113 to 115: the requirements "name the open questions". Brief line 8: the panel waits only for the brief's approval and the review. So for the nine questions the fourth test is claimed for, an unanswered one goes to the panel open, and the test is false as written. The form for an open question (no options, no recommendation) follows from the owner's own decision: withheld are "the recommendations of the agent running the pass" (record, "What the architects' panel sees, and when"). |
| A2-H2 | Confirmed with a better change | Apply as proposed: remove H's three options and the first half of its recommendation; add the call. Two edits to the call's text, under "A2-H2" below: it must not assume the answer to A2-H4, and it should say that ALN's pack marks every need "skip it". | `CONTEXT.md` lines 184 to 191 (ratified 2026-09-04) and 445 to 448 (the start is refused, with a typed override). `ALN-TokenData/pack-manifest.schema.json` lines 68 to 96: `onAbsent` is `degrade` or `require` for each service and endpoint. The target "Red means broken, grey means not installed tonight" is `settled`. The target "A standalone game is normal, never a fault" already says "every service the engine runs (video, music, lights) reads grey". The page's own list of answered conflicts calls this one settled, and H's second option says "by the same words the venue profile already uses for lights left at home". "Strict" and "Grey and go" each override one of the two marks. "At publish" is wrong unless the pack holds the declaration, which `later[0]` keeps open. |
| A2-H3 | Confirmed with a better change | Rewrite H around the table, but mark which rows are already settled and which are the agent's proposals, and ask the record as yes or no. Text under "A2-H3" below. | H's title against its `decides` and options, as quoted. `ALN-TokenData/tokens.json` holds two video tokens, and ALN has a detective mode, so "Strict" would refuse ALN. `ALNScanner/src/ui/renderers/GameAdminRenderer.js` lines 60 and 84 show only "Started:" with the time of day. Two things the review did not see. The target "A standalone game is normal, never a fault" (status: settled by the owner) already settles rows 1, 4 and 5 of its table. The target "A standalone game leaves its own record" already settles that the tablet keeps a record, so "none" is not an option where there is a GM tablet. `pack-manifest.json` lines 66 to 95: all seven of ALN's needs are `degrade`, so ALN stays playable standalone under the ratified rule. |
| A2-H4 | Confirmed with a better change | Put it to the owner as one yes or no in the readings list, with its true basis. Text under "A2-H4" below. Reword `later[0]` and the case "A game with no show machine" as the review says. | The sources disagree, as the review says. The case says "The designer declares the game standalone"; the target says "designed for a room". Today the GM picks on the tablet (`ALNScanner/CLAUDE.md`: "Mode is locked once selected") and the phone goes by its web address (`today.md` line 943). `CONTEXT.md` lines 94 to 100 call standalone "an infrastructure choice, not a gameplay choice". The case "The owner's second game needs new modules" has a pack that says it needs an engine. Refuted sub-claims: the owner's words "design and set-up of games" do not read as "the set-up says which, not the pack"; and "ALN is played both ways today" is not shown anywhere. What is shown is that ALN's one pack can be played either way. |
| A2-H5 | Confirmed with a better change | Rewrite G as the review says, with four corrections. Text under "A2-H5" below. | All four parts check against the page: three of G's five shapes are the owner's words "only gm and/or player scanners (phone or hardware)"; "required now" is defined nowhere, while I defines both words; the definition ask repeats what comment 4 sent back; the players' record is asked in G's options and again in H. Corrections. (1) The review's own `decides` and two of its options still name a mechanism ("with one of them running the engine"). (2) A small computer that runs the engine makes a networked game by the owner's decision ("run with no engine" is what standalone means), and the requirements already ask for it, so it is not a standalone shape. (3) "Every device alone, which is today's shape" is wrong for the hardware scanner: it cannot play with no engine today (`today.md` lines 943 to 947; the case says "today it cannot"). (4) "Out unless you say you need it" rules a design out before the panel has costed it, against the review's own A2-H1. |
| A2-H6 | Confirmed with a better change | Ask it once, in G. Delete I's third ask. Point B's two options to G (the other lens reached the same point as its B-4; apply once). Replace the proposed fact with the narrower one under "A2-H6" below. | The three places are as quoted (B options two and four, G option four, I's `evidence[2]`, `evidence[6]` and its ask). The GM app is a web page (`ALNScanner/CLAUDE.md`). Refuted sub-claim: "a web page cannot accept connections from other devices" is too strong. A page cannot be a server, but two browsers can be linked directly once something helps them set up the link. The hardware scanner can only call an engine's address (`arduino-cyd-player-scanner/CLAUDE.md`, the scan flow). So "that night needs an installed app or a small computer" is one architect's conclusion. It should not reach the owner as a fact, or the panel as the owner's framing. |
| A2-M1 | Confirmed with a better change | Give I a recommendation and one line from the owner, as proposed, with the text under "A2-M1" below. Do not "correct" `evidence[4]`. | The record itself says "Where the current roadmap draws that line is open, for the design rounds and the build plan", and the brief lets the architects "propose where the line falls" (lines 90 to 92). Options two and three overlap as the review says. `ALNScanner/src/app/domains/gameOps.js` lines 167, 202 and 382 all call `processNFCRead`, so NFC reads and typed codes share one entry. Refuted sub-claim: "The pack declares which kinds of device" is not a slip. The settled case "Players' own phones and two-tap actions" says "The designer declares which device kinds its players use ... in the pack", and `pack-manifest.json` holds `hardware.deviceClasses`. The roadmap's "a game's kit" includes the pack. |
| A2-M2 | Confirmed with a better change | Add the short block and the two lead sentences, with the text under "A2-M2" below. For item 4 use the one line in the review lead. Do not add a fifth reading to the call "Four readings of earlier decisions are confirmed": that changes a title and a count on three pages and in the record for no gain. | Approval of the brief appears only in J's sixth bullet and on Design (`design.md` line 145). No page says how to say "reviewed" or what silence does. Part of item 4 is already covered: the Decided entry "What the architects' panel sees, and when" says "It runs after you review the requirements, as the agent reads your ruling", and the record's history line of 2026-11-02 says the same. So the reading is disclosed, though not where the owner looks for the agent's readings. |
| A2-M3 | Confirmed with a better change | Keep the first reading. Remove the second, since A asks it. Reword the third as proposed. Replace the proposed lead with the one under "A2-M3" below. List of the places that must change with it is there too. | A's first option is "Refuse while cut off", so confirming the second reading answers half of A. The third reading as written cannot be answered yes or no. The proposed lead is false for the third reading: the target "The GMs know their fallbacks at a failure" already names "the show machine stops", and the brief (lines 115 to 120 and 133 to 136) sends that reading to the panel "marked as the agent's". The current lead, "Nothing is built on a reading until you confirm it", is false for the same reason. |
| A2-M4 | Confirmed with a better change | Replace J's third bullet and cut the clause from `decides`, as proposed, but drop the sentence "One you have not confirmed stays out". Text under "A2-M4" below. Mirror it in the brief, lines 110 to 120 and 172 to 174. | The bullet says the open questions "do not already carry" the two readings. They do: A offers "Refuse while cut off" and G lists "Player scanners alone". The owner answers the readings on this page before the panel runs, so nothing is left to choose in J. |
| A2-M5 | Confirmed with a better change | Move the settled roles from the binding list to the setting, in J and in the brief, as proposed. Do it inside J's second bullet, where the owner answers, and do not add a call. Text under "A2-M5" below. | Record lines 260 to 266: the player scanners "show token content and report scans, with no scoring and no live game feed". The settled cases ask more: "something happens between them" and "A hidden fact reaches only its owner's screen". J says each decision goes "in your own words from the decision record", so the panel would get "no live game feed" as binding. Why not a call: what the blind round gets is J, the owner's question, by the page's own reason ("adding to what the blind round gets changes a decision you made"). |
| A2-M6 | Confirmed | Delete the call. Its two halves become proposed rows of H's table. Places that change with it: H's first bullet (it links to the call); `today.md` line 967; the status text of "A standalone game leaves its own record"; the case "A game with no show machine"; the record (the 2026-11-02 line under "Standalone games: declared, never mixed", and "Still open"); the change log's row N; every count of the calls. | The call adds a view on the GM's tablet "which it lacks today", for the public to read. That changes what a GM does at a show. It is not "a default for what a screen draws". The status of "A standalone game leaves its own record" says which effects a standalone game may use, "exposed evidence and video among them", is H's question. So the call answers part of H before the owner does. |
| A2-M7 | Confirmed with a better change | Add the sentence to the call as proposed. Pull the size out as its own line, with the text under "A2-M7" below. Do not use "several hundred devices": no source has that number. | In `2026-11-01-quality-targets.json` the targets on publish to playing, the newcomer's first change, the fallbacks' delay and the scan answer time each say "a set time" or give no value. The lead says "none waits on you as a decision". The size sits in the middle of the longest line. A few dozen devices is the setting the owner approved on 2026-11-01 (record, "What the architects' panel sees, and when"), and the target's status calls the largest kit "the agent's proposal". |
| A2-M8 | Confirmed | Apply as proposed, both fields. | `2026-11-01-extension-cases.json`, the case "A game with no show machine": `throughWhat` ends "the same rules module on the tablet"; `mustNotNeed` has "a second hand-kept copy of the rules on the tablet". The Design page's alternatives row sets "One rules module loaded by the engine and the tablet" (the earlier candidate) against "Two bodies of code ... held equal by a test". A stronger reason than the review gives: the earlier candidate is withheld from the blind round by the owner's decision, and this case carries its choice into the panel's folder as a requirement. I searched both requirements files for the candidate's other part names. This is the only place. |
| A2-M9 | Confirmed with a better change | Add the answer sheet and the reading path. Merge the calls, keeping each one's reason: the owner's ruling is that each call is listed "with its reason". The answer sheet's lines must follow the final forms of G, H, I and J (J gains a third option, see A2-L4). | Word counts checked: "Open now" is 12,200 words, Requirements 30,176. Status counts checked: targets 28 settled, 13 partly settled, 2 proposed; cases 23 settled, 5 partly settled; fifteen lines in "How each number is sorted". The three default calls repeat the list's lines on restarts, the silent engine and the machine's limits. No other page links to those three calls or to the three wording calls, so merging breaks no link. |
| A2-L1 | Confirmed | Apply as proposed: "The split is made after the panel's synthesis, so you and the panel read the same ten." | The call says "when the promises are next revised, after your review". The brief gives the panel "the ten promises" (line 60). |
| A2-L2 | Confirmed with a better change | "the shared program watcher, which starts the music player, the video player and three monitors (sound routing, Bluetooth and playback)". And for the video player: "the video player uses the same watcher, set to a fixed three seconds". The same two edits in the list line for "Crashed programs restart on their own". | `backend/src/utils/processMonitor.js` lines 15 to 19 and 136 to 149: five failures, a five-second base, doubled. The page's numbers are right. `new ProcessMonitor` appears in `musicService.js:603`, `vlcMprisService.js:113`, `audioRoutingService.js:794`, `bluetoothService.js:497` and `mprisPlayerBase.js:205`. The review missed that the video player's "own" watcher is the same class with `restartDelay: 3000, backoffMultiplier: 1` (`vlcMprisService.js` lines 120 to 121). |
| A2-L3 | Confirmed | Apply as proposed. | The call's words "as long as the design rounds keep one delivery part" name a part the owner has not been shown on this page. |
| A2-L4 | Confirmed with a better change | Make it a third option in J, not a silent call. Text under "A2-L4" below. | When the panel sees the agenda is "what the panel sees, and when", which is the owner's decision and the reason J is the owner's. The brief also says nothing technical stops an architect opening a file in its folder (lines 184 to 186), so "before opening the agenda" works only if the agenda arrives in a second step. Refuted sub-claim, from the review's table: J's options are not complete. The binding decisions and the agenda are two additions, and J offers both or neither. |
| A2-L5 | Confirmed | Apply with A2-H5. | G's sixth bullet, as quoted. |

## The changed texts in full

All site text below follows the owner's rules. Field names are from `report/site/v9/decisions.json`.

### A2-H1

`intro[1]`, in place of "And it is needed before the panel's blind round.":

> And the panel's blind round is better for it. Only one answer must come before the panel can run: the last question, on what the panel gets. Every other question carries one of two marks. “Best answered now” means the answer says what the product is for, and no architect can work that out for you. “Can wait for the panel” means the answer chooses among ways to build, and the panel can bring you each way with its cost. An answer you give now binds the panel. A question you leave goes to the panel as the question alone, without the agent's options or recommendation, and comes back to you in the panel's report with the costs.

The sentence after it ("The last question, on the panel, is yours for another reason") stays.

A field `neededBy` per question, shown under the title. For this lens:

- G: "Best answered now: whether two GM tables with no show machine must be one game. The rest can wait for the panel."
- H: "Best answered now: whether a standalone night's record must hold what the players found. The table is for your review."
- I: "Can wait for the panel. One line from you helps now: any device you expect to use soon that is not in ALN's kit."
- J: "Needed before the panel."

In the brief, under "The owner's decisions that bind any design": an open question goes to the panel as its "What it decides" paragraph only. The reason is the owner's own decision that the agent's recommendations are withheld.

### A2-H2

The call, with two sentences changed from the review's text:

- `title`: "A standalone game follows the rule you ratified for missing equipment"
- `call`: "The pack already says what the show needs and how much each need matters: “block the show” or “skip it”. A standalone game has none of the services the engine runs. So the same rule applies. A need marked “skip it” reads grey, as not installed tonight. A need marked “block the show” keeps the game from starting standalone and names the need, unless the GM types the same override. In the design tool the designer sees the same result as a badge when the pack is checked against a set-up with no show machine. ALN's pack marks every one of its needs “skip it” today, so ALN stays playable standalone."
- `why`: "You ratified this rule on 2026-09-04 for equipment a venue leaves at home, and the targets “Red means broken, grey means not installed tonight” and “A standalone game is normal, never a fault” already say the grey half. A standalone game is the same case. A reading that follows from your earlier decision is the agent's call. Where the check runs when there is no engine is for the design rounds."

### A2-H3

- `decides`: "What a standalone game still does on the devices alone, and whether its record holds what the players found."
- First `evidence[]` item, the table. Check each row against the code before it is published.

| Effect | With no show machine | Status |
|---|---|---|
| Teams, scores, group bonuses, the game's start, pause and end | The GM tablet decides them | Settled, in “A standalone game is normal, never a fault” |
| Video on the TV, music, lights and sound in the room | Nothing drives the room. Each reads grey, as not installed tonight | Settled, in the same target |
| A video token on a player's device | Today the phone shows a blank screen and the hardware scanner says to rescan later | Proposed: the token's picture and a plain note, never an error |
| The game clock and its phases | Today the tablet shows only the time the game started | Proposed: a GM tablet counts the clock. A game with player scanners only has none |
| Evidence exposed in public | No TV. Today the GM sees the summary once | Proposed: a public evidence view on the GM tablet |

- One more `evidence[]` item: "For ALN. ALN's pack can be played standalone today, and it marks every need “skip it”. Under this table its video tokens show their picture and a note, and exposed evidence shows on the GM's tablet. If you marked video “block the show” in ALN's pack, ALN would refuse to start standalone unless the GM typed the override."
- `recKind`: "What we need from you". `recommendation`: "Flag any proposed row you want changed. And one yes or no: must a standalone night's record also hold what each player found on their own phone or scanner, collected after the game? The GM tablet's own record is already required. Only a yes makes a standalone night tellable the way a networked night is."

### A2-H4

New `readings[]` entry (and widen the lead's first sentence to "the agent's reading of your words or of how ALN runs today"):

- `text`: "One pack can be played networked on one night and standalone on another. The pack says only which of its effects the game cannot run without. Your words do not say who decides which way tonight's game runs: the designer, in the pack, or whoever sets up the night. Today the GM picks on the tablet at the start, and ALN's one pack plays either way. The agent reads your decision as keeping that."
- `source`: "[[dec:standalone-games-declared-never-mixed]]"

Until the owner answers, the case "A game with no show machine" should not assert either side. `who`: "whoever declares it (the owner's reading to confirm); the GMs run it ...". In `case`, "The designer declares the game standalone." becomes "The game is declared standalone."

### A2-H5

- `decides`: "Which games with no show machine the engine must run. Your words name the devices: GM scanners, player scanners (phone or hardware), or both. That is the first reading to confirm below, and this question does not ask it again. Your words do not say two things. Whether two GM tables in one such game must be one game, and when. Whether what a player finds on a phone or scanner must reach the GM's game while the game runs."
- Add to `evidence[]`, the three words, as the review has them: "In the first release: built and tested when the new engine first runs ALN. Room left: not built, and the design must not block it. Out: the design may rule it out."
- Add to `evidence[]`, "How a game reaches the devices", as the review has it. It checks against `today.md` lines 947 and 983.
- Add to `evidence[]`: "A small computer that runs the engine. If a production brings any small computer that runs the engine with no room equipment, the game is a networked game by your decision, on other hardware. The requirements already ask for that (“A whole game runs with no venue hardware”, “A different show machine or scanner hardware”). So the only new thing this question can ask for is one game across several devices with nothing but the tablets, phones and scanners themselves."
- Add the fact about tablets from A2-H6.
- `options[]`, two sets. Two GM tables: "one tablet per standalone game" (a second tablet is refused with a reason); "apart during play, one result at the end" (the records are joined at the end; a token sold at both tables is a red row for the GM; a team can be told it earned money and lose it); "one game during play". What makes "one game during play" possible: "a small computer that runs the engine is enough", or "it must work with tablets, phones and scanners alone".
- Take the players' record out of the options and point to H.
- `recKind`: "Recommendation". `recommendation`: "The first release keeps what works today: one GM tablet per standalone game, and phones that show memories alone. The hardware scanner playing with no engine is a gap to close, and the build plan says when. Room left for joining two tablets' records at the end, because it is the same work as carrying on from the tablets when the show machine fails. One game during play is met by a small computer that runs the engine, which the requirements already ask for. One game during play on tablets and phones alone is not required unless you say so, and the panel may still propose it. From you: agree, or name the night you need."

### A2-H6

The fact, for G's `evidence[]`:

> A fact about tablets. The GM app is a web page in the tablet's browser. A web page cannot be the engine that other devices connect to. Two browsers can be linked directly, but each link needs help to set up (a small server, or a code passed by hand between the two devices), and nothing in today's app does it. A hardware scanner can only call an engine. So today's GM tablet cannot be the engine for other devices.

### A2-M1

I's `recommendation`, `recKind` "Recommendation":

> The first release requires ALN's kit and is tested on it: a Raspberry Pi 5, Android tablets with built-in NFC, phones, and today's hardware scanner. That is what your decision says. The requirements already keep three things replaceable: the show machine (“A whole game runs with no venue hardware”), the hardware scanner (“A new device kind joins by its pass”) and the room's programs (“Replacing an outside program leaves the rest untouched”). The agent proposes to add the GM's station: any modern browser can be a station, and reading a token is a separate step from deciding what the scan does, so a typed code, a printed code read by the camera or a separate reader can feed the same station later. Today's GM app already takes NFC reads and typed codes through one entry. Nothing beyond ALN's kit is built or tested until the roadmap says so. From you: say no if a GM station must stay an Android tablet, and name any device you expect to use soon that is not in ALN's kit, such as iPads or laptops for GMs. The panel proposes the rest of the line, and it comes back to you as a question.

Replace the three options with this, and rewrite `evidence[6]` to match. `evidence[4]` stays.

### A2-M2

New block before "Open now":

> What the panel waits for. Three things from you, said in the chat: your answer to “What the panel gets in its blind round”; the word “reviewed” for the requirements; and your approval of the panel's brief on Design. Everything else on this page can follow in any order.

Review lead (`build_site.py`, `REVIEW_LEAD`), add: "When you have read them, say “reviewed” in the chat. The panel does not run before that. If you flag nothing, the requirements go to the panel as they stand, each with its status. Your OK of 2026-11-01 said the panel runs after you confirm the requirements. The agent reads that as after you review them."

Calls lead (`CALLS_LEAD`), add: "You do not need to answer these. If you say nothing, each stands."

### A2-M3

Readings lead (`READINGS_LEAD`), in place of the second sentence:

> Answer each with yes or no. A yes makes it your decision, and it goes to the panel in your words. A no takes it out of the requirements and the panel's brief before the panel runs. If you leave one unanswered: the reading on a game with no GM tablet stays out of the panel's folder and the question goes instead; the reading on the show machine is already in the target “The GMs know their fallbacks at a failure”, and it goes marked as the agent's reading.

`readings[2].text`, as the review has it: "“A device that goes down mid-game” includes the show machine itself, so the game must go on without it too. How it goes on is the question “The show machine fails mid-game” above."

Places that change when the second reading leaves the list: A's Sources line ("whose first reading (a tablet keeps taking scans) is listed under the readings to confirm below"); the Decided entry "No technical failure stops a game" ("Two readings follow, listed above for you to confirm"); the record's entry of the same title and its "Still open" list; J's third bullet; the brief, lines 110 to 113 and 172 to 174. A's first option needs no new note: its cost line already says it "is close to the pause you called the worst scenario".

### A2-M4

J, `evidence[2]`:

> A reading of your words that you confirm on this page goes to the panel as your decision. One you refuse is taken out before the panel runs. What happens to one you leave unanswered is said with the readings below. The sorting of the quality targets' numbers reaches the panel through the requirements, marked as the agent's call.

### A2-M5

J, `evidence[1]`: take "[[dec:the-role-question-starts-from-settled-roles]]" out of the list, and add:

> One decision is left out of that list: “The role question starts from settled roles”. It describes ALN's devices as they are today: the player scanners show a token's content and report the scan, with no scoring and no live game feed. The requirements already ask more of a player's device in other games (“Players' own phones and two-tap actions”, “The owner's second game needs new modules”). So it goes to the panel in the setting, as ALN's facts. Say so if you want it to bind every design.

### A2-M7

New first line of `review[1].numbers`:

> The size the panel designs for: shows of a few dozen devices, as ALN's, with players' phones measured on top. That is the setting you approved on 2026-11-01. The largest kit the engine supports is measured on each machine, not chosen. Say so if the design must aim at much larger shows.

### A2-L4

A third entry in J's `options[]`:

- Label: "Give your binding decisions at the start, and the six decisions ahead one step later."
- What it means: "Each architect first writes its own list of the hardest decisions to reverse, from the requirements alone. Then it gets your six and designs. The architects still design inside what you have ruled, and the report compares their lists with yours."
- What it costs: "A short first step for each architect, and one more comparison in the report."

Whether the recommendation moves to this option is for the agent to weigh. The option belongs on the page either way, because the two additions are separate.

## What the review missed (mine)

**V1, medium. J offers both additions or neither.** J's `decides` and both options treat the owner's binding decisions and the six decisions ahead as one package. They carry different risks. The decisions are the owner's own rulings. The agenda is the pass's division of the problem, and J's own cost line says it "frames the architects' thinking". The review's table marks J's options complete. The change is the third option under A2-L4.

**V2, medium. H re-asks two things the requirements mark settled.** "A standalone game is normal, never a fault" is marked settled by the owner and says the tablet decides "teams, claims, scores, evidence" and that every service reads grey. "A standalone game leaves its own record" settles that the tablet keeps a record and leaves open only "what the players found". H's `decides` lists "evidence exposed in public", "music and lights" and "no record" as if open. The change is in A2-H3: mark the settled rows, and ask the record as yes or no.

**V3, medium. A small computer that runs the engine is not a standalone game.** The owner's decision defines a standalone game as one that runs "with no engine". G's fourth shape and the review's option "a small computer runs the engine" both describe a networked game on other hardware, which "A whole game runs with no venue hardware" and "A different show machine or scanner hardware" already require. Saying so removes one of the things G seems to ask and leaves the real one: one game across several devices with only the devices themselves. The change is in A2-H5.

**V4, medium. "Nothing is built on a reading until you confirm it" is not true today.** The readings' lead says it. The target "The GMs know their fallbacks at a failure" already names the show machine stopping, with status "settled by the owner on the need", and the brief sends the same reading to the panel "marked as the agent's". The hardware scanner's standalone mode is likewise treated as answered from the owner's parenthesis "(phone or hardware)". The second is fair: the owner named the hardware, and had asked on 2026-10-31 why a standalone mode would be new. The first needs the lead under A2-M3.

**V5, low. The standalone group's introduction points to a question H does not ask.** `groups[1]` introduction: whether a mechanic declared in the pack must run on a hardware scanner alone "belongs to the second question here". H's `decides`, bullets and options never mention it. With A2-H2 applied, the answer is the ratified rule: the pack marks such a mechanic “block the show” or “skip it”. Reword the introduction's last sentence: "that part follows the rule in the agent's call “A standalone game follows the rule you ratified for missing equipment”, and how far pack rules go is the question “What a game's maker may build inside the pack” above." The other lens found the same repeat from D's side (its D-3).

**V6, low. "Before the panel's brief is built."** `review[2].what` ends "Flag any way of growing you plan that is missing, before the panel's brief is built." The brief is written and on Design. The folder is what is not yet built. Change "brief" to "folder".

**V7, low. The Decided entry for the settled roles drops four words of the record.** The page's entry says the player scanners "show token content and report scans, with no scoring". The record adds "and no live game feed". J promises the panel the record's words, so the owner approving J from this page does not see the clause that most constrains another game. Restore the clause in `decided`, whatever is done with A2-M5.

**V8, low. One accuracy edit in the review's own text for H.** "If you marked video as “block the show” in ALN's pack, ALN could no longer be started standalone" leaves out the typed override the same rule keeps. The corrected sentence is in A2-H3.

## What is right in the review

- Its facts hold where I checked them in the code: the watcher's numbers, the ten-second checks (`config.h:42`, `orchestratorIntegration.js:470`), the hundred kept scans (`config.h:64`), one entry for NFC reads and typed codes, Chrome-only tests, both builder line numbers and every `decisions.json` field it names.
- Its counts hold: the word counts, the status counts, the fifteen numbers, about 27 answers in ten questions.
- Its three main points are the ones that change what the owner decides, and each is confirmed here from sources the review did not cite as well as the ones it did.
- No change it proposes turns an agent's call into an owner's question, or the reverse, without the tests being met. The two places where it used the wrong vehicle (a call for what the panel gets, in A2-M5 and A2-L4) are corrected above.
