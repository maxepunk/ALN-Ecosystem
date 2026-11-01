# The after-game report and emailer, and where they touch the engine

A read-only survey, 2026-11-01. The owner asked to bring the after-game
article and emailer into the engine map, since the roadmap means to
join them to the engine in the long run. Source:
`/home/user/aboutlastnight/reports` (branch
`claude/eloquent-franklin-r87bmh` at `f82698f`; read, never changed).
Paths below without a repository name are in that folder. Nothing here
was decided by the survey; the owner answered its six questions the
same day (decision 28, below).

## What it is

Two programs on the director's Windows computer, outside the kit.

1. **The Director Console** (`CLAUDE.md:5-16`, `:42-64`). A web app,
   reached at `console.aboutlastnightgame.com` through a tunnel with a
   password. An AI writing pipeline runs in 44 steps and waits at 11
   stops for the director. The director marks which paper documents the
   players unlocked; gives the roster with pronouns; pastes the
   accusation, the GM tablet's report and notes; checks the parse;
   picks and edits the story at a story meeting; arranges the story on
   a map; names who is in each photo; and finishes the article at a
   desk. Approving the desk publishes the article as a web page. The
   writer is the in-game reporter, Nova (`CONTEXT.md`, "Nova").
2. **The emailer** (`emailer/SETUP_GUIDE.md:105-144`). An interactive
   script. The director pastes the booking list (each player's name
   and email), an optional note and a photo folder. It sends each
   player a thank-you email from the game's Gmail account with the
   article link, the feedback form link for that date, a return-visit
   discount code and the photos. It keeps a list of who was sent what
   on the computer, out of git (`/home/user/aboutlastnight/.gitignore:73`).

## What it takes, and from where

| What | Where it comes from today |
|---|---|
| What happened: exposed and sold memories, sales, exposures with times and the names on them | The GM tablet's report, downloaded when the game ends and pasted into the console. An AI call parses the markdown back into lists and stops the run if it fails (`lib/workflow/nodes/input-nodes.js:652-737`). The engine's roadmap keeps that markdown byte-for-byte fixed for this parser, ★ characters included (ALN-Ecosystem `docs/plans/ROADMAP.md:612`). |
| Memory text and paper documents | Notion, read when the report is made (`lib/workflow/nodes/fetch-nodes.js:7-8`), not the pack the show ran. Paper documents are not in the pack at all. |
| Which paper documents were unlocked | The director marks them at the first stop (`CLAUDE.md:54`). |
| Roster with pronouns, accusation, notes | Typed by the director at stops (`docs/architecture/stops.md:24-25`). |
| Photos and who is in each | A folder on the computer; the director names the people at a stop. |
| Player names and emails | The booking list, pasted into the emailer (`emailer/SETUP_GUIDE.md:109`). |

The articles went up 2 to 11 days after their games: the game of
October 9 on October 11, the game of October 18 on October 29 (the
"Publish ... report and photos" commits, latest `f82698f`).

## What it gives

- A public article page per game in the public `aboutlastnight`
  repository, with about 17 session photos (`f82698f`).
- One email per player (`emailer/SETUP_GUIDE.md:140-144`).

## Where it touches the engine map

- **Moment: Review.** The glossary already splits it: the platform
  owns the record, the intake and the handoff; the game owns the
  telling, which for ALN is this console (ALN-Ecosystem
  `CONTEXT.md:532-544`). Capabilities 30 to 34 plan capture, the photo
  store, the record writer, the console's move to that record
  (deferred, roadmap row 8.10) and the Review stage
  (`2026-10-31-jobs-capabilities.md:53-57`).
- **Promise:** "Every tap gets its answer, and the night can be told
  afterwards." Its second half names the owner and the designer after
  the show. It does not name the director who writes the article, or
  the players who receive it.
- **Part:** The night's record (`2026-11-01-engine-shape.md:187`):
  capture during play, close at the end, read afterwards. Its one named
  reader is the design studio's Review. In practice the console would
  be its main reader.
- **Privacy defaults** (ALN-Ecosystem `docs/plans/ROADMAP.md:81-98`):
  person-level identity is game policy, never an engine default; game
  data stays on the kit unless the owner moves it; the owner sets how
  long it is kept. The roster, the photos and the emails are
  person-level data. Publishing the article and sending the emails are
  the owner moving data off the kit.

## A flaw the console already works around

One game's money events are stamped by two clocks. A sale carries the
time the GM tablet put in its request (ALN-Ecosystem
`backend/src/models/transaction.js:170`). A manual score adjustment
carries the engine computer's time (`backend/src/models/teamScore.js:85-89`).
The GM enters the first-burial bonus and the transfers as adjustments.
On games 100326 and 100426 those printed nine hours away from the
sales; the console shifts them back, and the director called it an
engine bug to fix separately (`docs/superpowers/plans/2026-09-22-roadmap.md:250`,
`docs/architecture/director-words.md:17`). It looks like a case of
"Tablets and phones decide facts the engine owns" (card C9). It is
not on the flaw list yet.

## Questions for the owner

1. Should the second half of "Every tap gets its answer, and the night
   can be told afterwards" name the director and the players after the
   show?
2. Do the players after the show get a promise of their own, or is
   what they receive the game's business?
3. Should the night's record carry the pack it ran and the texts
   players held, so the article quotes what they saw? Should paper
   documents join the pack, with "unlocked" captured during play?
4. Does the engine ever hold players' emails and consent, or does the
   booking list stay outside it for good?
5. What does "integrate" mean: (a) the console stays separate and
   reads the engine's record (the roadmap today); (b) the console
   becomes ALN's own module inside the engine's Review stage; or (c)
   the engine gains a plain built-in telling and follow-up for every
   game, with ALN's console as the advanced version?
6. Add the two clocks to card C9, or as a new flaw?

## The owner's answers (decision 28, 2026-11-01)

1. Yes: the second half of that promise names the director and the
   players after the show.
2. What the players receive after the show is the game's business; the
   engine makes them no promise of their own.
3. Yes to the first: the night's record carries the pack the game ran
   and the texts the players saw. Paper documents joining the pack,
   with "unlocked" recorded during play, was not answered: a question
   for step 3.
4. Players' emails stay outside the engine. Later the game's own tools
   could collect them from the ticketing service's API.
5. Plan for (a): the console stays separate and reads the engine's
   record. Design the record so (b), the console as ALN's own part of
   the engine's Review stage, stays open.
6. The two clocks join card C9 as finding X-08
   (`2026-10-30-cause-analysis.md`).

Folded into: the promise's people, need and goal
(`2026-10-31-engine-jobs.md`, `report/2026-10-31-engine-jobs.json`),
the night's record (`2026-11-01-engine-shape.md`,
`report/2026-11-01-engine-shape.json`), card C9
(`report/2026-10-31-cause-cards.json`), the glossary's Review entry
(`CONTEXT.md`) and the roadmap's capture block and row 8.10
(`docs/plans/ROADMAP.md`).
