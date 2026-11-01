# Vocabulary pass, engine shape data (decision 27)

Date: 2026-11-01. File: `docs/plans/architecture-pass/report/2026-11-01-engine-shape.json`, the page data for "How the promises fit together".

Rule applied: "job" is retired for "promise"; parts keep promises and flaws break them; the person fitting the kit is the venue technician; promises are referred to by title only, never by number. Mechanisms' plain texts keep their one-sentence definition followed by the "Today" text (the builder shows the text after the first sentence on a part's card). `questionNotes` and `ownerChoices` are untouched (not shown on the page). The node lines of `relationsMermaid` are untouched (the builder relabels them from the titles). The five `functional[].people`/`.need` rows below are not read by the builder; they are changed so the file's record of the promises carries the same word.

| Where | Before | After |
|---|---|---|
| functional[J8].proposedTitle | Fit the game to the venue it is in tonight | The game fits the venue it is in tonight |
| functional[J7].need | The GM alone can start, pause, end and change scores, and the engine knows which tablet did it; the audience sees scores and exposed evidence and nothing else; a player sees the memory they scanned; designers and installers reach their tools and only those; a stranger sees nothing. | The GM alone can start, pause, end and change scores, and the engine knows which tablet did it; the audience sees scores and exposed evidence and nothing else; a player sees the memory they scanned; designers and venue technicians reach their tools and only those; a stranger sees nothing. |
| functional[J8].people | The venue installer; a GM running a game with no engine; a future operator with a second kit | The venue technician; a GM running a game with no engine; a future operator with a second kit |
| functional[J8].need | The installer states what the kit brings tonight, binds the pack's names to real instruments and gets one go or no-go. A standalone game knows it is standalone instead of mourning a lost connection. A second kit needs no change to engine code. | The venue technician states what the kit brings tonight, binds the pack's names to real instruments and gets one go or no-go. A standalone game knows it is standalone instead of mourning a lost connection. A second kit needs no change to engine code. |
| functional[J9].people | The GM mid-show with seconds to decide; the installer reading the preflight; the audience watching the clock | The GM mid-show with seconds to decide; the venue technician reading the preflight; the audience watching the clock |
| functional[J9].need | Anyone can tell without asking whether what they see is current and whether they must act: red means act now, grey means absent on purpose, old looks old, the installer's go is a go, and the TV's clock never counts on its own. | Anyone can tell without asking whether what they see is current and whether they must act: red means act now, grey means absent on purpose, old looks old, the venue technician's go is a go, and the TV's clock never counts on its own. |
| qualities[3].plain (Who decides when there is no engine) | Every rule says who decides when there is no engine, and a standalone game is a declared fact, never mixed. Carried by hosting the same record, lifecycle and answering modules on the tablet, with the declaration held wherever the owner places it; the installer's profile is the candidate favoured here. | Every rule says who decides when there is no engine, and a standalone game is a declared fact, never mixed. Carried by hosting the same record, lifecycle and answering modules on the tablet, with the declaration held wherever the owner places it; the venue technician's profile is the candidate favoured here. |
| today.tangles[11].plain (Shallow chains and thick doors) | Skip video crosses five tablet modules to reach one deep one; one command dispatcher serves six jobs; the player scan route decides token existence, session existence and video eligibility inline and holds a batch cache lost at restart; the engine's wiring is written by hand at about ten sites, and one of them already left music out. | Skip video crosses five tablet modules to reach one deep one; one command dispatcher serves six promises; the player scan route decides token existence, session existence and video eligibility inline and holds a batch cache lost at restart; the engine's wiring is written by hand at about ten sites, and one of them already left music out. |
| parts[P12].plain (Venue fit) | The installer's profile: what the kit brings tonight, which real instrument each of the pack's names binds to, whether the engine starts or adopts each program, how many stations and remote displays to expect; and, if the owner places it here, the declared fact that a game runs with no engine. | The venue technician's profile: what the kit brings tonight, which real instrument each of the pack's names binds to, whether the engine starts or adopts each program, how many stations and remote displays to expect; and, if the owner places it here, the declared fact that a game runs with no engine. |
| componentsMermaid (CT label) | flowchart LR
  BE["Backend on the show machine: pack channel serve, game record authority, answering, night's record, delivery, connections, equipment, show runner, verdict, lifecycle, venue fit, engine instance, rules as a library"]
  GM["GM tablet, networked: screens, rules library, pack client with its stamp, the client side of answering and delivery"]
  GS["GM tablet, standalone: screens, rules, pack client, game record, lifecycle, local answering, local delivery, a local night's record, the standalone declaration, and small stand-ins for connections, equipment, the show runner, the verdict and the engine's names"]
  PH["Phone and hardware scanner: screens, pack client with its stamp, reply words as data, rules as data, the standalone declaration read"]
  SB["Scoreboards, TV and Pi 4: screens under a display pass, and the TV's browser is also an equipment adapter on the backend"]
  CT["Config tool: design studio, rules for validation, pack publish, verdict badges on paper, the installer's venue fit editor, a preview instance, release"]
  TS["Tests, CI and the rig: joins and proofs on their own engine instance, equipment stand-ins, two packs"]
  PK["Pack data: rules as data, the published pack, the needs"]
  CT -->\|"publish, apply, rehearse by message"\| BE
  GM -->\|"requests in one envelope, facts out with labels"\| BE
  PH -->\|"scans in one envelope, replies as words"\| BE
  SB -->\|"facts with labels, filtered by role"\| BE
  PK -->\|"adopted through the pack channel"\| BE
  PK -->\|"the same pack, stamped"\| GS
  TS -->\|"its own instance, never the live one"\| BE | flowchart LR
  BE["Backend on the show machine: pack channel serve, game record authority, answering, night's record, delivery, connections, equipment, show runner, verdict, lifecycle, venue fit, engine instance, rules as a library"]
  GM["GM tablet, networked: screens, rules library, pack client with its stamp, the client side of answering and delivery"]
  GS["GM tablet, standalone: screens, rules, pack client, game record, lifecycle, local answering, local delivery, a local night's record, the standalone declaration, and small stand-ins for connections, equipment, the show runner, the verdict and the engine's names"]
  PH["Phone and hardware scanner: screens, pack client with its stamp, reply words as data, rules as data, the standalone declaration read"]
  SB["Scoreboards, TV and Pi 4: screens under a display pass, and the TV's browser is also an equipment adapter on the backend"]
  CT["Config tool: design studio, rules for validation, pack publish, verdict badges on paper, the venue technician's venue fit editor, a preview instance, release"]
  TS["Tests, CI and the rig: joins and proofs on their own engine instance, equipment stand-ins, two packs"]
  PK["Pack data: rules as data, the published pack, the needs"]
  CT -->\|"publish, apply, rehearse by message"\| BE
  GM -->\|"requests in one envelope, facts out with labels"\| BE
  PH -->\|"scans in one envelope, replies as words"\| BE
  SB -->\|"facts with labels, filtered by role"\| BE
  PK -->\|"adopted through the pack channel"\| BE
  PK -->\|"the same pack, stamped"\| GS
  TS -->\|"its own instance, never the live one"\| BE |
| alternatives[0].title | Getting state onto screens: one part or each job's own piece | Getting state onto screens: one part or a delivery per promise |
| alternatives[0].b | Each job delivers its own facts: the game record keeps its broadcasts and snapshot, equipment keeps its own pushes, with only a shared envelope. | The parts behind each promise deliver their own facts: the game record keeps its broadcasts and snapshot, equipment keeps its own pushes, with only a shared envelope. |
| alternatives[0].cost | The candidate needs every part that decides a fact to offer it in one shape, and one store on every screen that holds any fact; it is the only form in which C2, C6 and C10 are removed once. The other way needs less agreement and keeps each job's delivery local, but C6 and C2 recur per job and the check that every screen shows each fact's label stays a repeated audit. | The candidate needs every part that decides a fact to offer it in one shape, and one store on every screen that holds any fact; it is the only form in which C2, C6 and C10 are removed once. The other way needs less agreement and keeps each promise's delivery local, but C6 and C2 recur per promise and the check that every screen shows each fact's label stays a repeated audit. |
| alternatives[4].title | J3: one part or two | The tap's answer and the night's record: one part or two |
| alternatives[4].cost | Two parts match two people and two moments and give the night's record one input and one reader; they cost a second part with no behaviour today and, if it becomes a job, a job no flaw has as its main home. One part keeps the job sentence whole but puts the record writer beside the reply, which share nothing. | Two parts match two people and two moments and give the night's record one input and one reader; they cost a second part with no behaviour today and, if it becomes a promise of its own, a promise no flaw mainly breaks. One part keeps the promise's title whole but puts the record writer beside the reply, which share nothing. |
| alternatives[7].title | Release day: under J10, or under J8's deploy chain | Release day: its own part beside the developer's proof, or in venue fit's deploy chain |
| alternatives[7].a | Release as its own small part serving J10's release-day half. | Release as its own small part: the owner's release-day half of proving a change before it reaches anyone. |
| alternatives[7].b | Release folded into venue fit's Deploy stage, the installer's handoff. | Release folded into venue fit's Deploy stage, the venue technician's handoff. |
| alternatives[7].cost | Both place C15. The candidate keeps the owner's cutover decision beside the developer's proof; the other way puts the installed-pieces check where the installer already works. It is a wording choice. | Both place C15. The candidate keeps the owner's cutover decision beside the developer's proof; the other way puts the installed-pieces check where the venue technician already works. It is a wording choice. |

Strings read: 204. Strings changed: 19.
