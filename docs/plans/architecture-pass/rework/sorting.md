# Sorting version 9's questions, numbers and readings

Written 2026-11-02 for the rework of the Decisions page, under the
owner's ruling [[dec:the-decisions-page-holds-only-your-decisions]]:
"The Decisions page asks the owner only what the owner alone can
decide". It sorts three things: the eighteen questions on version 9's
Decisions page, the fourteen numbers the quality targets leave to set,
and the readings the decision record marks "to be confirmed".

Read for it: `../DECISIONS.md` whole, the six entries of 2026-11-02
included; `2026-11-02-owner-comments.md`; `../report/site/v9/decisions.json`
("groups"); `../requirements/2026-11-01-quality-targets.json`
("numberToSet" fields); `../requirements/2026-11-01-extension-cases.json`.
Today's values come from the code: `backend/src/utils/processMonitor.js`,
`aln-memory-scanner/js/orchestratorIntegration.js` and
`arduino-cyd-player-scanner/ALNScanner_v5/config.h`.

This is a working file for the agent running the pass, so it calls the
owner "the owner". Version 9's letters appear only in the Source column,
to find each question on that page.

---

## Table 1. The eighteen questions

Four sorts. Answered: the owner's decisions already answer it. The
owner's: only the owner can decide it, and it is open. The agent's call:
the agent makes it and tells the owner, who can overrule it. A review:
the owner reads and flags what is wrong or missing.

Count: 2 answered, 2 the owner's, 9 the agent's calls, 5 reviews.

| Question | Sort | The call, or what stays open | Reason | Source |
|---|---|---|---|---|
| Do the quality targets say how well the engine must work? | A review | The owner reads the forty-two targets and flags what is wrong or missing. The numbers leave this question: Table 2 sorts them, and none of them waits on the owner as an engine decision. Version 9's two options (set fourteen numbers now, or later) fall away. | The ruling says "The requirements are offered for review, not as decisions." For the numbers, the owner said many are "stuff that the engine itself should be relatively agnostic about". | v9 letter A; [[dec:the-decisions-page-holds-only-your-decisions]]; [[dec:the-engine-says-what-is-fixed-and-what-each-production-sets]] |
| Do the extension cases say how the engine must grow? | A review | The owner reads the twenty-four cases and flags what is missing. Before the page goes up, the agent checks the cases against the two kinds of extension and against hardware flexibility, and names any case the owner's two examples (players change the room's lighting by scanning tokens; a service such as Snapcast for audio in several rooms) do not yet have. | The cases are requirements, and the ruling offers requirements for review. The 2026-11-02 decisions may show a gap, which is what a review is for. | v9 letter B; [[dec:the-decisions-page-holds-only-your-decisions]]; [[dec:two-kinds-of-game-extension]]; [[dec:the-engine-is-hardware-flexible-the-roadmap-sets-the-bounds]] |
| Four readings of earlier decisions, to confirm | The agent's call | Confirm all four readings, as version 9 recommended. Each is a row in Table 3, sorted there as bookkeeping. | The ruling names "readings that follow from the owner's earlier decisions" as the agent's calls. Each reading follows from a later decision of the owner's that sets the order of the work; the earlier wording stays in the record's history. | v9 letter C; [[dec:the-decisions-page-holds-only-your-decisions]]; DECISIONS.md, "Read as overtaken, not yet confirmed" |
| Are these the right ten promises? | A review | The owner reads the ten promises and flags any that is missing, doubled or wrongly put. The agent checks first where [[dec:no-technical-failure-stops-a-game]] sits among the ten, and says so on the page. | The promises are the first part of the requirements, and the ruling offers the requirements for review. Whether the list is right is not a choice between options. | v9 letter D; [[dec:the-decisions-page-holds-only-your-decisions]]; [[dec:promises-qualities-moments-venue-technician]] |
| Two clauses added to the pack promise | A review | Both clauses stay in [[promise:J1]] and go to the owner with the promise review. The first clause, a second designer's game on the same engine, is already the owner's direction. The second, every device plays the same pack version and shows which, is promise wording the flaw [[flaw:C12]] breaks today. | The owner said the engine is to be "open sourced to support many different games in many different production scenarios", and that "the next person to try the engine might have a totally different scenario". A clause in a promise is requirement wording, offered for review. | v9 letter E; [[dec:design-for-the-long-term-beyond-aln]]; [[dec:the-engine-says-what-is-fixed-and-what-each-production-sets]] |
| The roles promise covers who may act | A review | The second half of [[promise:J7]] stays and goes to the owner with the promise review. | The clause restates [[qt:QT31]], which rests on the roadmap's rules on identity and access, and the settled roles. It asks for no new choice, so it is wording for review. | v9 letter F; [[dec:the-role-question-starts-from-settled-roles]]; [[qt:QT31]] |
| The venue promise names declared standalone | Answered (the clause); the agent's call (the flaw) | The clause in [[promise:J8]] is the owner's own decision. On the second point, the agent's call is yes: [[flaw:N1]] stays a design flaw of its own. | The clause quotes the owner's decision that a game declares it is standalone and never mixes networked and standalone devices; the owner restated its purpose on 2026-11-02. Whether eight findings form one flaw or join three others is a grouping of findings, which is the agent's to make. Three other design choices need the declared fact as an input, so it gets its own flaw. | v9 letter G; [[dec:standalone-games-declared-never-mixed]] |
| Split the tap promise in two? | The agent's call | Split [[promise:J3]] into "Every tap gets its answer" and "The night can be told afterwards". Unchanged from version 9. | The ruling names how the requirements are worded and grouped as the agent's call. The engine's parts are the same either way, and the two halves serve different people at two moments. | v9 letter H; [[dec:the-decisions-page-holds-only-your-decisions]]; [[dec:the-night-s-record-and-the-after-game-article]] |
| Keep the venue promise whole? | The agent's call | One promise, titled "The game fits the venue it is in tonight", with standalone games in its first sentences. Unchanged from version 9. Its sentences now also name another production fitting the engine to its own venue and hardware. | Grouping and titles are the agent's call. A separate promise for running in any setup would own no part. The record already notes this title as a promise (2026-11-01), and the 2026-11-02 decision on what each production sets adds a person to its sentences, not a second promise. | v9 letter I; [[dec:promises-qualities-moments-venue-technician]]; [[dec:the-engine-says-what-is-fixed-and-what-each-production-sets]] |
| Proof and release in one promise? | The agent's call | One promise, as [[promise:J10]]'s title has it. Unchanged from version 9. What release day means in practice moves to the owner's new question on whether everything updates together. | Whether two moments sit in one promise or two is wording; every option gives the flaws the same parts to be fixed in. The product question inside release day is the one the owner asked about on 2026-11-02 ("Generally speaking, yes, but I'd like to understand more specifically what this question means in practice"). | v9 letter J; [[dec:one-published-protocol-and-an-outside-test-bench]]; DECISIONS.md, "Still open" |
| Which promise carries equipment state on screens? | The agent's call | Name the route in neither [[promise:J4]] nor [[promise:J2]], as long as the design rounds keep one delivery part; the card for [[flaw:C2]] stays under [[promise:J4]]. Unchanged from version 9. | This is where a sentence goes, so it is wording. The real choice behind it, one delivery part or several, belongs to the design rounds. | v9 letter K; [[dec:the-nine-questions-the-pass-answers]] |
| The hardware scanner's standalone mode | Answered | Yes. The hardware scanner plays standalone games as the phone's scanner does. | The owner's words of 2026-11-02 name "player scanners (phone or hardware)". The record says this answers the question, which had waited for the owner's explicit word since 2026-10-31. | v9 letter L; [[dec:standalone-games-declared-never-mixed]] |
| One GM tablet per standalone game? | The owner's | Still open, reworded as the record has it: which shapes of standalone game the engine supports (GM scanners, player scanners or both; how many GM tablets). Whether a standalone tablet's record holds player scans depends on the answer. | How many people may run a standalone game, and with which devices, changes what the product allows; only the owner can set that. The agent notes a link the owner has not stated: if a networked game may carry on with its devices alone when the show machine fails, several tablets with no engine is the same problem. | v9 letter M; [[dec:standalone-games-declared-never-mixed]]; [[dec:no-technical-failure-stops-a-game]]; DECISIONS.md, "Still open" |
| Exposed evidence and video with no engine | The agent's call | Exposed evidence shows on the GM tablet's own scoreboard screen. A video token shows its picture with a plain note, never an error. Unchanged from version 9. | This is a default for what a screen draws, a technical default. The owner said standalone games are games designed and set up to run with no network, so the designer of such a game knows there is no TV; the engine's part is a default that works and never shows red. The agent counted this question as the owner's on 2026-11-02, before the owner said what standalone games are for. The owner can overrule it. | v9 letter N; [[dec:standalone-games-declared-never-mixed]]; [[qt:QT39]] |
| Record every refused GM scan attempt? | The agent's call | Yes. Record every attempt and its answer, kept under the production's retention setting, and show it nowhere until a feature needs it. Unchanged from version 9. | It changes nothing anyone sees. A fact not kept is lost for good, and the after-game tools can read it later. It also helps sort out a game afterwards when a device failed mid-game. The owner asked for the agent's view on this, and the view is the call. | v9 letter O; [[dec:the-night-s-record-and-the-after-game-article]]; [[dec:no-technical-failure-stops-a-game]]; [[qt:QT30]] |
| The panel's three lenses | The agent's call, changed | Three architects. The state lens becomes "state, authority and keeping the game going through a failure", with [[dec:no-technical-failure-stops-a-game]] as its first test. The growth lens names hardware flexibility and both kinds of extension. "Living with it" stays. No fourth architect. | The ruling names how the panel runs as the agent's call. Version 9 left live-show reliability inside the state lens. The owner has since called a paused game "the worst possible scenario", so that lens now names it. Naming it in a lens costs nothing; a fourth architect costs two more agents. | v9 letter P; [[dec:the-decisions-page-holds-only-your-decisions]]; [[dec:the-engine-is-hardware-flexible-the-roadmap-sets-the-bounds]]; [[dec:two-kinds-of-game-extension]] |
| What the panel gets in the blind round | The owner's | Still open. The recommendation stands: also give the blind round the owner's binding decisions and the decisions ahead. The binding list now adds four decisions of 2026-11-02: no technical failure stops a game, hardware flexibility, the two kinds of extension, and what each production sets. | The owner made the decision on what the blind round sees, and said the context the panel gets is critical. Adding to it changes the owner's decision, so the owner decides. | v9 letter Q; [[dec:what-the-architects-panel-sees-and-when]]; [[dec:independent-architects-propose-the-top-level-design]] |
| The second round reads today's code | The agent's call | A fact sheet first, then the code and its component guides, to read only. Unchanged from version 9. | The owner's decision gives the second round "today's engine as facts" and does not say in what form. The form is method, which is the agent's to choose. | v9 letter R; [[dec:what-the-architects-panel-sees-and-when]] |

The record's "Still open" list adds seven questions raised on
2026-11-02. They stand beside the two still the owner's here: where the
qualities pull against each other; whether everything updates together
on release day; how a networked game carries on if the show machine
fails; which shapes of standalone game the engine supports (this
absorbs "One GM tablet per standalone game?"); where the roadmap draws
the hardware line; how an extension for all games relates to the main
release, and which piece each kind changes; and which numbers are fixed
and which are each production's (Table 2 sorts these).

---

## Table 2. The fourteen numbers the quality targets leave to set

Three sorts. An engine requirement or limit: the engine states it, the
same for every production, measured on each supported machine. A
production's setting: each production sets its own, and ALN's is the
first set. A technical default: the agent proposes a value and a
production may change it.

The engine requirements and limits are not decisions the owner makes.
They go to the owner as part of the quality-target review. Where two
targets hold numbers of different sorts, the row splits them.

Count: 6 engine requirements or limits, 6 production settings, 2
technical defaults, by each row's main sort.

| Number | Sort | Reason | Source |
|---|---|---|---|
| [[qt:QT1]]: how long the engine may take from power back to a running show | A production's setting | The record lists "the time from power-on to a running show" among the numbers the engine stays agnostic about. What is fixed is that nothing is lost; the engine states how long its own restart takes on each supported machine, so a production can check its own limit. No source gives ALN's number; the agent measures it on the show machine. | [[dec:the-engine-says-what-is-fixed-and-what-each-production-sets]]; QT1 numberToSet |
| [[qt:QT2]]: how many restarts the program watcher tries, and over how long; ten seconds for the controls to come back | Restarts: a technical default. Ten seconds: an engine requirement | How the watcher retries is a technical matter that serves every production the same way. Today it restarts a program four times, waiting 10, 20, 40, then 80 seconds, and gives up at the fifth failure (`processMonitor.js`; corrected 2026-11-02 after the version 10 checks, which also found the video player's watcher waits a fixed three seconds, `vlcMprisService.js`), and the agent starts from that. Ten seconds for the panel's controls to return is the engine's own behaviour, from the promise's test, the same for every production. | QT2 numberToSet; `backend/src/utils/processMonitor.js` |
| [[qt:QT3]]: five seconds for a tablet to be back under its own station name | An engine requirement | Reconnecting is the engine's own behaviour on a working network. It does not depend on the production's game, venue or kit. | QT3 numberToSet |
| [[qt:QT5]]: how long after the engine goes silent a screen must say so | A technical default | The value trades network traffic against how fast a screen admits its numbers are old. That is a technical trade-off. Today both player scanners check on the engine every ten seconds, and the agent starts there. The engine states the longest delay it allows. | QT5 numberToSet; project guides for both player scanners |
| [[qt:QT9]]: the minutes from publish to playing | An engine requirement | "Within minutes" is the engine's own promise to every designer, not one production's need. The engine states it for a given pack size, since media files take longer to move. | QT9 numberToSet and status |
| [[qt:QT13]]: how long the venue technician may need from an unpacked kit to a go | A production's setting | The record lists "set-up time" among the production numbers. It depends on the kit's size and the room, which differ for each production. What is fixed is that set-up needs the guide alone and no terminal. | [[dec:the-engine-says-what-is-fixed-and-what-each-production-sets]]; QT13 numberToSet |
| [[qt:QT14]]: how long from power on to a running show | A production's setting | The record names this number among those the engine stays agnostic about. The engine states its own start time on each supported machine. What is fixed is that the machine starts straight into a running show with no terminal. | [[dec:the-engine-says-what-is-fixed-and-what-each-production-sets]]; QT14 numberToSet |
| [[qt:QT19]]: how long a newcomer may need to make and prove a first small change | An engine requirement | It measures the engine's own code and guides, which are the same for every production. It serves the owner's goal of an engine that is "intuitive and easy to maintain". | QT19 numberToSet; [[dec:design-for-the-long-term-beyond-aln]] |
| [[qt:QT30]]: how long each kind of data is kept by default, per game | A production's setting | The target already calls it the owner's setting per game, and the record lists "how long records are kept" among the production numbers. The engine ships a default and keeps nothing past the setting; that much is fixed. | [[dec:the-engine-says-what-is-fixed-and-what-each-production-sets]]; QT30 situation; [[ex:EX24]] |
| [[qt:QT33]]: kit size; scan answer time; live message time; the machine's load, memory, disk and temperature limits; half a second for a video to report started | Kit size: a production's setting. Answer time, message time, half a second: engine requirements. Machine limits: technical defaults | The devices in a kit are named in the record as a production number; ALN's first set is tonight's kit (one show machine, two GM tablets, three hardware scanners, two scoreboard screens, HDMI sound and one Bluetooth speaker). The engine states the largest kit it supports, which the owner already set as "a few dozen devices". How fast the engine answers and delivers is its own promise. Load, memory, disk and temperature limits depend on the machine; the engine is meant to be hardware-flexible, so the agent proposes them per supported machine. | QT33 numberToSet and situation; [[dec:what-the-architects-panel-sees-and-when]]; [[dec:the-engine-is-hardware-flexible-the-roadmap-sets-the-bounds]] |
| [[qt:QT34]]: the number of player phones one kit carries | A production's setting | The record names "the devices and phones in a kit" among the production numbers. Each production measures its own machine and wifi. What is fixed is the method: measure before the first phone, declare the number in the profile, count phones in the preflight. No source gives ALN's number. | [[dec:the-engine-says-what-is-fixed-and-what-each-production-sets]]; QT34 numberToSet and status |
| [[qt:QT35]]: the longest acceptable first sync for a hardware scanner | A production's setting | The wait grows with the production's own media. The engine states how fast each kind of scanner downloads, so a production can predict its wait. ALN's first value is today's: 5 to 15 minutes for 30 to 40 MB. The owner said "many" of the numbers in the agent's list, which named this one, are ones the engine should be agnostic about. | QT35 numberToSet; [[dec:the-engine-says-what-is-fixed-and-what-each-production-sets]]; 2026-11-02-owner-comments.md, comment 7 |
| [[qt:QT40]]: how many scans a device must keep while offline | An engine limit | Each kind of device has a storage limit the engine must state, so a production knows how many scans each device holds through an outage. Today both player scanners keep 100 scans (`orchestratorIntegration.js`, `config.h`). The owner's ruling that no failure stops a game makes the stated limit matter more. | QT40 numberToSet; [[dec:no-technical-failure-stops-a-game]] |
| [[qt:QT43]]: how many copies of the engine one machine must carry at once | An engine requirement | The target's situation already needs two: the show's copy and a trial or test copy. Beyond two, the engine states its limit for each supported machine. | QT43 numberToSet and situation; [[dec:design-top-down-hardest-to-reverse-choices-first]] |

---

## Table 3. The readings marked "to be confirmed"

Two sorts. A product reading: it changes what the product does or
allows, so the owner confirms it. Bookkeeping: it follows from the
owner's later decisions about how the work runs, so it is the agent's
call, told to the owner.

The record's list "Read as overtaken, not yet confirmed" holds four
items; they are rows 2 to 7 below, split by the entry that flags them.

Count: 11 readings; 3 product readings, 8 bookkeeping.

| Reading | Where the record flags it | Sort | Reason |
|---|---|---|---|
| The nine questions serve as checks on each design | [[dec:the-nine-questions-the-pass-answers]] | Bookkeeping | It says how the pass uses its own questions once the design rounds go by decision. That follows from [[dec:design-top-down-hardest-to-reverse-choices-first]], and nothing a player, GM or designer meets changes. |
| The four live-state questions are no longer "designed together", and "one rule per question" no longer holds | [[dec:the-nine-questions-the-pass-answers]] (history, 2026-11-01) | Bookkeeping | The top-down order sorts the design rounds by decision, not by question. This is the order of the work, which the owner already set. |
| The handover's rules are no longer "one per question" | [[dec:five-documents-the-design-half-hands-over]] | Bookkeeping | Same cause as the row above: the design rounds go by decision. It changes what the design half hands over, not what the engine does. |
| Contract proposals give way to the one published protocol | [[dec:five-documents-the-design-half-hands-over]] | Bookkeeping | The owner decided on one published, versioned protocol that consolidates today's contracts. Drafting separate contract proposals beside it would repeat that work. |
| "Every question has a rule and a proof test" is no longer an end condition | [[dec:when-the-design-half-is-finished]] | Bookkeeping | The end condition follows the order of the work, which the top-down decision changed. The nine questions still check every design. |
| The rig reproducing each finding marked for live proof is no longer an end condition | [[dec:when-the-design-half-is-finished]] | Bookkeeping | The owner moved the rig to the start of building in [[dec:build-the-test-rig-when-building-starts]], so it cannot be a condition for ending design. |
| Each build area no longer starts with its proof test failing on today's engine, unless the move from today's engine changes it in place | [[dec:one-program-design-half-then-build-half]] | Bookkeeping | It follows from [[dec:build-the-test-rig-when-building-starts]], which states the same exception. It changes the order of building, not the product. |
| A standalone game may have no GM tablet at all | [[dec:standalone-games-declared-never-mixed]] | Product | It allows a kind of game the engine did not allow before: player scanners alone. The owner's words "gm and/or player scanners" read that way, so a one-word confirmation may do; it belongs with the owner's open question on which shapes of standalone game the engine supports. |
| A GM tablet that loses the engine keeps taking scans, and the game carries on | [[dec:no-technical-failure-stops-a-game]] | Product | It changes what a tablet does mid-show, and it brings a cost: two tablets may sell the same token while apart, which must be sorted out afterwards. The owner's words ("having to pause a game because a connection was lost or a device goes down mid-game is the worst possible scenario") point this way but did not name the choice. [[qt:QT3]] had left it to a design round. |
| The design must say how a networked game carries on if the show machine itself fails | [[dec:no-technical-failure-stops-a-game]] | Product | It meets the owner's decision that no game mixes networked and standalone devices. Whether a networked game may carry on with its devices alone, and how its results come back together, changes what the product allows. The record itself calls this a question for the owner. |
| The quality targets' numbers split into the engine's fixed requirements and limits, and each production's own settings, with ALN's as the first set | [[dec:the-engine-says-what-is-fixed-and-what-each-production-sets]] | Bookkeeping | It restates the owner's own words ("what is a fixes requirement vs what affordances the engine allows") as a way of grouping the requirements, which the ruling makes the agent's call. Table 2 is that grouping; the owner reviews it with the quality targets. |

One more item was pending in the record, not marked "to be confirmed":
the hardware scanner's standalone mode, recorded on 2026-10-31 "pending
the owner's word". The owner's words of 2026-11-02 answer it (Table 1,
"The hardware scanner's standalone mode").
