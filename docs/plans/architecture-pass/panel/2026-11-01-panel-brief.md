# The panel's brief: what the three architects see, and when

Draft for the owner, 2026-11-01. Not yet approved; the panel does not
run until the owner approves it and confirms the requirements.

The independent panel proposes the engine's top-level design before the
first design round (decision "Independent architects propose the
top-level design"). The owner said the context the panel gets is
critical, so this brief comes to the owner before the panel runs. It
follows the decision "What the architects' panel sees, and when". The
choices that decision leaves open are the questions at the end.

## Who is on the panel

Three architects. Each is a fresh AI agent on the strongest model
available. None has seen this program's conversations or its planning
documents, and none sees another's work until round two. Each has one
lens, so that the three proposals differ:

1. **State and authority.** How a live game's facts are held, changed,
   ordered and recovered across the show machine, the tablets, the
   phones and the hardware scanners, on a network that drops, with
   standalone games included.
2. **Growth and extension.** How designers, venue technicians and
   outside developers extend the platform without touching the engine's
   code: games as packs, venues as profiles, new kinds of screen,
   device and outside program, and the published protocol as what other
   people build against.
3. **Living with it.** How one owner and AI agents keep the engine easy
   to understand, change, test and release for years: how small and
   clear each piece is, and how a change is made, tested on the test
   bench and shipped with no risk to a show.

A lens says where an architect looks hardest. Every architect still
answers to every requirement.

## Round one: proposing blind

Each architect gets one prepared folder and nothing else:

- **The goal**, in the owner's words: "design a long-term optimal
  architecture for our engine that makes it intuitive and easy to
  maintain, continue development on, and extend".
- **The requirements**, as the owner confirms them: the ten promises
  with the owner's answers; the quality targets with the numbers the
  owner sets; the extension cases; the standing rules.
- **The setting**, as facts:
  - A show is one game of about two hours at one venue, with a few
    dozen devices: GM tablets, players' phones, hardware scanners, a TV,
    speakers and lights.
  - The show machine is one Raspberry Pi 5 at the venue, running
    Raspberry Pi OS. It drives a TV over HDMI and the room's sound, and
    it must go from power-on to a running show with no technician.
  - The room's outside programs: a video player, a music player, the
    sound system with Bluetooth speakers, and the venue's lighting
    controller. The engine drives them. Any of them can crash or be
    missing.
  - The devices: GM tablets (Android tablets running Chrome, for staff
    only, sometimes offline); players' own phones (a web page, with no
    install and no accounts); hardware scanners (small boards with an
    NFC reader, a small screen, an SD card and Wi-Fi, whose firmware is
    updated by cable); NFC tokens.
  - The network is the venue's local Wi-Fi. It can drop at any moment.
    No internet is assumed during a show.
  - A game's content is written in Notion today and exported into the
    pack. Its media files (images, audio, video) are large and live
    beside the pack.
  - The people: one owner, who designs the games and runs the shows and
    is not an engineer; development by the owner with AI agents, so
    every piece must be easy for an agent to read and change safely; a
    future open-source community.
- **The owner's decisions that bind any design** (see "What round one gets", below): one
  published protocol and an outside test bench; standalone games
  declared, never mixed; the four words for the game's live facts; the
  night's record and the after-game article; the settled roles of the
  scanners and screens.
- **The six decisions ahead, as the agenda** (see "What round one gets", below): how the
  engine holds the game's state; the published protocol's form; where
  authority lives across devices, offline and standalone included; how
  games and venues extend the engine; how one engine runs as many
  separate copies; how today's engine moves to the new design. An
  architect may add, split or merge decisions and must say why. The
  last one waits for round two, where today's engine is known.

Each architect writes a top-level design, decision by decision: the
choice; one or two alternatives they rejected, with the cost of each;
a table of how the design keeps each promise, meets each quality target
and allows each extension case, naming any it cannot meet; its riskiest
assumption; and the trial run, a throwaway prototype, that would test
that assumption fastest.

## Round two: meeting today's engine

After round one, each architect also gets:

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
own design and say what changed and why. Round two also gives the last
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

Withheld from round one: the orchestrator's recommendations and leading
guesses; the earlier candidate (it enters round two as one more
proposal); the earlier lists of design choices; today's engine and its
review. Withheld from both rounds: the orchestrator's reasoning, the
review's conclusions about fixes, and the candidate's table of
alternatives.

How: the prepared folders are built by a script from the sources (the
requirements files, the standing rules, the decision record), and each
architect is told to read only its folder, plus the code in round two,
and never the planning folder. Nothing technical stops an agent from
opening a file it was told to leave alone, so the synthesis's checker
also looks for traces of withheld material in every proposal.

## What the owner gets back

The synthesis, as a page on the owner site: one section per decision
ahead, with the options side by side, their costs, where the architects
agreed and disagreed, the trial runs and the owner's questions. The six
proposals (three from each round) stay in the repository in full.

## Size and cost

About eight agents: three in round one, three in round two, the
synthesis and its checker. It takes two to three hours and several
million tokens, about the size of one of the larger site workflows.

## Questions for the owner

**The three lenses: are these the right ones?** Other choices: a fourth
architect on live-show reliability (staying up through a show,
offline); or a lens on the smallest possible engine in place of
"Living with it". Recommendation: the three above. Live-show
reliability sits inside the state lens, and a fourth architect adds
cost and a longer synthesis.

**What round one gets: also the decisions you made that bind any
design, and the six decisions ahead as its agenda?** The decision on
what the panel sees lists only the goal, the requirements and the
setting. Recommendation: yes. They are the owner's decisions, not the
orchestrator's reasoning, and a panel without them would propose
designs already ruled out. The cost: the agenda frames their thinking,
so they are told they may change it.

**Round two reads the code: may it read today's code?** Recommendation: yes, after a
fact sheet. The code is the most exact fact about today's engine. The
cost: the code can pull a design toward small changes to today's
engine, so the architects revise their own blind proposals rather than
start again from the code.

**Anything else: is anything missing from what the panel sees, or
anything it should not see?**
