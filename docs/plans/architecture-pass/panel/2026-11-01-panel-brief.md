# The panel's brief: what the three architects see, and when

Draft for the owner, 2026-11-01. Revised 2026-11-02 for the owner's
decisions of that day: no technical failure stops a game; the purpose of
standalone games; the engine is hardware-flexible and the roadmap sets
the bounds; two kinds of game extension; the engine says what is fixed
and what each production sets. Revised 2026-11-10 after the independent
review the owner asked for before answering. Not yet approved. The panel
does not run until the owner has answered the question “What the panel
gets in its blind round”, reviewed the requirements and approved this
brief.

The independent panel proposes the engine's top-level design before the
first design round (decision “Independent architects propose the
top-level design”). The owner said the context the panel gets is
critical, so this brief comes to the owner before the panel runs. It
follows the decision “What the architects' panel sees, and when”. Of
the choices that decision leaves open, one is the owner's: what the
blind round gets. The lenses, the step in which each architect lists the
decisions before seeing the agenda, and whether the second round reads
today's code are calls of the agent running the pass, told to the owner
at the end, who can overrule them (the decision “The Decisions page
holds only your decisions”).

## Who is on the panel

Three architects. Each is a fresh AI agent on the strongest model
available. None has seen this program's conversations or its planning
documents, and none sees another's work until the second round. Each has
one lens, so that the three proposals differ:

1. **State, authority and keeping the game going through a failure.**
   How a live game's facts are held, changed, ordered and recovered
   across the show machine, the tablets, the phones and the hardware
   scanners, on a network that drops, with standalone games included;
   how the engine drives outside programs that crash, hang or answer
   late; and how the game carries on, and the GMs know their fallbacks,
   when a connection, a device or the show machine fails (the decision
   “No technical failure stops a game”).
2. **Growth and extension.** How designers, venue technicians and
   outside developers extend the platform: games as packs, venues as
   profiles, the two kinds of game extension (a mechanic the game's
   maker builds from what the engine can already do, inside the game;
   an ability a developer adds once for every game), new kinds of
   screen, device, hardware and outside program, the published protocol
   as what other people build against, what is fixed and what each
   production sets, and whether an add-on runs inside the engine or as
   a separate program whose failure cannot stop the engine (the
   decisions “Two kinds of game extension”, “The engine is
   hardware-flexible; the roadmap sets the bounds” and “The engine says
   what is fixed and what each production sets”).
3. **Living with it.** How one owner and AI agents keep the engine easy
   to understand, change, test and release for years: how small and
   clear each piece is, and how a change is made, tested on the test
   bench and shipped with no risk to a show.

A lens says where an architect looks hardest. Every architect still
answers to every requirement.

The three run on the same model and read the same folder. They are
independent in what they have read, not in habit. What each is asked to
write, below, is there to make the three designs differ in kind and to
show what each leaves out.

## The blind round

Each architect gets one prepared folder and nothing else:

- **The goal**, in the owner's words: “design a long-term optimal
  architecture for our engine that makes it intuitive and easy to
  maintain, continue development on, and extend”.
- **The requirements**, as the owner leaves them after review: the ten
  promises; the quality targets, each number sorted as the engine's
  requirement or limit, a production's setting (ALN's given as the
  first set) or a technical default, a sorting the agent running the
  pass made and marked as its own; the extension cases, each marked
  as one of the two kinds of extension or neither; the standing rules.
  Each target and case says whether the owner settled it, partly
  settled it or the agent proposes it. Where a target or a case notes
  how today's engine behaves, the note sits in a field of its own,
  “today”. The folder leaves that field out, because today's engine is
  withheld from this round. The second round gets the notes back.
- **The setting**, as facts. ALN's kit is the first production's
  hardware, given as facts and not as the engine's requirements (the
  decision “The engine is hardware-flexible; the roadmap sets the
  bounds”):
  - ALN's show is one game of about two hours at one venue, with a few
    dozen devices: GM tablets, players' phones, hardware scanners, a TV,
    speakers and lights.
  - ALN's show machine is one Raspberry Pi 5 at the venue, running
    Raspberry Pi OS. It drives a TV over HDMI and the room's sound, and
    it must go from power-on to a running show with no technician.
  - ALN's room has these outside programs: a video player, a music
    player, the sound system with Bluetooth speakers, and the venue's
    lighting controller. The engine drives them. Any of them can crash
    or be missing.
  - ALN's devices: GM tablets (Android tablets running Chrome, for
    staff only, sometimes offline); players' own phones (a web page,
    with no install and no accounts); hardware scanners (small boards
    with an NFC reader, a small screen, an SD card and Wi-Fi, whose
    firmware is updated by cable); NFC tokens. If the owner expects to
    use a device soon that is not in ALN's kit, such as iPads or
    laptops for GMs, this line names it before the folder is built.
  - The roles ALN's devices have today (the decision “The role question
    starts from settled roles”): the player scanners show a token's
    content and report the scan, with no scoring and no live game feed;
    the GM scanner is the command center; the scoreboards show the
    public results. These are ALN's facts and the place where the
    question of what each device receives starts. The requirements
    already ask more of a player's device in other games.
  - ALN's network is the venue's local Wi-Fi. It can drop at any
    moment. No internet is assumed during a show.
  - Phones and tablets let a web page read NFC tokens or use the camera
    only over a secure connection. Today the kit uses a certificate it
    made itself, so each staff device shows a warning that a GM accepts
    once, and the hardware scanner does not check the certificate.
    Players cannot be asked to accept a warning. The roadmap gives the
    kit a public name and a certificate that browsers trust, with the
    players' phones block.
  - ALN's content is written in Notion today and exported into the
    pack. Its media files (images, audio, video) are large and live
    beside the pack.
  - The mature engine is meant to be flexible about hardware; the
    current roadmap sets the bounds, and the architects may propose
    where the line falls. Another production may bring a different
    game, venue and kit, and must be able to find what is fixed and
    what it may set (the decision “The engine says what is fixed and
    what each production sets”).
  - The people: one owner, who designs the games and runs the shows and
    is not an engineer; development by the owner with AI agents, so
    every piece must be easy for an agent to read and change safely; a
    future open-source community, and other productions.
- **The owner's decisions that bind any design** (see “What the blind
  round gets”, below): one published protocol and an outside test
  bench; standalone games declared, never mixed, with the purpose the
  owner stated on 2026-11-02; the four words for the game's live facts;
  the night's record and the after-game article; and the owner's four
  decisions of 2026-11-02: no technical failure stops a game; the
  engine is hardware-flexible and the roadmap sets the bounds; two
  kinds of game extension; the engine says what is fixed and what each
  production sets. Each goes to the panel in the owner's own words from
  the decision record.
  - The decision “The role question starts from settled roles” is left
    out of this list. It describes ALN's devices as they are today, so
    it goes in the setting, as ALN's facts. The owner can say that it
    must bind every design.
  - An open question of the owner's goes to the panel as its “What it
    decides” paragraph only, without the agent's options or
    recommendation. The reason is the owner's decision that the
    recommendations of the agent running the pass are withheld from the
    panel. An answer the owner gives before the panel runs binds the
    panel.
  - A reading of the owner's words that the owner confirms goes to the
    panel as the owner's decision. One the owner refuses is taken out
    of the requirements and this brief before the panel runs. One left
    unanswered goes to the panel as an open question, and where a
    requirement's status names it, the status marks it as a reading for
    the owner to confirm.
  - One reading is already inside a requirement: that a device going
    down includes the show machine is in the target “The GMs know their
    fallbacks at a failure”. It goes to the panel marked as the agent's
    reading until the owner answers.
  - The sorting of the quality targets' numbers reaches the panel
    through the requirements, marked as the agent's call.
- **The six decisions ahead, as the agenda** (see “What the blind round
  gets”, below): how the engine holds the game's state; the published
  protocol's form; where authority lives across devices, offline and
  standalone included; how games and venues extend the engine; how one
  engine runs as many separate copies; how today's engine moves to the
  new design.
  - Each architect first writes their own list of the hardest decisions
    to reverse, from the goal, the requirements, the setting and the
    owner's decisions. Only then do they open the six, say where their
    list differs and why, and write their design.
  - An architect may add, split or merge decisions and must say why.
    Each architect also says whether they would merge or reorder any of
    the six, and why. The first and the third both decide who decides a
    fact. A change to the owner's list comes back to the owner with the
    synthesis.
  - The decision on how games and venues extend the engine has two
    parts, each with its own designs: what a game and a venue declare
    (the pack, the venue profile, a production's settings, the check at
    publish); and where a developer adds to the engine, and how an
    addition ships.
  - The last one waits for the second round, where today's engine is
    known.
  - If the owner says yes to the seventh decision the agent proposes
    under “What the panel gets in its blind round”, “How the engine
    drives the room”, it joins the agenda after where authority lives.

Each architect writes a top-level design, decision by decision: the
choice; one or two alternatives they rejected, with the cost of each,
and for the decisions on the game's state and on extension one rejected
alternative that differs in kind; a table of how the design keeps each
promise, meets each quality target and allows each extension case,
naming any it cannot meet; for each kind of failure mid-show (one
tablet's connection, the kit's whole network, a device that dies, the
show machine, an outside program), what the GMs can still do and how
the game carries on; its riskiest assumption; and the trial run, a
throwaway prototype, that would test that assumption fastest.

Each design also says:

- on which devices the game's rules and its record run, and whether one
  body of rules serves the show machine, a standalone tablet and a
  failure;
- how each kind of device and each kind of staff gets its pass and
  loses it;
- what the design leaves out and which requirement that costs;
- for each mechanism, what must be kept working or kept equal for years
  because of it;
- any requirement that says how to build something and not only what is
  needed, and the need behind it;
- the largest kit the design carries on ALN's show machine before it
  needs rework, and what gives way first;
- what keeping phones and hardware scanners equal in ability costs the
  design;
- its own time from power back to a running game, because that time
  decides whether a restart is fallback enough.

## The second round: meeting today's engine

After the blind round, each architect also gets:

- **Today's engine, as facts:** a fact sheet of what runs where, in
  what language, and what works today; the code with its component
  guides, to read but not change; and the requirements' notes on
  today's behaviour, which the blind round's folder left out.
- **The sixteen design flaws, as test situations:** what goes wrong at
  a show, the problems behind it and where in today's code they sit,
  with no fix attached.
- **The other two proposals, and the earlier candidate** (the 17-part
  design drawn bottom-up from today's engine) as one more proposal.

Each architect tests every proposal (their own, the other two and the
earlier candidate) against the sixteen situations and today's facts:
which situations it removes, which it leaves, and what moving today's
engine to it would cost. They critique the others, then revise their
own design and say what changed and why. The second round also gives
the last decision ahead its real options: rebuild beside today's
engine, change it in place piece by piece, or a mix.

## The synthesis

One more agent, who proposed nothing, reads all of it and writes, for
each decision ahead: the options the panel found, their costs, what
moving today's engine to each would cost, where the architects agreed
and where they did not, the trial runs worth doing before choosing, and
the questions only the owner can answer. Where an architect would
merge, reorder or add a decision, the synthesis says so, and the change
to the owner's list comes to the owner as a question. A checker reads
the synthesis against the proposals, refute-by-default, and corrects
anything it misstates or leaves out. The synthesis becomes the agenda
of the first design round.

## What is withheld, and how

Withheld from the blind round: the recommendations and leading guesses
of the agent running the pass, among them its options and
recommendations on the owner's open questions; the earlier candidate
(it enters the second round as one more proposal); the earlier lists of
design choices; today's engine and its review, with the requirements'
notes on today's behaviour. Withheld from both rounds: the reasoning of
the agent running the pass, the review's conclusions about fixes, and
the candidate's table of alternatives.

How: the prepared folders are built by a script from the sources (the
requirements files, the standing rules, the decision record). For the
blind round the script leaves out the field “today” of every target and
case, and writes each open question as its “What it decides” paragraph
only. Each architect is told to read only its folder, plus the code in
the second round, and never the planning folder. Nothing technical
stops an agent from opening a file it was told to leave alone, so the
synthesis's checker also looks for traces of withheld material in every
proposal.

## What the owner gets back

The synthesis, as a page on the owner site: one section per decision
ahead, with the options side by side, their costs, where the architects
agreed and disagreed, the trial runs and the owner's questions, among
them any change the architects propose to the owner's list of
decisions. The six proposals (three from each round) stay in the
repository in full.

## Size and cost

About eight agents: three in the blind round, three in the second round,
the synthesis and its checker. It takes two to three hours and several
million tokens, about the size of one of the larger site workflows.

## The owner's question, and the agent's calls

**What the blind round gets: also the decisions the owner made that bind
any design, and the six decisions ahead as its agenda? And does a
seventh decision, “How the engine drives the room”, join that agenda?**
This is the owner's question: the decision on what the panel sees lists
only the goal, the requirements and the setting, and adding to it
changes that decision. The binding list holds the owner's four
decisions of 2026-11-02 as well, and no longer holds the settled roles,
which go in the setting. Recommendation: yes to both. The binding
decisions are the owner's, not the reasoning of the agent running the
pass, and a panel without them would propose designs already ruled out,
among them a game that pauses at a lost connection. The cost: the
agenda frames the architects' thinking, so each first writes their own
list and they are told they may change the agenda. On the seventh
decision: about four lines in ten of the program on today's show
machine drive the room, none of the six decides how, and one of the
nine questions the pass answers, how the engine reads the programs it
drives, had no decision of its own. If the owner says no, the list
stays at six and the room's state stays part of the first decision. The
owner can also give the panel the binding decisions and no agenda.

**The three lenses** (the agent's call, told to the owner, who can
overrule it). Three architects: state, authority and keeping the game
going through a failure, with how the engine drives outside programs;
growth and extension, naming hardware flexibility, both kinds of
extension and where an add-on runs; living with it. Why: the owner
called pausing a game for a failure “the worst possible scenario”, so
the state lens names keeping the game going, with the decision “No
technical failure stops a game” as its first test. Each architect is
also asked for what the design leaves out, what each mechanism costs to
keep for years, one rejected alternative that differs in kind, and the
other items listed under “The blind round”, so that the three designs
differ in kind and each shows what it leaves out. Naming a subject in a
lens costs nothing, while a fourth architect costs two more agents and a
longer synthesis, and three is the owner's decision. The owner's ruling
that how the panel runs is the agent's call is “The Decisions page holds
only your decisions”.

**Each architect lists the decisions before seeing the agenda** (the
agent's call, told to the owner, who can overrule it). It applies if
the owner gives the blind round the agenda. Why: the six are how the
agent running the pass divided the problem, and the owner approved them
on 2026-11-01. A panel that starts from them answers inside that
division. One more step for each architect shows whether three
outsiders would divide it the same way.

**The second round reads the code** (the agent's call, told to the
owner, who can overrule it): a fact sheet first, then the code and its
component guides, to read only. The owner's decision gives the second
round today's engine as facts and does not say in what form; the form
is method. The cost: the code can pull a design toward small changes to
today's engine, so the architects revise their own blind proposals
rather than start again from the code.

**Anything else: is anything missing from what the panel sees, or
anything it should not see?** One line from the owner helps before the
folder is built: any device the owner expects to use soon that is not
in ALN's kit, such as iPads or laptops for GMs. The setting's line on
ALN's devices then names it.
