# The panel's brief: what the three architects see, and when

Draft for the owner, 2026-11-01, revised 2026-11-02 for the owner's
decisions of that day: no technical failure stops a game; the purpose of
standalone games; the engine is hardware-flexible and the roadmap sets
the bounds; two kinds of game extension; the engine says what is fixed
and what each production sets. Not yet approved; the panel does not run
until the owner approves it and has reviewed the requirements.

The independent panel proposes the engine's top-level design before the
first design round (decision "Independent architects propose the
top-level design"). The owner said the context the panel gets is
critical, so this brief comes to the owner before the panel runs. It
follows the decision "What the architects' panel sees, and when". Of
the choices that decision leaves open, one is the owner's: what the
blind round gets. The lenses and whether the second round reads today's
code are calls of the agent running the pass, told to the owner at the
end, who can overrule them (the decision "The Decisions page holds only
your decisions").

## Who is on the panel

Three architects. Each is a fresh AI agent on the strongest model
available. None has seen this program's conversations or its planning
documents, and none sees another's work until the second round. Each has one
lens, so that the three proposals differ:

1. **State, authority and keeping the game going through a failure.**
   How a live game's facts are held, changed, ordered and recovered
   across the show machine, the tablets, the phones and the hardware
   scanners, on a network that drops, with standalone games included;
   and how the game carries on, and the GMs know their fallbacks, when
   a connection, a device or the show machine fails (the decision "No
   technical failure stops a game").
2. **Growth and extension.** How designers, venue technicians and
   outside developers extend the platform: games as packs, venues as
   profiles, the two kinds of game extension (a mechanic the game's
   maker builds from what the engine can already do, inside the game;
   an ability a developer adds once for every game), new kinds of
   screen, device, hardware and outside program, the published protocol
   as what other people build against, and what is fixed and what each
   production sets (the decisions "Two kinds of game extension", "The
   engine is hardware-flexible; the roadmap sets the bounds" and "The
   engine says what is fixed and what each production sets").
3. **Living with it.** How one owner and AI agents keep the engine easy
   to understand, change, test and release for years: how small and
   clear each piece is, and how a change is made, tested on the test
   bench and shipped with no risk to a show.

A lens says where an architect looks hardest. Every architect still
answers to every requirement.

## The blind round

Each architect gets one prepared folder and nothing else:

- **The goal**, in the owner's words: "design a long-term optimal
  architecture for our engine that makes it intuitive and easy to
  maintain, continue development on, and extend".
- **The requirements**, as the owner leaves them after review: the ten
  promises; the quality targets, each number sorted as the engine's
  requirement or limit, a production's setting (ALN's given as the
  first set) or a technical default, a sorting the agent running the
  pass made and marked as its own; the extension cases, each marked
  as one of the two kinds of extension or neither; the standing rules.
- **The setting**, as facts. ALN's kit is the first production's
  hardware, given as facts and not as the engine's requirements (the
  decision "The engine is hardware-flexible; the roadmap sets the
  bounds"):
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
    firmware is updated by cable); NFC tokens.
  - ALN's network is the venue's local Wi-Fi. It can drop at any
    moment. No internet is assumed during a show.
  - ALN's content is written in Notion today and exported into the
    pack. Its media files (images, audio, video) are large and live
    beside the pack.
  - The mature engine is meant to be flexible about hardware; the
    current roadmap sets the bounds, and the architects may propose
    where the line falls. Another production may bring a different
    game, venue and kit, and must be able to find what is fixed and
    what it may set (the decision "The engine says what is fixed and
    what each production sets").
  - The people: one owner, who designs the games and runs the shows and
    is not an engineer; development by the owner with AI agents, so
    every piece must be easy for an agent to read and change safely; a
    future open-source community, and other productions.
- **The owner's decisions that bind any design** (see "What the blind
  round gets", below): one published protocol and an outside test
  bench; standalone games declared, never mixed, with the purpose the
  owner stated on 2026-11-02; the four words for the game's live facts;
  the night's record and the after-game article; the settled roles of
  the scanners and screens; and the owner's four decisions of
  2026-11-02: no technical failure stops a game; the engine is
  hardware-flexible and the roadmap sets the bounds; two kinds of game
  extension; the engine says what is fixed and what each production
  sets. Each goes to the panel in the owner's own words from the
  decision record. Two of the agent's readings of those words that the
  record marks to be confirmed (that a tablet keeps taking scans while
  disconnected; that a standalone game may have no GM tablet) are
  withheld; the panel gets the open questions instead. The requirements
  the panel gets state only what the owner settled and name the open
  questions. Two readings reach it, each marked as the agent's: the
  sorting of the numbers, in the requirements; and that the design must
  say how a networked game carries on if the show machine fails, through
  the target "The GMs know their fallbacks at a failure" and the
  failures each architect must answer for, beside the owner's question
  "The show machine fails mid-game".
- **The six decisions ahead, as the agenda** (see "What the blind round
  gets", below): how the engine holds the game's state; the published
  protocol's form; where authority lives across devices, offline and
  standalone included; how games and venues extend the engine; how one
  engine runs as many separate copies; how today's engine moves to the
  new design. An architect may add, split or merge decisions and must
  say why. The last one waits for the second round, where today's
  engine is known.

Each architect writes a top-level design, decision by decision: the
choice; one or two alternatives they rejected, with the cost of each;
a table of how the design keeps each promise, meets each quality target
and allows each extension case, naming any it cannot meet; for each
kind of failure mid-show (a tablet's connection, a device, the show
machine, an outside program), what the GMs can still do and how the
game carries on; its riskiest assumption; and the trial run, a
throwaway prototype, that would test that assumption fastest.

## The second round: meeting today's engine

After the blind round, each architect also gets:

- **Today's engine, as facts:** a fact sheet of what runs where, in
  what language, and what works today; and the code with its component
  guides, to read but not change.
- **The sixteen design flaws, as test situations:** what goes wrong at
  a show, the problems behind it and where in today's code they sit,
  with no fix attached.
- **The other two proposals, and the earlier candidate** (the 17-part
  design drawn bottom-up from today's engine) as one more proposal.

Each architect tests every proposal (their own, the other two and the
earlier candidate) against the sixteen situations and today's facts:
which situations it removes, which it leaves, and what moving today's
engine to it would cost. They critique the others, then revise their
own design and say what changed and why. The second round also gives the last
decision ahead its real options: rebuild beside today's engine, change
it in place piece by piece, or a mix.

## The synthesis

One more agent, who proposed nothing, reads all of it and writes, for
each decision ahead: the options the panel found, their costs, where
the architects agreed and where they did not, the trial runs worth
doing before choosing, and the questions only the owner can answer. A
checker reads the synthesis against the proposals, refute-by-default,
and corrects anything it misstates or leaves out. The synthesis becomes
the agenda of the first design round.

## What is withheld, and how

Withheld from the blind round: the recommendations and leading guesses
of the agent running the pass, among them the two readings of the
owner's words of 2026-11-02 named under "The blind round"; the earlier
candidate (it enters the second round as one more proposal); the
earlier lists of design choices; today's engine and its review.
Withheld from both rounds: the reasoning of the agent running the pass,
the review's conclusions about fixes, and the candidate's table of
alternatives.

How: the prepared folders are built by a script from the sources (the
requirements files, the standing rules, the decision record), and each
architect is told to read only its folder, plus the code in the second round,
and never the planning folder. Nothing technical stops an agent from
opening a file it was told to leave alone, so the synthesis's checker
also looks for traces of withheld material in every proposal.

## What the owner gets back

The synthesis, as a page on the owner site: one section per decision
ahead, with the options side by side, their costs, where the architects
agreed and disagreed, the trial runs and the owner's questions. The six
proposals (three from each round) stay in the repository in full.

## Size and cost

About eight agents: three in the blind round, three in the second round, the
synthesis and its checker. It takes two to three hours and several
million tokens, about the size of one of the larger site workflows.

## The owner's question, and the agent's calls

**What the blind round gets: also the decisions the owner made that bind
any design, and the six decisions ahead as its agenda?** This is the
owner's question: the decision on what the panel sees lists only the
goal, the requirements and the setting, and adding to it changes that
decision. The binding list now holds the owner's four decisions of
2026-11-02 as well. Recommendation: yes. They are the owner's
decisions, not the reasoning of the agent running the pass, and a panel
without them would propose designs already ruled out, among them a game
that pauses at a lost connection. The cost: the agenda frames their
thinking, so they are told they may change it.

**The three lenses** (the agent's call, told to the owner, who can
overrule it). Three architects: state, authority and keeping the game
going through a failure; growth and extension, naming hardware
flexibility and both kinds of extension; living with it. Why: the owner
called pausing a game for a failure "the worst possible scenario", so
the state lens now names keeping the game going, with the decision "No
technical failure stops a game" as its first test; naming it in a lens
costs nothing, while a fourth architect costs two more agents and a
longer synthesis. The owner's ruling that how the panel runs is the
agent's call is "The Decisions page holds only your decisions".

**The second round reads the code** (the agent's call, told to the
owner, who can overrule it): a fact sheet first, then the code and its
component guides, to read only. The owner's decision gives the second
round today's engine as facts and does not say in what form; the form
is method. The cost: the code can pull a design toward small changes to
today's engine, so the architects revise their own blind proposals
rather than start again from the code.

**Anything else: is anything missing from what the panel sees, or
anything it should not see?** If the owner decides that the GM's
station may be something other than an Android tablet reading NFC
itself (the question "Which hardware the first new engine requires, and
what it must allow replacing" on the Decisions page), the setting's
sentence on ALN's devices is reworded before the folder is built.
