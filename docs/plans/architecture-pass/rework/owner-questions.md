# The questions only you can answer before the panel

Written 2026-11-02 by the agent running the pass, for the rework of the Decisions page ([[dec:the-decisions-page-holds-only-your-decisions]]). It is drafted in the site's voice, so "you" is the owner. Where a text quotes the requirements, the standing rules or the record, "the owner" stays as a role, because the panel reads those texts too.

The task was to find the questions that the engine's top-level design needs answered now, before the independent panel proposes designs blind, and that only you can answer. Each question below passes four tests, and the evidence for each test is written under it:

- Only you can answer it. It is about what the product must do or allow, for whom, or which of two goods matters more. It is never about how to build it.
- The record does not already answer it. The entry that leaves it open is named, or the note says no entry covers it.
- At least one of the six decisions ahead on the Design page depends on it. The decision is named, and the note says how the answer changes the design.
- It is needed before the panel's blind round or the first design round, not later.

The sources were your goal and your comments of 2026-11-02 (`2026-11-02-owner-comments.md`, the primary source), the decision record (`../DECISIONS.md`, whole, with its six entries of 2026-11-02), the roadmap's final outcome, standing constraints and later blocks, the promises, the quality targets, the extension cases, the standing rules, the six decisions ahead in the Design page's data, and the review of standalone games of 2026-10-31. The seven questions the agent proposed on 2026-11-02 were read only as the context of your replies. You found two of them confused, the one on standalone games and the one on extensions, so neither was taken as right or complete; the questions on those topics below start again from your words.

Nine questions passed. Two sections explain what you asked to understand first: where the qualities pull against each other, and what release day means in practice. The last section lists every question considered and dropped, with the test it failed.

A note on words. "The engine" is the show machine's program, which the code calls the backend. "The GM tablet" is the tablet running the GM scanner. "The phone's scanner" and "the hardware scanner" are the two player scanners. "Applying a change while the engine runs, between games" is what the roadmap calls hot-apply. "A separate trial copy of the engine" is what the roadmap calls the preview engine. "Not installed tonight" is the grey state the code calls dormant.

---

## The questions

### A GM tablet cut off from the engine

**What it decides.** What a GM tablet does with a scan while it cannot reach the engine for a short time, a dropped wifi or an engine restart. What the GM may tell the team at that moment. What happens when the connection returns and the engine disagrees with what the tablet showed. The same answer holds for the first minutes of a longer failure, before the GMs know whether the machine is coming back.

**What it means in practice.**

At a show. The tablet's wifi drops for a minute. A team hands the GM a token. Today the tablet shows "Transaction Complete" with points, from its own copy of the rules, and queues the scan for the engine ([[flaw:C9]]). If another tablet sold the same token during that minute, the engine refuses the queued scan on reconnect, and the GM has already told the team it earned money. The quality target [[qt:QT3]] asks that the GM can always see what became of such a scan, and leaves open which of two things the tablet does: refuse it with a reason, or keep it and answer when the connection returns.

For the GM at the failure. With a refusal the GM says "give me a minute, the connection is down" and the line waits. With a kept scan the GM says "it is in, your result shows when we are back." With a provisional verdict the GM says "you earned fifty thousand" and may have to take it back. Your words are that pausing a game for a lost connection is the worst scenario, and that the GMs need to know their fallbacks. The question is what the fallback shows.

For the designer. Nothing changes in the pack. A designer of a game with group bonuses should know that a provisional bonus can be undone.

For someone adopting the engine. A venue with worse wifi than yours makes this the common case. A production with one GM tablet can never have a conflict, so for them a kept scan and a provisional verdict come to the same thing. A production with four tablets at four tables has conflicts every time the wifi drops.

**The options, and what each means.**

- Refuse while cut off. The GM sees a plain reason; nothing is kept. In practice teams wait. For the build this is the simplest: the engine is the only decider, the tablet holds no game fact of its own, the published protocol needs no "not yet decided" state. In the years after, every wifi drop costs show time, which is close to the pause you called the worst scenario.
- Keep and label. The tablet records the scan as kept and not yet decided, shows no points, and shows the GM a list of kept scans. On reconnect the engine decides each in order and the tablet shows the final answer; a kept scan refused later becomes a red row the GM must act on. For the build: the protocol carries a provisional state in replies and in the tablet's list; the engine must order kept scans by when they happened, which meets the two-clocks finding (a sale carries the tablet's time, an adjustment the engine's). In the years after, GMs learn one habit: "in, pending."
- Keep and decide provisionally under the shared rules. The tablet applies the same rules the engine would, from its last known copy of the game, and shows the verdict and the points marked provisional. The engine confirms or overturns on reconnect. For the build: the game's rules must run equally on the engine and the tablet, which standalone games need anyway; every fact the tablet shows must carry "provisional" in the protocol; a conflict rule and a conflict screen exist. In the years after this is the richest fallback and the most to keep equal across two places.

Under the last two options you also set the conflict rule: when two tablets both sold one token during the gap, who wins. The earlier by the tablets' clocks (clocks differ); the first to reach the engine (luck); or the GM decides from a red row and tells the losing team. This is a choice between fairness by time and simplicity.

**Which decision ahead depends on it.** "Where authority lives across devices, offline and standalone included" names this question in what it decides: "What a tablet does with a scan while its connection is down: refuses it with a reason, or keeps it and answers when the connection returns." The answer changes the design at the top. Refusal means the engine is the only decider and tablets are screens. Keep-and-label means the protocol has a provisional state and the engine orders scans by their time. Provisional verdicts mean the rules run in two places and a reconciliation exists. "The published protocol's form" follows: what every reply carries ("how sure the engine is") depends on whether provisional replies exist. "How the engine holds the game's state" follows too, since kept scans must be ordered against the engine's record.

**Sources.** Your comment of 2026-11-02 on the agent's question about a GM tablet losing the show machine. [[dec:no-technical-failure-stops-a-game]], whose first reading (a tablet keeps taking scans) is recorded as to be confirmed. [[qt:QT3]], [[qt:QT7]], [[flaw:C9]], and the finding of the two clocks under [[dec:the-night-s-record-and-the-after-game-article]]. The agenda entry "Where authority lives across devices, offline and standalone included".

**The four tests.** Only you: what a GM may tell a team, and whether continuity or certainty matters more at that moment, is a product choice, not a build choice. Not in the record: [[qt:QT3]] says the choice "is not decided here"; the 2026-11-02 entry records a reading to confirm, not your word; no entry gives a conflict rule. A decision ahead depends on it: the authority round names it in its own words. Needed now: the panel's architect with the state-and-authority lens proposes how a live game's facts are held across tablets on a network that drops; without this answer the architect must guess whether a tablet ever decides.

### The show machine fails mid-game

**What it decides.** What a networked game does when the show machine stops and does not come back for the rest of the night. What fallbacks the GMs must have in front of them at that moment. What the players may lose, and what they must never lose. How the results come back together afterwards. Whether a game may change from networked to standalone while running, and what that does to "Standalone games: declared, never mixed".

**What it means in practice.**

At a show. Fifty minutes in, the show machine's power supply dies. The TV freezes on the scoreboard. The music stops. The players' phones and the hardware scanners stop sending; the hardware scanner keeps each scan on its card and shows the player that the scan is kept and not yet sent, which [[qt:QT40]] already requires; a video token cannot play. The GM tablets lose the engine. Today each tablet has its own copy of the game as of the last message and keeps scanning with its own verdict. Nothing merges two tablets' records afterwards, and no spare takes over.

For the GM at the failure. Your words: the GMs need to know their available fallbacks. The tablet should show them as a red row with actions, the pattern [[qt:QT15]] settles. Which actions exist is this question. "Carry on from this tablet." "Switch to the spare." "End the game from here." Each is a different engine.

For the designer. Cues stop with the machine. The designer must know which effects die with it: video, music, lights, the TV, the game clock. That is the same list a standalone game gives up (the question "What a standalone game gives up, and what it keeps" below).

For someone adopting the engine. A production with no spare machine. A production whose show is mostly the TV, for whom carrying on means little. A production that runs two games a night and cannot afford a lost one. Each would choose differently; the engine must say which fallbacks it offers.

For the players. You asked for as little effect on the player experience as possible. The design cannot promise the TV and the videos without a second machine. You must say what the players may lose for the rest of a night (video, music, the public evidence screen) and what they must never lose (their scans counted exactly once, no team paid twice for one token). On the public screens there is a second choice: when the engine goes silent, [[qt:QT5]] asks the TV to stop its clock and show it as unconfirmed, which is honest and visible; the alternative is a TV that keeps counting by itself, which is smooth and may be wrong.

**The options, and what each means.**

- Carry on from the tablets and reconcile afterwards. Each GM tablet keeps taking scans, as kept or as provisional under the question above. The GMs end the game from the tablets; the night's record is assembled from their records with the conflict rule. The player devices keep their scans and reach the record only when a machine comes back, or through a collection step after the show. The players lose video, music and the TV for the rest of the night. For the build: every tablet must hold enough of the game to finish it (the teams, the claims, the scores, the pack it ran) and a merge exists for several tablets. In the years after: the cheapest kit, and a recovery the GMs must rehearse.
- A spare machine takes over at once. A second show machine, or a tablet running an engine of its own, holds a live copy of the game's record, takes the engine's name on the kit's own network when the first falls silent, and every device finds it again, the way [[qt:QT42]] already asks devices to carry on when the old machine is replugged. The players lose a minute. For the build: the engine's record must be copied live as it changes (a numbered log of facts), the kit's name must move between machines, and passes must hold on both. In the years after: the most to build and to own (a second machine in every kit), and the strongest promise.
- A cold spare from the last saved record. A second machine or a tablet starts the engine from the latest saved copy of the game, kept every few seconds on the tablets or on a stick; the GM starts it by hand; the tablets re-send what they kept since the copy. Between the two above in cost and in the players' loss.
- Declare the game standalone once, for the rest of the night. One GM tablet becomes the decider from its last copy of the game; the other devices join it (which needs a channel between devices, in effect a small engine on the tablet) or stop. This would amend [[dec:standalone-games-declared-never-mixed]]: a game's declaration could change once, one way, for the whole game, with every device told. It keeps "never mixed", since after the change no device is on an engine. You must say whether you want that amendment or not.
- Pause until the machine returns. Listed only to say it is out. Your words call it the worst possible scenario.

**Which decision ahead depends on it.** "How the engine holds the game's state", the first and hardest to reverse. A spare that takes over live needs a record that can be copied as it changes; carrying on from tablets needs tablets that hold enough of the record to finish a game; a single store on one machine serves neither. "Where authority lives across devices" follows: whether a tablet or a spare may become the decider, and when. "How one engine runs as many separate copies" follows: a standby is a copy of the engine with the show's identity. "The published protocol's form" follows: how a device finds the engine again under a new machine, and whether a pass issued by one machine holds on another.

**Sources.** Your comment of 2026-11-02 on the agent's question about a GM tablet losing the show machine. [[dec:no-technical-failure-stops-a-game]], whose second reading says the design must say how a networked game carries on if the show machine itself fails and names the meeting with [[dec:standalone-games-declared-never-mixed]] as a question for you. [[qt:QT1]] (the machine comes back: settled; this question is when it does not), [[qt:QT5]], [[qt:QT15]], [[qt:QT38]], [[qt:QT40]], [[qt:QT42]], [[flaw:N1]].

**The four tests.** Only you: how much the kit may cost, what the players may lose on a bad night and whether a game may be re-declared are product and business calls. Not in the record: the 2026-11-02 entry says in so many words that this "is a question for the owner". A decision ahead depends on it: the state round, first on the agenda, cannot choose between a copyable record and a single store without it. Needed now: the panel's blind round proposes how the state is held; this is the situation that tells the proposals apart.

### Which standalone games the engine must run

**What it decides.** Which shapes of game with no show machine the engine must support, now and later. One GM tablet alone. Several GM tablets. Player scanners alone (phones, hardware scanners or both). GM and player scanners together. With no network at all between the devices, or with a small network (a phone's hotspot, the kit's router with no show machine). Whether one standalone game means one GM tablet. Whether "standalone" means no show machine, or means no network.

**What it means in practice.**

At a show. A game in a tent with battery power: one GM with a tablet, twenty players with phones. With the tablet alone, the GM sells and exposes tokens and the phones show memories, but nothing a player found reaches the GM's record; today's standalone game is this shape, and nothing records what players found. With two GM tablets and no network, today there are two games: a token can be sold at both tables, and the scores must be added by hand at the end. With a hotspot and no show machine, the tablet could act as the engine for the phones; then the game is in truth a networked game with the tablet as the machine, and the question is whether you call that standalone. Your words name both reasons for standalone: a network that is not feasible, and logistics that make devices alone preferable.

For the GM at a failure. With one tablet, the tablet is the only copy of the game. A broken tablet ends the record unless the game is copied somewhere as it runs.

For the designer. A pack for a standalone game must know what the devices can do alone. Two-tap actions between players' objects need one decider that both devices reach, so they need a network and a decider. A group bonus needs one claims list, so it needs one tablet or a merge rule. A designer who does not know the shapes designs mechanics that cannot run.

For someone adopting the engine. A school running a game on phones only, no GM. A museum running hardware scanners only, with a record collected at closing. A company with wifi but no spare computer, wanting the GM's tablet to be the machine. Each is a different product.

**The options, and what each means.** The shapes, each to be marked required now, allowed later, or never:

- One GM tablet alone. Today's shape. For the build: the tablet runs the game's rules; no channel between devices. The cheapest.
- Player scanners alone, content only. For the build: nothing shared; a record of what players found needs a collection step afterwards (each device exports; the design tool or a tablet merges), or there is no record.
- One GM tablet and player scanners, no network. The two halves never meet. For the build: as the first two together; the GM's record holds no player finds.
- One GM tablet as the engine for other devices over a small network. For the build: an engine that runs where a tablet runs, or a small computer in the GM's bag; in either case a second platform the engine must run on, and a definition of "standalone" that means no show machine rather than no network. The later choice "The standalone tablet: the same record and lifecycle parts the engine runs, or an engine of its own" becomes this shape's design.
- Several GM tablets with no network. Either refused (one tablet per standalone game) or accepted as separate games merged afterwards under the conflict rule from the first question.

The cost grows down the list. The first three need nothing shared between devices. The fourth is a second place the engine runs. The fifth is a merge of records.

**Which decision ahead depends on it.** "Where authority lives across devices, offline and standalone included": its decides line names "the tablet in a standalone one" as a decider; with several tablets or a tablet-as-engine the placement differs. "How the engine holds the game's state": whether the record must live on a tablet, be copied between tablets, or be merged. "The published protocol's form": whether devices ever speak to a tablet instead of the engine. "How one engine runs as many separate copies": an engine on a tablet or a small computer is a copy on another kind of machine.

**Sources.** Your comment of 2026-11-02 on standalone games. [[dec:standalone-games-declared-never-mixed]], which records as to be confirmed the reading that a standalone game may have no GM tablet at all, and lists "One GM tablet per standalone game?" as still open. [[qt:QT37]], [[qt:QT39]], [[ex:EX12]]. The review of standalone games of 2026-10-31: two standalone tablets are two separate games; no channel joins the player devices to the tablet; nothing records what players found.

**The four tests.** Only you: which productions and rooms the engine must serve is what the product is for. Not in the record: the entry says where the declaration lives is for the design rounds, but which shapes exist is not design; the record holds one reading to confirm and one open question (one tablet per game) and nothing on networks between devices or on player scanners alone. A decision ahead depends on it: the authority round and the state round, as above. Needed now: the panel's state-and-authority lens is told "standalone games included" and must know what a standalone game is.

### What a standalone game gives up, and what it keeps

**What it decides.** Which of a pack's effects a game declared standalone may use, and what happens to the rest: evidence exposed in public (the scoreboard screen), video, the game clock with its phases, cues, music and lights, and the record of what players found. Whether the check at publish refuses a standalone game whose pack declares an effect no device can carry alone, or the game runs and shows each such effect as not installed tonight, or the designer marks each effect as skip-it or block-the-show. Whether a standalone game must leave a record of what players found.

**What it means in practice.**

At a show. In ALN a detective transaction exposes a token, which means its summary appears on the TV for everyone. With no TV the GM sees the summary once on the result screen and the public never does; "exposed means public" has no standalone effect today. A video token on the phone's scanner shows a black screen; on the hardware scanner it shows the picture and "video unavailable, rescan later", which can never work. The pack's game clock has no reader on a standalone tablet; the panel shows wall-clock time.

For the GM at a failure. Nothing fails; the point is that the GM should see at the start, grey and not red, "this game is standalone: video and public evidence are not available tonight", the way [[qt:QT37]] asks.

For the designer. Under a strict rule the design tool refuses to publish a standalone game whose pack uses video or public evidence until the designer removes them or marks them skippable, the way [[ex:EX6]] lets a designer mark lights as skip-it or block-the-show. Under a lenient rule the pack publishes and the effects vanish quietly. The second game's pack already says the opposite thing, that the game needs an engine by nature ([[ex:EX20]]); a standalone declaration is the opposite of that statement.

For someone adopting the engine. A production built for phones only must know, before they design, which mechanics work with no machine. A rule that is written down is what they can design to.

**The options, and what each means.**

- Strict: the check at publish refuses a standalone game whose pack needs an engine-only effect, and names the effect. In practice the designer removes it or changes the declaration. For the build: the pack lists which effects need an engine (video, public screens, the clock, cues on equipment, hidden facts) and the check compares. In the years after: no surprises at a show; some games cannot be standalone at all.
- Grey and go: the game runs; every engine-only effect reads as not installed tonight on every device, by the same words the venue profile already uses for lights left at home. For the build: each device must know the list and show it; nothing is refused. In the years after: every standalone game is possible, and a designer learns what vanished only by playing.
- Per-effect marks by the designer: each engine-only effect in the pack carries skip-it or block-the-show, as lights do today; block-the-show makes the game refuse to be standalone. The most control, the most to write in the tool.

And for the record of what players found: no record in a standalone game; a record from the GM tablet only (what teams turned in); a record collected from every device afterwards. The last is the only one that makes a standalone night tellable the way a networked night is ([[promise:J3]]).

**Which decision ahead depends on it.** "How games and venues extend the engine": what a pack may declare and how the check at publish refuses a pack that asks for something this engine lacks are its decides line; a standalone declaration and the per-effect marks are pack format. "Where authority lives across devices, offline and standalone included": what reads the declaration and on which device. "The published protocol's form": the pack is one of its files, and the night's record (with or without player finds) is another.

**Sources.** Your comment of 2026-11-02 on standalone games. [[dec:standalone-games-declared-never-mixed]]. The still-open "Exposed evidence and video with no engine". [[qt:QT39]], whose open part asks whether a standalone game's record holds what the players found at all, and how exposure and video tokens behave with no engine. [[qt:QT6]], [[qt:QT37]], [[ex:EX6]], [[ex:EX12]], [[ex:EX20]], [[flaw:N1]]. The review of standalone games: the tablet alone has no scoreboard to show an exposure on; the pack's clock has no reader; nothing records what players found; the phone shows a black screen for a video token and the hardware scanner says rescan later.

**The four tests.** Only you: whether a designer may be refused, and whether a standalone night must be tellable, are product rules. Not in the record: "Exposed evidence and video with no engine" is listed as still open, and the record-of-player-finds half of [[qt:QT39]] is marked open. A decision ahead depends on it: the extension round decides the pack's declarations and the check's refusals. Needed now: the panel's growth-and-extension lens designs the pack format in the blind round; whether a pack can be refused for its standalone declaration belongs to that format.

### What a game's maker may build inside the pack

**What it decides.** How far a game's own maker may go inside the pack, with no developer. Values in tables, as today: modes by their flags, scoring tables, groups, cues on a clock. Rules the designer writes as "when this happens, do that", wiring triggers the engine knows to responses the engine knows; your example is players changing the room's lighting by scanning tokens on a player scanner. Or scripts, code the designer writes into the pack. And whether such rules must also run where there is no engine, on a standalone tablet or on a hardware scanner alone, since phones and hardware scanners stay equal in ability and designers change pack data, never device code.

**What it means in practice.**

For the designer. With tables only, your lighting mechanic needs a developer to add an ability "a player's scan triggers a lighting role" and every later combination needs another. Today a game played only on GM tablets reaches video through one standing cue per token, which is the tables-only workaround ([[ex:EX22]]). With when-then rules the designer writes "when a player scans a token of this group, light this role" in the design tool and plays it within minutes, which is the loop the standing rules make the point of the engine work. With scripts the designer can do anything and the check at the desk can promise little.

At a show. A rule the designer wrote misfires: every scan flips the lights. The GM must be able to switch that rule off from the tablet, as a standing cue is switched off today, and the check at publish must have refused rules that cannot run (a lighting role the venue profile never bound). A rule that runs on the engine is one more thing the GM's Show Control section lists.

For the people maintaining the engine. Tables keep the engine small and readable. A rule format is a second language to version, check, test on two games and document for adopters, and it grows unless someone says no. Scripts need a sandbox and a security story.

For someone adopting the engine. A theatre company with no developer wants to combine abilities themselves. A company with a developer may prefer code and find a rule format limiting. The hardware scanner matters here: a rule "when scanned, play this sound" must run on the device alone in a standalone game, so the scanner's firmware must carry a runner for whatever rules the pack may hold, or the scanner asks the engine and standalone scanners run only what they can.

**The options, and what each means.**

- Tables of values only. Every new combination is an ability a developer adds, named in the pack's list of required abilities. For the build: the engine stays as today in kind; the hardware scanner's firmware stays simple. In the years after: the designer's loop closes at every new mechanic, and the second kind of extension (a developer extends the engine for all games) carries all growth.
- Declared when-then rules over the engine's abilities. The pack names triggers the engine knows (a scan of this kind, a clock mark, a phase change, a cue finishing) and responses the engine knows (play, light, score, show, hold), and the designer wires them. For the build: a rule format inside the pack and so inside the published protocol; a check at publish that refuses rules the engine or the venue cannot run; a runner in the engine and, for standalone games, on the tablet; a listing on the GM's tablet; the hardware scanner either asks the engine (networked) or runs the subset a device alone can (standalone). In the years after: most new mechanics need no developer; the rule format is what adopters learn; it must be kept small or it becomes a programming language by accident.
- Scripts in the pack. For the build: a sandbox, a versioned scripting language, limits on what a script may touch; the hardware scanner cannot run it. In the years after: unbounded power, hard to check at the desk, and the standing rule that games are built without code is gone.

Your words add one more thing for later: rules a game's maker builds might be shared with other game makers. That is a build consequence (the format must be exportable), not a question now.

**Which decision ahead depends on it.** "How games and venues extend the engine": what a pack may declare is its decides line, and the difference between tables and rules is the difference between a configured engine and an interpreting one. "The published protocol's form": the pack is one of the protocol's files, and a rule format is the largest thing it could carry. "Where authority lives across devices, offline and standalone included": a rule runner on the tablet and on a hardware scanner alone is a second place rules are decided.

**Sources.** Your comment of 2026-11-02 on extensions, which the record keeps in your tentative wording. [[dec:two-kinds-of-game-extension]], which leaves open which piece each kind of extension changes. The standing rules "Designers change pack data, never device code", "Phones and hardware scanners stay equal in ability" and "Games are playtested without code or settings files". [[qt:QT12]], [[qt:QT21]], [[ex:EX3]], [[ex:EX10]], [[ex:EX22]].

**The four tests.** Only you: who may build what, in which tool, and whether a no-code loop or a small engine matters more, is what the product is for. Not in the record: the entry records your lean ("should probably be able to be done by the game's own maker") as tentative and names "which piece each kind of extension changes" as open; no entry says whether the pack holds rules or tables. A decision ahead depends on it: the extension round and the protocol's form. Needed now: the panel's growth-and-extension lens designs "games as packs" in the blind round and must know whether a pack is data in tables or a rule language.

### How an extension for all games reaches a production

**What it decides.** When a developer gives the engine a response it could not give before, your example being audio in several rooms through a program such as Snapcast, how that reaches a production. Only through the engine's main release. Also as an add-on a production installs beside its engine, at places the engine leaves for additions. Or as a production's own changed build of the engine, with no promise from the engine. And what the engine promises about add-ons it did not ship: whether it lists them in its version, tests against them, or refuses ones it does not know.

**What it means in practice.**

At a show. A production runs the main release and an add-on for multi-room audio. The add-on's program crashes. The GM's health rows must name it as any other service, and the night's record must say the game ran this engine version with this add-on, or the night cannot be told truly afterwards.

For the designer. The pack already lists the abilities it requires, and the check at publish refuses a pack that needs an ability this engine lacks ([[qt:QT10]], [[qt:QT21]]). An add-on provides an ability. With add-ons, "this engine" means the release plus what is installed beside it.

For you. For ALN the difference is small, because you make the releases: an extension you want goes into the next release. The difference matters for everyone else.

For someone adopting the engine. A university with a developer writes support for its own lighting system. Under main-release-only they send it back and wait for a release, the path [[ex:EX21]] describes. Under add-ons they install it tonight and keep it across releases as long as the inner interface holds. Under forks they build their own engine and the community splits.

For the people maintaining the engine. Add-ons mean a second interface, facing inward, that must stay stable across versions and be tested against code you did not write. Main-release-only means one body of code and one test run on two games. Forks cost you nothing and the platform's users everything.

**The options, and what each means.**

- Main release only. Every extension for all games comes back to the main line, through review and the developer's tests on two games, and reaches a production in a release. For the build: no add-on loading; the version is one number. In the years after: the simplest to keep and the slowest for adopters; your review decides what goes in.
- Add-ons installed beside the release, at named places: a device kind, a program the engine drives, a scoring model, a kind of screen, a content source, which are the places the extension cases already name. For the build: an inward interface for each place with its own version; add-ons loaded from the venue profile or a file of their own; a stand-in and tests per add-on; the version mark and the night's record name the add-ons; the health registry knows them. In the years after: adopters move at their own pace; you keep the inner interfaces stable and test releases against add-ons you did not write.
- A production's own build, with no promise. For the build: nothing. In the years after: this happens in any open-source project whatever you decide; the choice is only whether the engine helps (add-ons) or does not.

**Which decision ahead depends on it.** "How games and venues extend the engine": its decides line asks "where the engine leaves room for a developer to add a scoring model, a kind of screen, a device kind, a program it drives or a content source without touching the rest"; whether those rooms are inner interfaces that outsiders install into, or places inside one body of code, is this question. "The published protocol's form": whether a version names add-ons and whether add-on messages are allowed. "How one engine runs as many separate copies": add-ons installed per copy.

**Sources.** Your comment of 2026-11-02 on extensions, where you named "how those extensions then interact with the main release of the engine" as the other question the agent had mixed in. [[dec:two-kinds-of-game-extension]], which lists that question as open. [[qt:QT21]], [[qt:QT22]], [[qt:QT23]], [[ex:EX4]], [[ex:EX9]], [[ex:EX15]], [[ex:EX18]], [[ex:EX21]]. The roadmap's release block.

**The four tests.** Only you: who may run what beside the engine, and what the platform promises them, is policy for an open-source platform, which is your end state. Not in the record: the entry names it open in your words. A decision ahead depends on it: the extension round. Needed now: the panel's growth-and-extension lens must know in the blind round whether to design inner interfaces with their own versions or one body.

### Which hardware the first new engine requires, and what it must allow replacing

**What it decides.** For each class of device in ALN's kit, whether it is a fixed requirement of the first release of the new engine (an adopter must bring the same) or a thing the engine's design must allow replacing later (a seam built now, no work beyond ALN's kit). The classes: the show machine (a Raspberry Pi 5 running Linux); the GM's station (an Android tablet running Chrome, reading NFC tokens itself); the players' devices (phones with a web page; one specific hardware scanner board); the public screens (a TV over HDMI; the small computer that shows the scoreboard on a second screen); the room's programs (the video player, the music player, the sound system, Bluetooth speakers, the lighting system); and the kit's own network. Your words: the engine is hardware-flexible in its mature form, and the roadmap must set realistic bounds between flexibility built now and specific requirements named now.

Much of this the requirements already settle. The engine must run a whole game on a laptop or a cloud machine with stand-ins ([[qt:QT25]]), so "a Linux computer" is already wider than "a Pi". A different hardware scanner joins by its pass ([[qt:QT22]]). A different lighting system or video player changes only the code that talks to it ([[qt:QT23]], [[ex:EX15]]). What the requirements do not settle is the GM's station, and the readiness list for adopters.

**What it means in practice.**

For someone adopting the engine. A company whose GMs have iPads cannot run GM stations today: iPads have no Web NFC, so the GM scanner cannot read tokens. A company with no hardware scanners, phones only, is fine. A company that wants the GM at a laptop with a USB reader is not served. The reading of your 2026-11-02 comment recorded as to be confirmed is that adopters need to know what is a fixed requirement and what the engine allows; the GM's station is the largest item on that list that nothing yet says.

At a show. If a GM station may be a laptop with a separate reader, then the device that reads a token and the device that decides may be two devices, which today they never are. And a laptop GM station could run the engine itself with a venue profile that names no equipment, which would make a standalone game "the engine on the GM's laptop" rather than "a tablet that copies the engine's rules". That is a large simplification of the standalone question, if you want it.

For the designer. The pack declares which kinds of device its players use and what part each plays (the standing rule "Equal in ability, not in screens"), so the list of device classes is part of the pack format and of the published protocol.

For the people maintaining the engine. Every class the engine must allow replacing needs a seam, a stand-in and a test. Every class fixed needs none of that now and all of it later, if ever.

**What you must say now, and what the design rounds should propose.** Now: that the first release's fixed list is ALN's kit as it stands (a reading to confirm, and the panel's setting already states it as fact); whether the GM's station must be allowed, in the architecture now, to be something other than an Android tablet reading NFC itself; and whether a tablet-class device or a GM's laptop must be able to run the engine itself (which joins the standalone shapes question). The design rounds then propose the seams for the device kinds and the programs, which classes get stand-ins first, and the roadmap's named requirements at each readiness state, for you to decide.

**The options for the GM's station, and what each means.**

- An Android tablet with built-in NFC, fixed. In practice adopters buy the same tablets. For the build: as today. In the years after: the smallest set of GM devices to test, and a hard requirement in the adoption guide.
- Any browser as the station, with the token reader as its own kind of device feeding it. In practice a GM at a laptop with a USB reader, or at an iPad with a camera reading QR codes. For the build: a reader device kind in the protocol; the GM app works with no NFC of its own; a station and a reader are paired. In the years after: the GM's station is wherever the browser is, including a laptop that runs the engine.
- Any browser as the station, with QR codes and typed codes when there is no NFC. For the build: little, since the GM app already has manual entry. In the years after: slower GMs at venues without NFC devices, and no new device kind.

**Which decision ahead depends on it.** "The published protocol's form": the device kinds and passes it defines. "Where authority lives across devices, offline and standalone included": whether a GM's device may run the engine itself changes what the standalone decider is. "How one engine runs as many separate copies": an engine on a GM's laptop is a copy on another machine. The panel's setting, which lists the devices as facts, changes if the GM station may be other devices.

**Sources.** Your comments of 2026-11-02 on hardware and on the numbers. [[dec:the-engine-is-hardware-flexible-the-roadmap-sets-the-bounds]] ("Where the current roadmap draws that line is open"). [[dec:the-engine-says-what-is-fixed-and-what-each-production-sets]]. [[qt:QT22]], [[qt:QT23]], [[qt:QT25]], the standing rules on platform parity, [[dec:what-the-architects-panel-sees-and-when]] (the setting as facts).

**The four tests.** Only you: what the first release requires an adopter to buy, and whether your GMs' way of working (tablets with NFC) is the engine's requirement or ALN's habit, is a product and business call. Not in the record: the hardware entry says the line is open; nothing names the GM's station. A decision ahead depends on it: the protocol's form (device kinds) and the authority round (a laptop running the engine as the standalone decider). Needed now: the panel's blind-round folder states the devices as facts; if the GM station may be other devices, that sentence changes before the folder is built.

### Release day: what must update together, and how long older devices work

**What it decides.** Whether a new version of the engine requires every device and pack to be at the matching version (everything updates together), or the engine must keep working with older GM tablets, phones, hardware scanners and packs for a stated time. How long that time is. Whether a mismatch refuses the device or warns the GM. Whom the promise is for: your kit, or every adopter's.

The section "Release day" below explains what this means today and in the long term, and how the answer changes the published protocol and the build. This entry holds the question itself.

**What it means in practice.**

At a show. A hardware scanner missed its cable update and connects to the new engine. Under everything-together the engine refuses it, the GM's tablet names it, and the scanner is useless tonight unless someone has a cable and a laptop. Under a window it works tonight and the GM's tablet shows "older firmware, update before the next show".

For the GM at a failure. Under everything-together the only fix is the cable. Under a window there is nothing to fix tonight.

For the designer. Packs already have their rule and it does not change here: a pack that needs an ability this engine lacks is refused at publish with the ability named ([[qt:QT10]]), and abilities are only ever added ([[qt:QT21]]), so an old pack runs on a new engine.

For someone adopting the engine. A production with thirty hardware scanners. A production that updates its engine twice a year. A production that wants the newest engine in the week of a show and cannot reflash a fleet. For them the protocol's version rules are what they build against.

**The options, and what each means.**

- Everything updates together. One version for the release; the engine refuses any device at another version; the tablet and phone apps come from the engine, so they move with it; hardware scanners must be flashed before the show; packs are checked at publish as now. For the build: the simplest protocol (one version number, no negotiation), one combination to test, and either a cable step in the pre-show checklist or an over-the-air firmware update at boot that the design rounds would have to add. In the years after: the least to keep, and show-night work every release for every cable-updated device.
- Together for what the engine serves, a window for the rest. The engine forces a stale tablet or phone app to reload, so nothing it serves is ever at another version; cable-updated devices and packs work for a stated window (one or two engine versions back) and the GM's tablet shows which devices are behind. For the build: the hardware scanner's part of the protocol is kept small and changed rarely, with additive changes only inside the window; a test matrix of the engine against each supported scanner version; a rule for when a version is dropped. In the years after: cable visits when you choose, not every release.
- A window for everything. Every message carries its version; the engine speaks to older tablets, phones, scanners and packs within the window. For the build: versioned messages throughout, negotiation at connection, a larger test matrix, a deprecation schedule. In the years after: the most freedom for adopters and the most to test forever.

**Which decision ahead depends on it.** "The published protocol's form": its decides line says it "settles the version rules: what an older tablet, scanner or pack does when the engine is newer." The answer changes the form itself: a lockstep protocol can change shape between releases and needs no negotiation; a windowed protocol needs a version on every message, additive-only changes inside a window, and a test matrix on the test bench. "How today's engine moves to the new design" follows in part: the swap from blue to green is itself a release, and whether old devices may meet the new engine during the move depends on this.

**Sources.** Your comment of 2026-11-02 on release day ("Generally speaking, yes", with a request to understand what it means in practice and how it affects the design and build long-term). [[qt:QT41]], [[qt:QT42]], [[ex:EX17]], [[qt:QT10]], [[qt:QT21]]. The agenda entry "The published protocol's form". Today's code: the handshake records a device's version and only logs a pack mismatch; the GM tablet's list of messages is kept by hand; the hardware scanner's firmware updates only by cable.

**The four tests.** Only you: how much show-night work you accept per release, and what the platform promises adopters' fleets, are product and business calls. Not in the record: "Still open" records your lean and your request for an explanation, and no entry gives a window or a refuse-or-warn rule; [[qt:QT41]] settles that a mismatch is shown, not what happens next. A decision ahead depends on it: the protocol's form names version rules as part of what it decides. Needed now: the panel's architects propose forms of the protocol in the blind round, and versioning is most of a protocol's form.

### Where the trial copy runs while a show runs

**What it decides.** Whether a designer must be able to rehearse on a separate trial copy of the engine on the show machine while a show runs, or only between games on the show machine, or only on a laptop or the test bench. In other words, whether the show machine must carry two running copies of the engine during a show.

**What it means in practice.**

At a show. The GM runs the show on the show machine. The designer at the desk starts a trial copy on the same machine to try tomorrow's pack. The trial's video player must not take the TV, its music must not come out of the room's speakers, and the machine's processor and heat budget are shared with the live show. [[qt:QT11]] promises that the show never notices.

For the GM at a failure. A trial copy that misbehaves during a show is a risk the GM did not take. The strongest isolation the design can build is still weaker than a trial copy that is not there.

For the designer. On a laptop the designer rehearses on the test bench with stand-ins and never on the real room. Between games the designer rehearses on the real room and its equipment, but only before doors or after the last game. During a show the designer rehearses whenever they like.

For someone adopting the engine. A one-machine kit versus a kit with a laptop. A production with a small show machine and a long show.

For the people maintaining the engine. Two copies at once need separate files, ports, settings, programs and passes, and a share of the machine reserved for the show. One copy at a time needs separate files and records only.

**The options, and what each means.**

- During the show, on the same machine. For the build: the copies round must isolate at the level of the operating system and reserve headroom; [[qt:QT43]] asks you how many copies one machine must carry at once. In the years after: the most convenient for the designer and the most careful engineering to keep.
- Only between games, on the show machine. For the build: separate files and records; no two copies scheduled together during a show. In the years after: rehearsals on the real room happen before doors.
- Only on a laptop or the test bench. For the build: the show machine runs one engine, ever. In the years after: the real room is rehearsed only by running a game on it.

**Which decision ahead depends on it.** "How one engine runs as many separate copies": its decides line says "Where the designer's trial copy runs, a laptop or the show machine between games, is open." The answer decides how strong the isolation between copies must be and whether headroom is reserved on the show machine; it also feeds the limits you set under [[qt:QT33]].

**Sources.** [[qt:QT11]], which says you settled a trial copy on the same machine while a show runs, through the preview block and your ratification of the design tool's pages. [[ex:EX14]], which says where it runs is an open question. The agenda entry on copies, which says the same. [[qt:QT27]], [[qt:QT43]]. The roadmap's preview block, which names "the rehearse affordance on a running preview engine" without saying where it runs.

**The four tests.** Only you: the designer's convenience against the show's risk and the kit's cost is a trade between two goods. Not in the record: the record disagrees with itself. One quality target calls it settled, the extension case and the agenda call it open, and your ratification of the design tool's pages said the trial copy ships with its own profile, not where it runs; the preview block's words do not say either. A decision ahead depends on it: the copies round names it. Needed now: the panel's living-with-it lens and its state lens both design the copies, and whether two engines share the show machine during a show is a top-level fact of the setting.

---

## Where the qualities pull against each other

You asked to see the specific conflicts between the qualities and what each means functionally before answering which win. Below are the conflicts the top-level design of this engine will actually meet, between the twelve groups of the quality targets. Each says what happens at a show, for the designer, for the people maintaining the engine and for an adopter. Then it says whether your decisions already settle it, and which way, or that it is open and which question above it becomes. Conflicts that a design can resolve without your word are marked as settled by the requirements, so the panel designs to them.

**Staying up through a live show, against every screen telling the truth.** A tablet that keeps the game going while cut off must either refuse scans or show something the engine has not decided. At a show the GM tells a team "complete" and the engine refuses later. For the designer nothing changes. For the people maintaining the engine, a provisional state doubles the paths to test. For an adopter with weak wifi this is every night. Settled in part: the game goes on ([[dec:no-technical-failure-stops-a-game]]) and a refused scan never reads as complete ([[qt:QT7]]). Open: what the tablet shows meanwhile and who wins a conflict. It becomes "A GM tablet cut off from the engine".

**Staying up through a live show, against standalone and offline.** When the show machine dies, a networked game's devices are alone, which "no game mixes engine and standalone devices" forbids. At a show the GMs have whatever their tablets show. For the designer, every effect that needs the machine stops. For the people maintaining the engine, a record that can move to a spare is a different engine from a single store. For an adopter, the cost of a spare machine. Settled: no mixing, and the game must go on. Open: how. It becomes "The show machine fails mid-game".

**Staying up through a live show for the players, against every screen telling the truth on the public screens.** When the engine goes silent the TV should stop its clock and say so, which the audience sees as a stopped show; a TV that keeps counting on its own is smooth and may be wrong. Settled for the players' own devices: a scanner shows the player that a scan is kept and not yet sent and never promises a video it cannot start ([[qt:QT40]]). Open for the audience's screens ([[qt:QT5]] is proposed). It is part of "The show machine fails mid-game".

**The designer's iteration speed, against each lifecycle button doing what it says.** Applying a change while the engine runs could reach a game in progress. At a show a publish during a game must be refused. For the designer the change lands at the next window between games. Settled: a change reaches a game only between games, or the engine refuses and says why ([[qt:QT9]], [[ex:EX2]]).

**The designer's iteration speed, against safe release and rollback.** Packs want to move any time; the engine moves only between events. So a pack can be newer than the engine. Settled: packs publish any time and the engine changes between events ([[qt:QT42]]); a pack that needs an ability this engine lacks is refused at publish with the ability named ([[qt:QT10]]); abilities are only ever added ([[qt:QT21]]).

**The designer's iteration speed, against running well at the size of a show and testable without the live show.** A trial copy on the show machine during a show shares the machine with the show. At a show a misbehaving trial is a risk the GM did not take. For the people maintaining the engine, two copies at once need isolation at the operating system's level. For an adopter, a one-machine kit. Settled: no trial copy or test run ever touches the live show ([[qt:QT11]], [[qt:QT27]]). Open: whether a trial copy runs on the show machine during a show at all. It becomes "Where the trial copy runs while a show runs".

**Easy to extend, against easy to understand and change.** The more a pack may declare, the more the engine interprets, and an interpreting engine is harder to read than a configured one. At a show a designer's rule misfires and the GM needs the off switch. For the designer, tables close the loop at every new mechanic; rules open it. For the people maintaining the engine, a rule format is a second language to version and test. For an adopter, no-developer companies want rules and developer companies want code. Settled: no word of ALN's inside the engine ([[qt:QT20]]); designers change pack data, never device code; a whole game is built without code ([[qt:QT12]]). Open: how far the pack goes, and how an extension for all games reaches a production. They become "What a game's maker may build inside the pack" and "How an extension for all games reaches a production".

**Easy to extend and platform parity, against standalone and offline and running well on small devices.** A mechanic declared in the pack must run on the hardware scanner too, and in a standalone game on the scanner alone. The scanner's firmware is small and updates by cable. At a show a scanner that cannot run a declared action shows nothing for it. For the designer, a mechanic that only phones can run breaks parity. For the people maintaining the engine, a rule runner in a small firmware. For an adopter with hardware scanners only, this decides which games they can run. Settled: parity in ability, not in screens; hardware scanner work waits on no game. Open: whether pack rules must run on a scanner alone. It is part of "What a game's maker may build inside the pack" and "What a standalone game gives up, and what it keeps".

**Standalone and offline, against easy to understand and change.** A standalone tablet is a second decider in the code base, beside the engine. Every fact decided in one place ([[qt:QT17]]) then means one place per game, not one place in the code. For the people maintaining the engine, two bodies of rules kept equal by tests, or one body run in two places. Settled: declared, never mixed, so one decider per game; the rules the engine and a standalone tablet share are a glossary entry, and whether they are one body or two kept equal is a later choice for the design rounds. No question for you.

**Safe release and rollback, against easy to extend and operating without technical help.** One written list of what the machine should carry, moved as one, meets devices that update by cable, adopters' fleets, and new device kinds that join by their pass. At a show a device at the wrong version. For the designer nothing. For the people maintaining the engine, one combination to test or a matrix. For an adopter, what they build against. Settled: the machine keeps one list and names any piece that differs ([[qt:QT41]]); replugging the old machine undoes a release ([[qt:QT42]]). Open: what happens to the piece that differs, and for how long an older piece works. It becomes "Release day: what must update together, and how long older devices work", with the section below.

**Privacy and access, against staying up through a live show.** Every request is checked against its pass, and a tablet must be back under its own name within five seconds after a drop, and devices must carry on when the old machine is replugged. So passes must survive reconnects, restarts and a machine swap without anyone logging in again mid-show. Settled both ways ([[qt:QT31]], [[qt:QT3]], [[qt:QT42]]); the design carries it. No question for you.

**Privacy and access, against the night told afterwards.** Game data stays on the kit, and the director's console reads the record on another computer. Settled: the owner moves the record; the console stays a separate program outside the engine ([[dec:the-night-s-record-and-the-after-game-article]], [[qt:QT30]]).

**Running well at the size of a show, against more than one copy, kit or pack and easy to extend.** The engine is sized for a few dozen devices on a small machine; two copies on one machine and an unknown number of phones both add load to that machine. Settled: a few dozen devices is the setting the panel gets ([[dec:what-the-architects-panel-sees-and-when]]); phones are measured before the first is admitted ([[qt:QT34]]). Open only through the trial copy's placement, above.

**Operating without technical help, against privacy and access.** The machine powers on straight into a running show with nobody at a terminal, and every connection presents a password or pass. So the kit must hold its own passes and the GM must log in once a night. Settled: staff who log in, such as the GM, hold the game's controls ([[qt:QT14]], [[qt:QT31]]); the design carries the rest.

**Testable without the live show, against easy to extend.** Every stand-in is compared with the real thing and every change runs on two games, so every added device kind, program or add-on comes with its stand-in and tests. Settled as a cost rule: a new program has a software stand-in ([[ex:EX15]], [[qt:QT26]]).

**Every screen telling the truth, against standalone and offline.** A missing engine must not read as a fault. Settled: a standalone game says standalone and every service the engine runs reads not installed tonight, grey ([[qt:QT37]]).

---

## Release day

You said yes, generally, to everything updating together, and asked what the question means in practice and how it affects the design and the build, especially in the long term after the new engine runs ALN. This section is that explanation. The question it leads to is "Release day: what must update together, and how long older devices work" above.

### What the two phrases mean

"Everything updates together" means one release moves the engine, the GM tablet's app, the phones' page, the hardware scanners' firmware and the protocol between them, and the engine refuses anything at another version. "Older versions keep working with a newer engine" means the engine accepts a device or a pack from an earlier release for a stated time, and the protocol is built so that it can.

### Today, piece by piece

The GM tablet's app. The engine serves it, so a tablet that reloads after the engine is updated gets the new app. But a tablet that was open before the update, or one holding the app in its browser's cache, keeps running the old app against the new engine until it reloads. At connection the tablet sends its app version and the fingerprint of the pack it loaded; the engine records the version and does nothing with it, and writes a pack mismatch to its log only ([[flaw:C12]]). The list of messages the tablet listens for is kept by hand in the tablet's code; a message the engine adds and the tablet does not know never arrives, with no error ([[flaw:C14]]).

The phones' page. In a networked game the engine serves it too, from a copy placed in the engine's public folder. The page caches itself under a name that must be changed by hand to make phones refresh; the token data is fetched fresh on every load.

The hardware scanners. Their firmware changes only by cable; the board's partition leaves no room for an update over the air. Their token list, pictures and sounds sync at boot from the engine. So a hardware scanner is the device most likely to be older than the engine. It reads the engine's wrapped token file, not the pack's own file; a change to that format breaks every scanner that was not flashed.

Packs. They are published separately, at any time. The engine's check refuses a pack whose format version does not match exactly, a pack that requires an ability the engine lacks, and a pack that names a minimum engine version the engine does not meet. The GM tablet applies only the exact format check and reads neither the required abilities nor the minimum engine version. The phone's standalone copy of the pack is a pinned copy inside its own repository.

The protocol. Today there are two written lists (web requests and live messages), the pack's formats and the venue profile's format, checked by a few tests; every program copies the names by hand.

So today nothing enforces "together" and nothing promises "older works". Mixtures happen silently: a rollback can leave the machine running pieces from two releases ([[flaw:C15]]), and a tablet at the wrong version is a log line.

### In the long term

Once the new engine runs ALN, your kit updates between events ([[qt:QT42]]): build the new machine, check it against one written list of what it should carry ([[qt:QT41]]), rehearse, swap by replugging ([[ex:EX17]]). The pieces that can still lag behind the engine on a show night are the hardware scanners (cable), tablets that did not reload, pinned standalone copies, and packs published later than the engine. The published protocol is what makes each of these either refused or tolerated.

Once other productions adopt the engine, they have their own release pace, their own fleets of cable-updated devices, and perhaps add-ons or forks (the question "How an extension for all games reaches a production"). They build against the protocol and the pack format, which the record already calls what other people build against ([[dec:one-published-protocol-and-an-outside-test-bench]]). For them, a protocol that may change shape at every release with no window is a reason not to adopt, or to fork and freeze. A protocol with a window is a promise you must keep for years.

### How the answer changes the protocol's design and the build

If everything updates together. The protocol has one version number for the whole release. Messages may change shape freely between releases, since no two versions ever meet. The engine refuses any device whose version differs, and the GM's tablet names it; [[qt:QT41]] today says the mismatch is shown, and under this answer it is refused rather than warned. Code on every side is generated from one definition per release. The test bench tests one combination. The hardware scanners must be at the release before the show. That means either a cable step on the pre-show checklist for every scanner at every release, or a firmware update over the kit's network at boot, the way assets sync today, which the design rounds would have to add and which has its own cost (a flash layout with room for two images, a fallback that cannot leave the board unable to start). Packs keep the rule already settled: abilities are only added, so an old pack runs on a new engine and a new pack is refused on an old engine with the ability named.

If older devices keep working for a window. Every message carries its version. Inside the window changes are additive: fields are added, never removed or renamed, and a device ignores what it does not know. The engine accepts the current version and a stated number of earlier ones and tells the GM which devices are behind. The test bench runs the engine against each supported device version, a matrix that grows with the window. A written rule says when a version is dropped (after so many releases, or so many months), and the version mark says it. The hardware scanner's part of the protocol can be kept narrower and more stable than the tablet's: it asks for little (a token list, one scan, a batch of scans, the engine's health, its assets), so changing it rarely is cheap.

The mixed answer. The engine forces a stale tablet or phone app to reload, so nothing the engine serves is ever at another version. Cable-updated devices and packs get the window. This is the shape your "generally speaking, yes" suggests, with the hardware scanner as the exception that anyone with a fleet of them needs.

### The options with their costs

Everything together: the least to build and keep, the simplest protocol, and show-night work at every release for every cable-updated device, for you and for every adopter. A window for everything: the most freedom for adopters and a test matrix and a deprecation schedule kept forever. Together for what the engine serves and a window for the rest: a small, stable scanner protocol, a forced reload for served apps, and cable visits when you choose. The question above asks you which, how long the window is, and whether a mismatch refuses or warns.

---

## What the 2026-11-02 decisions raise, and where each landed

From "No technical failure stops a game": the short cut-off became "A GM tablet cut off from the engine"; the machine that does not come back, and its meeting with "Standalone games: declared, never mixed", became "The show machine fails mid-game", which asks whether a game may be re-declared once.

From the standalone purpose: the shapes became "Which standalone games the engine must run"; what a standalone game drops became "What a standalone game gives up, and what it keeps".

From the hardware decision and "The engine says what is fixed and what each production sets": what you must say now (the first release's fixed list, the GM's station, an engine on a GM's device) and what the rounds propose (the seams, the stand-ins, the roadmap's named requirements per readiness state) are both in "Which hardware the first new engine requires, and what it must allow replacing". The numbers themselves are in the dropped list below.

From "Two kinds of game extension": the two questions you named open became "What a game's maker may build inside the pack" and "How an extension for all games reaches a production".

---

## Questions considered and dropped

Each with the test it failed. A dropped question is not lost: the agent's calls go on the Decisions page as the agent's calls, with reasons, so you can overrule any; design choices go to the design rounds.

- Which numbers are the engine's fixed requirements and which are ALN's settings (devices and phones per kit, power-on to a running show, kit set-up time, publish to playing, how long records are kept, a scanner's first sync). Failed the first test for most of them: a limit the engine is sized for is measured, not decided, and a production's numbers are that production's settings, which your comment says the engine should be agnostic about. Failed the fourth test for the rest: the panel's setting already carries "a few dozen devices", and the other numbers are build and test targets, not top-level design. The reading that the numbers split into the engine's limits and each production's settings, with ALN's as the first set, stays a reading for you to confirm, not a question.
- Record every refused GM scan attempt. Failed the fourth test: the design holds either way, since a record can grow a column later; the agent's view (yes, record every attempt and show it nowhere until a feature needs it) is on the record as the agent's call.
- Are these the right ten promises, and the seven wording questions on them. Failed the first test: how the requirements are worded and grouped is the agent's to propose and yours to overrule, per [[dec:the-decisions-page-holds-only-your-decisions]]; they are offered for review.
- The three questions on the panel (what the blind round gets, which decisions bind it, whether the second round reads the code). Failed the first test as stated here: they are about how the pass runs, not what the product must do. They stay as the approval of the panel's brief, which you said is critical, on the Design page.
- Is the missing standalone declaration a seventeenth design flaw. Failed the first test: the flaw list is the agent's analysis; the eight findings behind it are test situations whichever home they get.
- Where "this game is standalone" is declared (the venue profile, the pack, the game's record or each device). Failed the first test: it is how to build it; the record already sends it to the authority round.
- How a standalone tablet runs its game (the same parts the engine runs, or an engine of its own). Failed the first test: a design choice, listed among the later choices; the shapes question above gives it the product fact it needs.
- Whether paper documents join the pack, with "unlocked" recorded during play. Failed the third and fourth tests: it does not change any of the six decisions ahead, and the record keeps it for the extension round at your word.
- How many player phones one kit carries. Failed the first test: it is measured before the first phone is admitted ([[qt:QT34]]); the setting gives the panel the scale.
- Whether players' phones come in the first new engine or later. Failed the second test: the roadmap places them in the players' phones block and the record stands.
- Whether the hardware scanner plays standalone games. Failed the second test: answered on 2026-11-02 by your words "player scanners (phone or hardware)".
- Who the first adopters are, and when. Failed the second test: the roadmap's final outcome and readiness states settle the order (one production now; adoptable at the release block), and no date governs the work.
- Whether the engine must serve several productions from one machine or from the cloud. Failed the second test: one kit per production, with a second kit cheap to start, is the roadmap's standing constraint; the test bench already runs on a cloud machine without that being a product.
- Which clock stamps a fact (the tablet's or the engine's). Failed the first test: a design choice; the two clocks are a finding under [[flaw:C9]].
- Whether the TV may keep counting when the engine is silent. Kept, but not on its own: it is part of what the players may lose in "The show machine fails mid-game", since alone it would fail the third test.
- Whether the engine must refuse a device whose pack differs from its own, or warn. Kept inside the release-day question rather than on its own; alone it is one case of the version rules.
- Which qualities win in general. Not a question that can be answered in general. The section "Where the qualities pull against each other" names the specific conflicts; the open ones are the questions above, the settled ones are marked with their direction.
