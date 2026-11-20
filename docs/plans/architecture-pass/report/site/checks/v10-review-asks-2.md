# Version 10 review, lens 2: questions G to J, the readings, the calls, the reviews, and the Decisions page as the owner meets it

Written 2026-11-09 for the agent running the pass. Read-only review of the site as published at commit e1004d6b.

## Scope

I read the owner's comments of 2026-11-02 first, then the Decisions page as published (`v10text/decisions.md`), its source (`report/site/v9/decisions.json`, `report/build_site.py`), the decision record, the panel's brief, the two requirements files, the review of standalone games on "Today's engine", the glossary and today's code where G to J and the calls state facts. My lens is questions G, H, I and J, the three readings to confirm, the fourteen calls, the four review items, and the page as a whole. Questions A to F belong to other reviewers. I mention them only where the page's structure or a duplicated ask touches them.

## Verdict

The sorting of version 9's eighteen questions was right, and J is a real question with a sound recommendation. G, H and I are not yet clearly defined. Each mixes one or two things only the owner can say with things the owner has already said, or with build mechanisms the panel exists to weigh. H asks the owner to choose a rule the owner ratified on 2026-09-04. G and I ask the same thing ("may a device other than the show machine run the engine") that B also asks, and none of the three tells the owner that a tablet's browser cannot do it. One product fact the panel needs is missing from the page: who declares a night standalone, and whether one pack plays both ways, as ALN does today. The page also contradicts itself on its own fourth test. It says every question is needed before the panel, tells the owner any can wait, and the brief says the panel gets the open questions. Fix that one rule and the owner's load drops from about 27 answers to about 12, which fits one sitting for the questions and one for the requirements.

## Findings

Field names are from `report/site/v9/decisions.json` unless I say otherwise. `groups[1]` is "Standalone games" (G, H), `groups[2]` is "Hardware" (I), `groups[3]` is "The panel" (J). All proposed site text follows the owner's rules.

### High

#### A2-H1. The page says every question must be answered before the panel, and also that any can wait

Where. Decisions, the page's second paragraph (`intro[1]`): "And it is needed before the panel's blind round." The first paragraph (`intro[0]`): "answer any of them, in any order, and leave the rest for later." J, third bullet: "to give the panel the open questions instead, so it designs for both answers."

What is wrong. The owner cannot tell what an unanswered question does. Either the panel waits for all ten, or it runs with some open. The brief says the second (`panel/2026-11-01-panel-brief.md` lines 113 to 115: "The requirements the panel gets state only what the owner settled and name the open questions"). So test 4 is false as written for most questions. There is a second cost. Where the owner answers from the agent's option list, the agent's design framing reaches the panel as the owner's binding decision. The owner set the panel up so that it had "not seen the reasoning of the agent running the pass" (record, "Independent architects propose the top-level design"). An answer such as "keep and label" or "per-effect marks" is a design mechanism chosen before the independent architects have costed anything.

Why it matters to the owner. On the first open question the owner wrote: "I would need to understand the specific conflicts and what they mean functionally in order to be able to answer optimally." The panel's synthesis is the document that prices the options ("the options the panel found, their costs ... and the questions only the owner can answer", brief lines 162 to 165). For the mechanism-heavy questions the better-informed moment to answer is after it.

Change.
1. Replace the sentence in `intro[1]` with: "And the panel's blind round needs it, in one of two ways. Some answers say what the product is for, and the panel cannot start without them. Those questions are marked “Needed before the panel”. The others are marked “Can go to the panel open”. If you leave one of those unanswered, the panel gets the question with no options and no recommendation from the agent, designs for each answer, and brings you the costs. You then answer with the costs in view."
2. Add a field per question, for example `neededBy`, rendered under the title. For my four: G "Needed before the panel: whether two GM tables must be one game. The rest can go to the panel open." H "Can go to the panel open." I "Can go to the panel open. One line from you helps: any device you expect to use soon that is not in ALN's kit." J "Needed before the panel."
3. In the brief, under "The owner's decisions that bind any design", say the form: an open question goes to the panel as its "What it decides" paragraph only.
4. The other reviewers should mark A to F the same way. From the page's own text, A, B, C, D and F read as "can go open" with the owner's stated lean attached, and E's yes or no reads as needed.

#### A2-H2. H asks the owner to choose a rule the owner ratified on 2026-09-04, and the recommendation puts the refusal in the wrong place

Where. Decisions, H, the options "Strict", "Grey and go", "Per-effect marks", and the recommendation: "Per-effect marks by the designer, skip-it or block-the-show, with block-the-show refusing at publish and naming the effect."

What is wrong. The rule exists. `CONTEXT.md` lines 185 to 191, ratified 2026-09-04: "the pack declares what the show needs and how much each need matters (`onAbsent: require` = "block the show" / `degrade` = "skip it"); a profile declares what an environment has; one pure `resolve(needs, has)` produces per-need VERDICTS, and every surface ... quotes those verdicts". Lines 445 to 448: an unmet required need "refuses `session:start`, with a typed, logged "start anyway" override". The quality target "Red means broken, grey means not installed tonight" is marked settled on that ruling. A standalone night is an environment that has no engine-run service. So "Strict" and "Grey and go" are both outside a ratified rule, and the third option is the rule itself. This half of H fails the page's second test. By the page's own sorting it is "a reading that follows from the owner's earlier decisions", an agent's call.

The recommendation also says the refusal happens "at publish". Under the ratified rule a pack is checked against a named environment, and the refusal is a badge in the editor, a preflight row and the start gate. A pack does not know at publish which night it will meet, unless the pack itself carries the standalone declaration, which the page keeps open as a later choice ("Where “this game is standalone” is declared: the venue profile ..., the pack, the game's record or each device").

Change. Remove the three options and the first half of the recommendation from H (`groups[1].questions[1].options`, `.recommendation`). Add a call to `calls[]`:

- `title`: "A standalone game follows the rule you ratified for missing equipment"
- `call`: "The pack already says what the show needs and how much each need matters: “block the show” or “skip it”. A standalone night is a night whose set-up has none of the services the engine runs. So the same rule applies. A need marked “skip it” reads grey, as not installed tonight. A need marked “block the show” keeps the game from starting standalone and names the need, with the same typed override. In the design tool the designer sees the same verdict as a badge when the pack is checked against a standalone set-up."
- `why`: "You ratified this rule on 2026-09-04 for equipment a venue leaves at home. A standalone night is the same case. A reading that follows from your earlier decision is the agent's call. Where the check runs when there is no engine is for the design rounds."

#### A2-H3. H never asks what its title says, and does not say what its options do to ALN

Where. Decisions, H, title "What a standalone game gives up, and what it keeps"; "What it decides": "Which of a pack's effects a game declared standalone may use, and what happens to the rest"; the Strict option's cost: "The pack lists which effects need an engine (video, public screens, the clock, cues on equipment, hidden facts)".

What is wrong. The question treats "engine-only" as a fixed list and asks only how to refuse. Which effects a standalone game must still carry on the devices alone is the product fact, and it is not asked. The list is not fixed. A GM tablet can count a game clock; the page's own evidence says only that today's tablet "shows wall-clock time". A tablet can show exposed evidence, which the call "Exposed evidence and video with no engine" quietly adds. So one row of the answer sits in a call, the rest is assumed, and the owner is asked about the refusal mechanism instead.

The owner also runs ALN both ways today (root `CLAUDE.md`, component table: the GM scanner supports standalone by "User selection"). ALN's pack has video tokens and exposed evidence. Under "Strict", ALN could not be played standalone at all. The option says "some games cannot be standalone at all" and does not say that the first of them is the owner's own.

Change. Rewrite H around a table the owner can flag, and keep the one ask that is a values call.

- `decides`: "What a standalone game still does on the devices alone, and whether it leaves a record of what the players found."
- New first `evidence[]` item, a table (each row checked against the code before it is published):

| Effect | With no show machine | Proposed |
|---|---|---|
| Teams, scores, group bonuses, the game's start, pause and end | The GM tablet decides them today | Kept |
| The game clock and its phases | A tablet can count the time. Today's tablet shows the time of day instead | Kept on a GM tablet. Absent when a game has player scanners only |
| Evidence exposed in public | No TV. Today the GM sees the summary once | A public evidence view on the GM tablet |
| Video on the TV | Nothing drives a TV | Gone. The token shows its picture and a plain note, never an error |
| Music, lights and sound in the room | Nothing drives the room | Gone, grey, as not installed tonight |

- Add one `evidence[]` item: "For ALN. You can play ALN standalone today. Under this table its video tokens show their picture and a note, and exposed evidence shows on the GM's tablet. If you marked video as “block the show” in ALN's pack, ALN could no longer be started standalone."
- `recKind`: "What we need from you". `recommendation`: "Flag any row you want changed. And say which record a standalone night must leave: none; what the teams turned in at the GM tablet, which is the first step; or that and what each player's device kept, collected after the game. Only the last makes a standalone night tellable the way a networked night is."

#### A2-H4. Missing from the page: who declares a night standalone, and whether one pack plays both ways

Where. Decisions, "Later choices", first item: "Where “this game is standalone” is declared: the venue profile (the earlier candidate favours it), the pack, the game's record or each device." The extension case "A game with no show machine": "The designer declares the game standalone."

What is wrong. Where the fact is held is a design choice. Who declares it, and when, is a product fact, and the sources disagree. The case says the designer. Today the GM picks it at the start of the night on the tablet, and the phone takes it from the web address. The owner's words are "design and set-up of games", which names both moments. The answer decides whether a pack is standalone by nature or one pack can be played networked at the home venue and standalone elsewhere, which ALN does today. It changes the pack format, H's rule, and the first design round on authority. It passes all four tests and it is on the page only as a storage detail.

Change. Put it to the owner as a reading to confirm, because the owner's words and today's use both point one way. New `readings[]` entry:

- `text`: "One pack can be played networked on one night and standalone on another. The set-up for the night says which, not the pack. ALN is played both ways today: the GM picks at the start. The pack only says which of its effects a game cannot run without. Your words “design and set-up of games” read this way."
- `source`: "[[dec:standalone-games-declared-never-mixed]]"

Then reword `later[0]` to start: "Where the night's set-up holds “this game is standalone”", and change the case's `who` in `2026-11-01-extension-cases.json` (EX12) from "Designer declares it" to wording that waits on the reading.

#### A2-H5. G mixes outcomes with build mechanisms, re-asks what the owner's words settle, and leaves "now" undefined

Where. Decisions, G, "What we need from you": "For each shape, whether it is required now, allowed later, or never; and whether “standalone” means no show machine or no network."

What is wrong, in four parts.

1. Three of the five shapes are the owner's own words. "only gm and/or player scanners (phone or hardware)" names GM tablets alone, player scanners alone, and both. The page lists that as the first reading to confirm and then asks it again here, shape by shape. One confirm should carry all three.
2. The other two shapes are mechanisms. "One GM tablet as the engine for other devices over a small network" and "accepted as separate games merged afterwards under the conflict rule" say how to build something. The page's first test says a question is "never about how to build it". The outcomes behind them are the owner's: must two GM tables be one game, and may the devices talk to each other when a small network exists.
3. "Whether “standalone” means no show machine or no network" is the kind of abstract distinction the owner sent back once already. Comment 4: "I don't understand the distinction between the two scenarios you presented." The owner's words answer it as far as words can: a standalone game uses only scanners, and the missing network is one of two reasons for it.
4. "Required now" has no meaning on the page. Now could be the first release or the design. Question I draws that line in its own words ("a fixed requirement of the first release" against "a thing the engine's design must allow replacing later"). G does not.

The record of what players found is also asked twice: in G's second and third options ("A collection step, or no record") and in H ("no record ... a record from the GM tablet only ... or a record collected from every device afterwards").

Change. Rewrite `groups[1].questions[0]`.

- `decides`: "Which nights with no show machine the engine must be able to run. Your words name the devices: GM scanners, player scanners (phone or hardware), or both. That is the first reading to confirm below, and this question does not ask it again. Two things your words do not say. Whether two GM tables in one standalone game must be one game. Whether the devices in a standalone game may talk to each other when a small network exists, with one of them running the engine."
- Add to `evidence[]`: "What the words mean here. In the first release: built and tested when the new engine first runs ALN. Room left: not built, and the design must not block it. Out: the design may rule it out."
- Add to `evidence[]`: "How a game reaches the devices. Today a phone loads the standalone page from the public website, which needs the internet once. A hardware scanner gets its token list, pictures and sounds from the engine. With no engine, someone loads each scanner's card by hand, and nothing does that today." (Source: the standalone table on "Today's engine", rows "Needs internet" and "Token list source".)
- `options[]`, six labels in two sets: "Two GM tables: one tablet per standalone game" (a second tablet is refused with a reason; a production with two tables runs two games). "Two GM tables: apart during play, one result at the end" (each tablet takes its own scans; at the end the records are joined, and a token sold at both tables is a red row for the GM; a team can be told it earned money and lose it at the end). "Two GM tables: one game during play" (needs the small network below). "A small network: none, every device works alone". "A small network: a small computer runs the engine" (see A2-H6). "A small network: the GM's tablet runs the engine" (see A2-H6).
- Remove the sentences on the players' record from the options, and point to H.
- `recKind`: "Recommendation". `recommendation`: "In the first release, one tablet per standalone game and every device alone, which is today's shape with the game declared. Room left for joining two tablets' records at the end, because it is the same work as the first fallback under “The show machine fails mid-game”. Room left for a small computer that runs the engine with no room equipment, because the engine must already run on a laptop. The GM's tablet running the engine itself is out unless you say you need it, because it is a second program to build and keep for years. From you: agree, or name the night you need sooner." The agent should check this against its own view before publishing it. It is the reading the page's own evidence supports.

#### A2-H6. "A device other than the show machine runs the engine" is asked three times, and its deciding fact is missing

Where. B, second option: "A second show machine, or a tablet running an engine of its own"; fourth option: "in effect a small engine on the tablet". G, fourth option: "One GM tablet as the engine for other devices over a small network ... An engine that runs where a tablet runs, or a small computer in the GM's bag." I, "What we need from you": "whether a GM's device must be able to run the engine." I, "At a show": "That is a large simplification of the standalone questions, if you want it."

What is wrong. One product question is split across three places, with the most useful remark about it buried in I. And no place states the fact that decides the cost. The GM app is a web page in the tablet's browser (`ALNScanner/CLAUDE.md`, "ES6 module PWA"). A web page cannot accept connections from other devices. So "a GM tablet as the engine" does not mean today's tablet doing more. It means an installed app on the tablet, a second program to build and keep, or a small computer that runs the engine. The second is close to a requirement already: "A whole game runs with no venue hardware" asks the engine to run a whole game on a laptop with stand-ins. G's cost line, "A second platform the engine must run on", hides the difference between the two.

Change. Ask it once, in G, as the "small network" set above. Add to G's `evidence[]`: "A fact about tablets. The GM app is a web page in the tablet's browser, and a web page cannot accept connections from other devices. So a GM tablet cannot be the engine for other devices as it stands. That night needs an installed app on the tablet, which is a second program to build and keep, or a small computer in the GM's bag that runs the engine with no room equipment. The requirement “A whole game runs with no venue hardware” already asks the engine to run on a laptop." In I, delete the third ask and move the "large simplification" sentence to G. In B's second and fourth options, replace "a tablet running an engine of its own" and "a small engine on the tablet" with a pointer: "see “Which standalone games the engine must run” for what a tablet can and cannot run".

### Medium

#### A2-M1. I re-asks the decision of 2026-11-02, gives no recommendation, and its options cover one device class

Where. Decisions, I, "What we need from you": "Whether the first release's fixed list is ALN's kit as it stands; whether the GM's station must be allowed, now, to be something other than an Android tablet reading NFC itself, and if so which of the three shapes above".

What is wrong. The owner answered the first two on 2026-11-02: "The hardware is fixed only insofar as I have the hardware I have on which I am running ALN ... we should build the fundamental architecture to allow flexibility with the hardware down the line." The group's own introduction quotes it. The owner then said "we need to set realistic boundaries", which asks the agent for a proposed line, and the owner's standing request is to investigate and cite before asking. The page proposes none ("What we need from you" in place of a recommendation). Test 4 is weak too: the brief already tells the architects they "may propose where the line falls". The title promises every class of hardware and the options cover only the GM's station. Options two and three are not distinct: both are "any browser", and the iPad with a camera reading printed codes appears under option two though it is option three's content.

The agent has grounds for a view. In today's GM app an NFC read and a typed code already enter through one function (`ALNScanner/src/app/domains/gameOps.js` lines 167, 202 and 382 all call `processNFCRead`). The seam between reading a token and deciding the scan is cheap.

Change. `recKind`: "Recommendation". Replace the three options with the recommendation and one line from the owner:

"The first release requires ALN's kit and is tested on it: a Raspberry Pi 5, Android tablets with built-in NFC, phones, and today's hardware scanner. That is what your decision says. The design keeps three things replaceable from the start, at little cost. The show machine is any Linux computer, which the requirement “A whole game runs with no venue hardware” already asks. The GM's station is any modern browser. And reading a token is a separate step from deciding what the scan does, so a typed code, a printed code read by the camera or a separate reader can feed the same station later. Today's GM app already takes NFC reads and typed codes through one entry. Nothing beyond ALN's kit is built or tested until the roadmap says so. From you: name any device you expect to use soon that is not in ALN's kit, such as iPads or laptops for GMs. The panel proposes the rest of the line, and it comes back to you as a question."

Rewrite I's seventh bullet (`evidence[6]`, "What you must say now, and what the design rounds should propose") to match, and delete its third ask (A2-H6). Also correct I's fifth bullet (`evidence[4]`). It says "The pack declares which kinds of device its players use". The standing rule says "A game's kit declares which kinds of device its players use and what part each plays".

#### A2-M2. Two acts the panel waits for are not asks, and nothing says what silence means

Where. Decisions, J, sixth bullet: "The panel runs only after you approve its brief and have reviewed the requirements." Decisions, "The requirements, for your review": "Flag in the chat anything wrong or missing." (`build_site.py` line 1726). The calls' lead: "Each stands unless you overrule it" (line 1723).

What is wrong. Approving the brief is a required act of the owner's (record, "Independent architects propose the top-level design": "its brief comes to the owner before the panel runs"). It appears only inside a bullet of J and on Design. "Reviewed" has no signal: the owner cannot tell how to say it, or what happens if they flag nothing. The swap from "confirms the requirements" to "reviews" is itself the agent's reading (record, "What the architects' panel sees, and when", history 2026-11-02) and is listed under neither the readings nor the calls.

Change.
1. A new short block before "Open now", for example `intro[4]`: "What the panel waits for. Three things from you, said in the chat: your answers to the questions marked “Needed before the panel”; the word “reviewed” for the requirements; and your approval of the panel's brief on Design. Everything else on this page can follow in any order."
2. Review lead (line 1726), add: "When you have read them, say “reviewed” in the chat. The panel does not run before that. If you flag nothing, the requirements go to the panel as they stand, each with its status."
3. Calls lead (line 1723), add: "You do not need to answer these. If you say nothing, each stands."
4. Add the "reviews, not confirms" reading to the call "Four readings of earlier decisions are confirmed" as a fifth, or as one line in the review lead: "Your OK of 2026-11-01 said the panel runs after you confirm the requirements. The agent reads that as after you review them."

#### A2-M3. Of the three readings, one stands, one is question A, and one is not a reading

Where. Decisions, "Readings of your words, to confirm" (`readings[0..2]`).

- First, "A standalone game may have no GM tablet at all". Fair, close to literal ("gm and/or player scanners"), clearly stated. It duplicates G's second shape as G stands. With A2-H5 it becomes the one place the device shapes are confirmed. Keep.
- Second, "A GM tablet that loses the engine keeps taking scans". The owner's words are that pausing is the worst case and that "the GMs need to know their available fallbacks". Keeping scans on the cut-off tablet is one fallback. Question A lists the other ("Refuse while cut off") as an option. So confirming this reading answers half of A, and the owner is asked the same thing in two places. It is a question in disguise, and A already asks it. Remove it from `readings[]`. In A, mark the first option: "Listed so you can see it. Your words on a paused game point away from it."
- Third, "The design must say how a networked game carries on if the show machine itself fails". Nothing here can be confirmed or refused; it is a task for the design. The reading inside it is that "a device that goes down" includes the show machine. Reword `readings[2].text`: "“A device that goes down mid-game” includes the show machine itself, so the game must go on without it too. How it goes on is the question “The show machine fails mid-game” above."

Add to the readings' lead (`build_site.py` line 1721): "Answer each with yes or no. A reading you confirm becomes your decision and goes to the panel in your words. A reading you have not confirmed stays out of the panel's folder, and the panel gets the question open."

One reading is treated as decided and I think that is fair: the hardware scanner "plays standalone games as the phone's scanner does", from "player scanners (phone or hardware)". The owner named the hardware. Its cost belongs in G (A2-H5, the line on loading each scanner's card).

#### A2-M4. J's clause on withheld readings contradicts the page and asks nothing real

Where. Decisions, J, third bullet: "to withhold, either way, two of its readings of your words that the record marks to be confirmed and that the open questions do not already carry (that a tablet keeps taking scans while cut off; that a standalone game may have no GM tablet) ... Say so if you want the readings given."

What is wrong. The open questions do carry both: A offers "Refuse while cut off", and G lists "Player scanners alone". And the ask is empty in practice. The owner confirms or refuses the readings on this same page, before the panel runs. A confirmed reading is the owner's decision and should reach the panel. An unconfirmed one should not. There is nothing left to choose.

Change. Replace the bullet (`groups[3].questions[0].evidence[2]`) with: "A reading of your words that you confirm on this page goes to the panel as your decision. One you have not confirmed stays out, and the panel gets the question open. The sorting of the quality targets' numbers reaches the panel through the requirements, marked as the agent's call." Remove "and whether the agent's readings of your words that the record marks to be confirmed are kept from it, as the agent proposes" from `decides`. Mirror both in the brief (lines 110 to 119).

#### A2-M5. J's list of binding decisions holds the settled roles, which the requirements already go beyond

Where. Decisions, J, second bullet: "The decisions that bind any design: ... [The role question starts from settled roles]".

What is wrong. That decision says the player scanners "show token content and report scans, with no scoring and no live game feed" (record, lines 260 to 266). It was made on 2026-10-30 as the starting point of one question about ALN's components. The requirements the panel also gets ask for more from a player's device: "Players' own phones and two-tap actions" ("something happens between them") and "The owner's second game needs new modules" ("A hidden fact reaches only its owner's screen"). Handed to a blind panel as binding on any design, the roles decision contradicts those cases. After 2026-11-02 the hardware went to the panel as ALN's facts and no longer as the engine's requirements. The roles look like the same kind of thing.

Change. This is a reading of an earlier decision, so by the page's rule it is the agent's call, told to the owner. Move the roles from the binding list to the setting, in both J and the brief: "ALN's devices have settled roles today: the player scanners show a token's content and report the scan; the GM tablet is the command center; the scoreboards show the public results. Another game may give a player's device more to do, as the extension cases say." Add a short call to `calls[]` that says so, so the owner can overrule it.

#### A2-M6. The call "Exposed evidence and video with no engine" is product behaviour, and it answers part of H before the owner does

Where. Decisions, the calls: "In a standalone game, the GM tablet gets a public evidence view of its own for exposed evidence, which it lacks today". Its reason: "A default for what a screen draws."

What is wrong. A new view on the GM's tablet that the public is meant to see changes what a GM does at a show. That is what the product does, the first test. It is not a technical default like a retry count. It also settles one row of "what a standalone game keeps" while H asks the rule above it. It is cheap to reverse and no decision ahead waits on it, so it fails tests 3 and 4 and should not be a lettered question either.

Change. Delete the call. Its two halves become rows of H's table (A2-H3), marked as proposed, where the owner can flag them with the rest.

#### A2-M7. Several engine requirements have no value and nobody named to set one, and the size the engine is designed for sits inside one long line

Where. Decisions, "How each number is sorted": "the minutes from publish to playing. An engine requirement"; "how long a newcomer may need ... An engine requirement"; "how long after a failure every GM tablet must show the fallbacks. An engine requirement"; "the engine states the largest kit it supports ... and the agent proposes a few dozen devices, from ALN's show". The lead: "none waits on you as a decision."

What is wrong. The call's reason is "A limit the engine is sized for is measured, not decided." That holds for a limit. A requirement is a target someone sets, and for four of them (publish to playing, the newcomer's first change, the fallbacks' delay, the scan answer time) the page gives no value and does not say who sets it or when. The owner reads "none waits on you" and cannot tell whether a number will arrive later as a question. Separately, since 2026-11-02 "a few dozen devices" reaches the panel only as ALN's fact. The size the engine itself is designed for is now the agent's proposal, stated once, in the middle of the longest line of the list. It is the one number in the list that bounds who can adopt the engine.

Change. In the call "The quality targets' numbers are sorted, not asked", add to `call`: "Where an engine requirement has no value yet, the agent proposes one in the design round that builds it, with the measurement behind it, and it comes to you in that round's review." Pull the size out as its own line at the top of `review[1].numbers`: "The size the engine is designed for: shows of a few dozen devices, with players' phones measured on top. The agent proposes it from ALN's show. A show of several hundred devices is outside what this design is tested for. Say so if you want it larger."

#### A2-M8. The case "A game with no show machine" fixes a choice the page lists as still open

Where. Requirements, "A game with no show machine" (`2026-11-01-extension-cases.json`, EX12): "Goes through ... the same rules module on the tablet." "Must not need ... a second hand-kept copy of the rules on the tablet". Decisions, "Later choices": "The game rules as one shared body of code that the engine and the tablet both run, or two bodies kept equal by tests."

What is wrong. The case goes to the blind panel as a requirement and rules out the second of two designs the page says the design rounds will weigh. It also assumes a tablet, which the first reading (player scanners alone) does not.

Change. EX12 `throughWhat`: "... read by every device; a device that decides anything reaches the same verdicts the engine would, and a test proves it." EX12 `mustNotNeed`: drop "a second hand-kept copy of the rules on the tablet", or replace it with "rules on a device that no test compares with the engine's". The same phrase in the quality target "A standalone game is normal, never a fault" ("under the same rules as the engine, and a test proves the two equal") is fine as it stands.

#### A2-M9. The page cannot be worked through in two sittings as built. An answer sheet and three merges would make it possible

The load today. The ten questions hold about 27 separate answers: A 2, B 3 or 4, C 3, D 2, E 1, F 1, G 6, H 2, I 4, J 2 or 3. Then three readings, fourteen calls and four reviews. "Open now" is about 12,200 words, close to an hour of reading with no thinking time. Requirements is about 30,000 words.

What would make two sittings possible.
1. The marks from A2-H1. With the changes above, G to J need about six answers, and four of those are "agree or say otherwise".
2. An answer sheet at the end of "Open now" (a new `answerSheet` list, one line per question, the exact form of each answer). For my four: "G. Two GM tables: one per game, joined at the end, or one game during play. A small network: none, a small computer, or the tablet. Or: agree with the recommendation." "H. Any row of the table you want changed. The record: none, GM tablet only, or collected from every device." "I. Agree, or name a device." "J. Give the panel your decisions and the agenda: yes or no."
3. A reading path for the requirements, in `review[1].what`: "Twenty-eight of the forty-three targets rest on rulings you have already made. Fifteen are proposed or partly settled, and fifteen carry a number. Read those first; the rest are there if you want them." (Counts from `statusKind` in `2026-11-01-quality-targets.json`: 28 settled, 13 partly settled, 2 proposed.) The same for the cases: 23 settled, 5 partly settled.
4. Merge what is said twice. The calls "The program watcher's retries", "How long before a screen says the engine is silent" and "The show machine's limits" repeat three lines of "How each number is sorted". Keep them in the list only. The three wording calls ("The venue promise stays one", "Proof and release stay one promise", "The route for equipment state is named in neither promise") can be one call, "Three choices about how the promises are worded", with one sentence each. Fourteen calls become about nine.

### Low

#### A2-L1. The tap promise's split has no clear moment

Where. Call "The tap promise is to be split in two": "when the promises are next revised, after your review; until then ... the count of ten stands." The brief gives the panel "the ten promises". If the split lands between the owner's review and the panel, the panel reads eleven promises the owner reviewed as ten. Say which: "The split is made after the panel's synthesis, so you and the panel read the same ten."

#### A2-L2. The watcher's description is narrower than the code

Where. Call "The program watcher's retries": "the shared program watcher, which the music player uses". The same watcher also runs the audio routing monitor, the Bluetooth monitor and the players' playback monitor (`audioRoutingService.js:794`, `bluetoothService.js:497`, `mprisPlayerBase.js:205`). The numbers are right (`processMonitor.js` lines 17 to 19 and 141 to 149: five failures, a five-second base, doubling; `vlcMprisService.js` lines 120 to 121: a fixed three seconds). Suggested: "the shared program watcher, which the music player and the sound and Bluetooth monitors use".

#### A2-L3. The call on the route for equipment state is hard to read

Where. Call "The route for equipment state is named in neither promise": "as long as the design rounds keep one delivery part". The owner cannot overrule what they cannot picture. If it survives the merge in A2-M9, one plain sentence serves: "Neither promise says how the state of the video, music and lights reaches a screen. That is for the design rounds."

#### A2-L4. A cheap guard for the cost J's recommended option names

Where. J, first option, cost: "The agenda frames the architects' thinking; they are told they may change it if they say why." This is the agent's call on how the panel runs. In the brief, have each architect write their own list of the hardest decisions to reverse from the requirements alone, before opening the agenda. The synthesis then compares the lists. It costs a paragraph per architect and tests the agenda instead of trusting it.

#### A2-L5. G's link to B is stated as the agent's aside

Where. G, sixth bullet: "A link the agent notes, which you have not stated". With A2-H5 the link becomes part of the recommendation's reason and the aside can go.

## A verdict for every item in the lens

Questions.

| Item | The owner's by the four tests | Clearly defined | Options complete and distinct | Recommendation or ask | Facts | Meets comments 4 to 7 |
|---|---|---|---|---|---|---|
| G | In part. Devices are in the owner's words; two outcomes are open; two "shapes" are mechanisms | No. "Now" undefined; an abstract definition question | No. A checklist of five, two of them mechanisms | Six answers asked; a recommendation is possible | True where checked. Missing: a browser cannot serve other devices; phones need the internet once | Comment 4: the introduction does; the last ask repeats the mistake the comment corrected |
| H | In part. The refusal rule was ratified 2026-09-04; the record of players' finds and the list of kept effects are the owner's | No. The title's question is not asked | The three options re-open a settled rule | Recommendation picks the ratified rule and misplaces the refusal | True where checked | Comment 4: yes |
| I | Mostly answered by the decision of 2026-11-02; weak on test 4 | Partly. Title is wider than the options | Options two and three overlap; only one class covered | No recommendation where one is possible | True (no Web NFC outside Chrome on Android; typed entry exists; tests run Chrome only). One slip: "The pack declares" | Comment 5: quotes it, then asks the owner to draw the line the owner asked us to draw together. Comment 7: yes |
| J | Yes, for the reason the page gives | Yes for the main ask | Yes | Sound. Drop the clause on readings; move the roles; say the form of open questions | True against the record and the brief | Not applicable |

Readings.

| Reading | Verdict |
|---|---|
| A standalone game may have no GM tablet | Fair and clear. Keep; let it carry all three device shapes |
| A cut-off tablet keeps taking scans | A choice among fallbacks, already asked as question A. Remove from the readings |
| The design must say how a game carries on if the show machine fails | Not a reading. Reword to "a device that goes down includes the show machine" |
| Missing | One pack plays both ways and the night's set-up declares it (A2-H4). "Reviews" for "confirms" (A2-M2) |

Calls.

| Call | The agent's to make? | Reason and content |
|---|---|---|
| Four readings of earlier decisions are confirmed | Yes. Each follows from a later decision on the order of the work | Sound. Add the fifth (A2-M2) |
| The quality targets' numbers are sorted, not asked | Yes to propose. It is a reading of comment 7, shown with every sort for the owner to overrule | Sorts are reasonable. Values and the design size need a line (A2-M7) |
| The program watcher's retries | Yes, a technical default | Numbers verified. Merge into the list (A2-M9); A2-L2 |
| How long before a screen says the engine is silent | Yes, a technical default | Ten seconds verified (`config.h:42`, `orchestratorIntegration.js:470`). Merge into the list |
| The show machine's limits | Yes | Sound. Merge into the list |
| The missing standalone declaration is a design flaw of its own | Yes, analysis | Sound |
| The tap promise is to be split in two | Yes, wording and grouping | Sound. Fix the moment (A2-L1) |
| The venue promise stays one | Yes | Sound |
| Proof and release stay one promise | Yes | Sound |
| The route for equipment state is named in neither promise | Yes | Sound, hard to read (A2-L3) |
| Exposed evidence and video with no engine | No. Product behaviour, first test; not needed before the panel | Move into H's table (A2-M6) |
| Every refused GM scan attempt is recorded | Yes. The owner asked for the agent's view | Sound |
| The panel's three lenses | Yes, how the panel runs | Sound |
| The second round reads today's code | Yes, method | Sound. The checker for traces of withheld material is the right guard |
| Missing | A standalone game follows the ratified rule for missing equipment (A2-H2). The settled roles go to the panel as ALN's facts (A2-M5) | |

Reviews.

| Item | Clear what to do | If nothing is flagged |
|---|---|---|
| The ten promises | Yes | Not stated (A2-M2) |
| The quality targets | Too broad. Point to the fifteen not fully settled and the fifteen numbers (A2-M9) | Not stated |
| How each number is sorted | Yes. Values and the design size missing (A2-M7) | Stands, as a call |
| The extension cases | Yes, the ask is specific ("any way of growing you plan that is missing") | Not stated. EX12 needs the change in A2-M8 |
| The standing rules | Yes ("flag any you no longer hold") | Not stated |

## What is right

- The page's four tests are the right tests, and the sorting of version 9's eighteen questions into questions, calls and reviews holds up. I would overrule one call of fourteen.
- J is a real question, gives the true reason it is the owner's, and recommends the right answer.
- The "What it means in practice" bullets explain by what happens at a show, for the GM, the designer and an adopter. The tent with one GM and twenty phones in G is the best paragraph in my four questions.
- The facts I checked in the code are true: the watcher's retry numbers, the ten-second checks on both player scanners, the hundred kept scans on each, the tablet's scoreboard limited to ranking modes, typed entry on the GM app, Chrome-only tests.
- The standalone group's introduction states the owner's comment 4 in the owner's words and drops the "fallback or line of shows" framing the owner rejected.
- The record keeps the owner's tentative wording on the two kinds of extension, and the page says so.
- The brief's rule that architects answer for each kind of failure mid-show follows the owner's comment 2 directly.

## Summary

Twenty findings: six high, nine medium, five low. The three that change what the owner decides are these. Say which questions the panel cannot start without and let the rest go to it open (A2-H1). Take the refusal rule out of H, because the owner ratified it on 2026-09-04, and ask H what its title says (A2-H2, A2-H3). Ask once, with the fact about browsers, whether anything but the show machine may run the engine (A2-H6), and add the missing reading on who declares a night standalone (A2-H4).
