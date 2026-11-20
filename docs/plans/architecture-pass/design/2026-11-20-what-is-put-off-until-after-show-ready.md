# What is put off until after show-ready, item by item (2026-11-20)

Status: the agent's analysis, put to the owner on 2026-11-20. Nothing
here is decided. The third drafts of the two handover documents
(`2026-11-20-the-roadmap-revised.md`,
`2026-11-20-each-decision-and-its-test.md`) are not changed until the
owner rules.

## The owner's question, word for word

After reading the third drafts on the proposal page (version 32):

> Let's think about all of the things that are currently being put off
> until after show-ready in our roadmap. We need to think about each
> individually. Are there good engineering reasons why they're being
> put off until after show-ready, OR are we putting them off because
> that's how the earlier plan suggested it even though saving that
> work for AFTER show-ready means extra development work and rewriting
> stuff we're already building while working on our improved engine
> architecture? Does the question make sense?

## What the agent had done

The roadmap draft's section 5 opens "The order of the current roadmap
stands". The agent carried the order across show-ready from the
current roadmap and examined none of it. It had noticed one case, the
GM scanner's game screens being written twice, and filed it under "To
know, with nothing to decide".

## Why the current roadmap has that order

`docs/plans/2026-09-04-roadmap-r4-draft.md`, sections 1 and 3. The
order was "re-sequenced by value" against the owner's five troubles,
under two conditions that no longer hold:

- "The clock: the run opens 2026-09-18 and closes 10-18." The owner
  ended that on 2026-10-30: "No date governs the work now"
  (`docs/plans/ROADMAP.md`, section 10.2).
- The engine as it stood was kept, and work was added on top of it.
  The build now writes the session's record, the rules, the messages
  and the GM scanner's game screens new.

So an item's place after show-ready in that order is no evidence of an
engineering reason.

## What counts as a reason

Good reasons to put work after show-ready:

1. It needs something that only exists after the cutover.
2. Nothing uses it yet, and its right form depends on a design that is
   not made.
3. It only adds to what the build makes. Built later it costs the same
   and changes nothing already built.
4. It adds risk to the cutover itself.

Not reasons: the September order; a rule that paired two pieces as
"one deliverable"; a row that parked a piece of engine work under a
screen that was scheduled later.

## Put off by habit: putting it off means building something twice

1. **The GM scanner's redesign** (row 8.17). The build writes the
   GM scanner's game screens new, because the data under them changes
   and they are built around ALN's fields. That is about 5,300 of the
   GM scanner's 15,600 lines: `GameOpsRenderer.js`, `gameOps.js`,
   `uiManager.js`, `SessionRenderer.js`, `gameAdmin.js`,
   `GameAdminRenderer.js`, `index.html`, `connectionWizard.js`,
   `initializationSteps.js`, `app.js`. The redesign then writes them
   again and rearranges the panels. The September order placed it
   late because of the run. The trouble it answers, the layout being
   unhelpful in the middle of a game, is known from running ALN and
   does not wait on the new engine. Its real need is design time with
   the owner, on the owner's real show flows, before the area "a whole
   game session" is built. One real cost of moving it: more changes in
   a GM's hands at the cutover.
2. **A control to advance the phase by hand, and cue times set from a
   phase** (parked under row 8.17 by the ruling Q-5-1 of 2026-08-22,
   as "show-control UX"). Their engine halves are in the game clock
   and the cue code, which the build changes. Extension case EX8 says
   what the button does at pause, end and reset must be defined.
3. **Applying a published pack without restarting the backend** (row
   8.6). In the new design a session's record names its pack, so the
   natural moment to take up a published pack is when the next session
   is created. The drafts build "restart the backend" into the new
   backend, into the tests, into ALN's steps and into the config tool,
   to remove it later. The current roadmap pairs it with the mechanics
   editor as one deliverable so that the editor never ships without
   it. Building the engine's half first keeps that purpose. "How a
   changed pack is taken up between games with no restart" was also on
   the list of choices kept for the design (`../DECISIONS.md`, "Still
   open") and was never designed.
4. **Three shortcuts parked under config tool pages**: lighting
   falling back to scene names in the pack (L7), the idle loop's file
   read from the engine's settings (L12), a speaker named in ALN's
   pack (L8). The area "the room's equipment" rewrites how equipment
   is named and checked. Carrying the fallbacks into that code and
   removing them later reworks it. None needs a page: ALN's
   installation settings already hold the lighting bindings, and the
   owner already ruled that an idle loop with no binding counts as not
   installed.
5. **Recording a session as it is played: the roster, notes and the
   accusation.** The record already has their place
   (`docs/adr/0002`), and the build already builds and tests the rule
   that only these are accepted after a session ends
   (`docs/adr/0003`), with nothing to accept. Their screens on the GM
   scanner belong in the same design as item 1. Put off, the director
   still types them into the Director Console after the cutover. The
   owner's ruling of 2026-09-05 (Q6) already called this part "fast
   value, no new storage".
6. **The transfer between accounts.** "Built with the redesign, not
   now" was the agent's own recommendation on 2026-11-13, and the
   owner said yes to it. It has no engineering reason. It belongs with
   the screen for changing a score.
7. **Changing the secrets.** Today's guide builds green by copying
   blue's Home Assistant volume and settings file, which carry the
   token and password that are in the repository
   (`DEPLOYMENT_GUIDE.md`, lines 85 and 1915). The new engine is
   installed fresh on green, so the moment to change them is then.
   Later means a second visit to a production computer.
8. **Putting the production's web name into service.** Already
   recommended before the cutover in the roadmap draft's section 11.

## Put off for a reason, with something small owed in the build

9. **Choices on a player's device, and actions that take two tokens.**
   The current roadmap itself says the first form "is specified by the
   second game's tap grammar", which is the owner's design and is not
   made. What the build must do: let a pack give a player's device a
   verb that changes points and prove it with the toy pack, and write
   the form of a rule and of a scan message so that a verb with two
   steps fits. The owner's decision of 2026-11-13 already made "who
   may do it, on which kind of device" a designer's rule.
10. **The second game's capabilities.** Nothing uses them, and their
    form depends on that game's design. But "one file in a known
    place" is proven in the drafts only by two drills with stand-ins.
    Owed: one drill of the hard kind, a capability that keeps state of
    its own in the record.
11. **The config tool's pages.** They only add screens over the pack
    and the settings, they are large, and six decisions about the
    tool's structure are still the owner's to make
    (`docs/plans/2026-09-04-ux-foundation.md`, section 7). Two things
    are owed. First, the form of a rule is designed in the first
    version without the screen that will edit it; a sketch of that
    screen should be made with the form. Second, the build's area for
    the config tool rewires today's screens (about 6,500 lines) to the
    new engine, and the new pages then replace them. Whether that
    rewiring is worth doing depends on what the owner uses the config
    tool for at ALN today, which only the owner knows.
12. **Photos.** A new way to send and keep files on the kit, with the
    owner's rules on privacy and on how long they are kept. It only
    adds. Owed: the record's line for a photo is designed with the
    other lines. Before or after show-ready is a question of value and
    size, as the owner ruled on 2026-09-05 (Q3).

## Put off for a reason, with nothing owed

Tools for writing a game's content. How many phones a kit can carry,
and which phones are accepted. The Director Console reading the
session's file. A code on each tag that cannot be guessed. Rewriting
the tags. The view of what bringing a piece of hardware unlocks.
Screens of a new kind. A page for choosing the game of the night. A
second kit. The licence, the documents for people and the privacy
statement.

One small thing rides on the licence. If the owner does not want the
firmware under the GPL, two libraries are replaced. The firmware is
open and tested on real devices in the build, so that choice is
cheaper made before the firmware's area than after.

## What moving the first group does

The build grows and the cutover comes later. ALN runs on blue
meanwhile, as now. At the cutover the GMs get the redesigned GM
scanner and the roster, notes and accusation, which are two of the
five troubles the current order leaves for afterwards.

## What is the owner's

Whether each item of the first group moves into the build. Each one
changes an order or a ruling the owner made. And one fact: what the
owner uses the config tool for at ALN today.
