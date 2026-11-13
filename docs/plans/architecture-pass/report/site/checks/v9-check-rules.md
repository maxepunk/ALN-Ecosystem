# Check: `v9/rules.json` and `v9/rules-log.md` (the standing rules, version 9)

Checked 2026-11-01 against the roadmap (`/docs/plans/ROADMAP.md`,
section 2, "RM"), plan v2 (`site/2026-11-01-site-plan-v2.md`, sections
2, 3.3 and 6), the decision record (`DECISIONS.md`, "DR"), the jargon
table (`checks/jargon-table.md`, "JT"), `CONTEXT.md`, the words-box
entry "The standing rules" (`v9/front.json` `words[5]`) and the rules
`v9/design.json` cites (`ahead[3].settled`). Refuted by default; every
item was read against its source.

**Result: 18 conflicts over 39 items.** Items: the two intro
paragraphs; the 6 groups; the 20 rules (title, line, source and slug
each); the words-box entry; the design.json citation; and the log's 9
claims (its 5 checks against the site and its 4 notes on plan v2
section 6).

## Conflicts

| # | Where | What it says | What it should say | Source |
|---|---|---|---|---|
| 1 | `intro[0]`, sentence 2 | "they say what the engine must do or must never do, whatever shape the design takes" | "they say what every block of work and every design must do or must never do". Several rules bind the work and the people, not the engine's behaviour: no block may build in one kit; the scanner work waits on no game; the editor and live apply ship together; never design a mechanic that needs reloaded device code. | RM section 2 preamble: "These rules bind every block and every future design document." |
| 2 | `intro[1]`, sentence 2 | "every future operator of the open-source engine inherits" | "everyone who runs the open-source engine in future inherits". "Operator" is jargon; JT row 52 renders it "staff who log in, such as the GM", which is a different sense from the roadmap's here. | RM 2.1 closing sentence; JT row 52 |
| 3 | `players-never-have-accounts` `line` | "Nothing a player uses, a phone or a scanner, ever asks a player to log in." | "Nothing a player uses, phones and scanners included, ever shows a login." The rule narrows "user-facing login" to a login asked of a player, and the appositive reads as a closed list where the roadmap says "included". | RM 2.1 rule on accounts: "Nothing player-facing ever gets a user-facing login, phones and scanners included" |
| 4 | `the-engine-knows-devices-not-people` `line`, sentence 1, and title | "The only identity built into the engine is a device id or a session id." Title: "The engine knows devices, not people". | "The only identity built into the engine is a device's id, or, on a player's phone, the id of that phone's visit." Title, for example: "The engine knows devices and visits, not people". "Session id" is JT row 50's "the game's id number", the wrong sense here: the roadmap means a player phone's session (its parenthetical, dropped by the writer, says "extended to phone sessions in the players'-phones block"; CONTEXT.md "session", meaning 3). The words box `words[5]` repeats "device or session id". | RM 2.1 second rule; JT row 50; CONTEXT.md "session" (session tier) |
| 5 | `the-engine-knows-devices-not-people` `line`, sentence 2 | "Naming a person is game policy, never an engine default." | "Knowing which person is which is game policy, never an engine default." "Naming" narrows "person-level identity": a scanned band identifies a person with no name, as the next rule says. The words box `words[5]` carries the same narrowing. | RM 2.1 second rule: "Person-level identity is game policy, never an engine default" |
| 6 | `never-assume-one-kit-one-pack-one-production` `title`; `front.json` `words[5]`; `design.json` `ahead[3].settled` | Title "Never assume one kit, one pack, one production"; words box "nothing assumes one kit, one pack or one production"; design.json "nothing in the engine assumes one kit, one pack or one production". | Title, for example "Avoid one-kit assumptions where it costs little"; words box and design.json: "... where avoiding it costs little". The line keeps the qualifier; the title and both site summaries drop it and read stronger than the roadmap. The log names the summaries' gap (its check 1) but leaves it and does not note the title. | RM 2.2: "No block may hard-code 'one kit, one pack, one production' assumptions where avoiding them costs little" |
| 7 | `never-assume-one-kit-one-pack-one-production` `line`, sentence 2 | "The seams that make more possible are built now; the features that use them belong to the operations era." | "Features for several kits or several packs belong to the operations era; the seams that make them possible are built now." "More" is vague, and "the features that use them" widens the roadmap's multi-kit and multi-pack features to any feature that uses a seam. | RM 2.2: "Multi-kit and multi-pack features belong to the operations era. The seams that make them possible are built now." |
| 8 | `pack-and-venue-profile-chosen-never-assumed` `line`, sentence 2 | "The venue profile is chosen the same way." | "The venue profile is chosen the same way and is never assumed to be the only one either." "The same way" can be read as "by path or id" only, losing the half the title promises. | RM 2.2 checklist: "the pack is selected by path or id, never assumed to be the only one; the profile likewise" |
| 9 | `a-managed-media-bundle-carries-the-files` `line`, sentence 2 | "The hardware scanner already gets its files this way, and that is the model." | Drop the sentence from the rule; it can stay as evidence on Today's engine. It turns a roadmap aside about today's engine into a binding rule that makes today's design the model, and the panel gets the standing rules before it may see today's engine. | Plan v2 section 6 (today's engine is evidence, never the reason for a design); DR "What the architects' panel sees, and when" (today's engine only after the first proposals); RM 2.3 (a bracketed aside, not one of the subsection's constraints) |
| 10 | `a-designer-can-upload-the-pack-s-media` and `media-bundles-move-between-machines` `line` | "A designer can work through the files their pack needs and upload them through the design tool." "A bundle can be checked against the pack's list of files and moved easily ..." | "The final design tool lets a designer work through the files their pack needs and upload them; the full upload experience comes with the content tooling block." And: "... checking a bundle against the pack's list comes with the pack-manager page." The lines drop "the final tool must meet" (kept only in the sources) and the roadmap's timing, so they read as binding on every block now. | RM 2.3: "Two requirements the final tool must meet"; "Reference-checking arrives with the pack-manager page"; "The full upload experience is content-tooling work" |
| 11 | `media-bundles-move-between-machines` `line` | "moved easily between engine machines for different game instances" | "moved easily between the machines that run the engine, for different running copies of the engine". "Instance" is jargon. | JT row 11 (instance: "a running copy of the engine"); RM 2.3 |
| 12 | `games-are-playtested-without-code-or-settings-files` (group "The design-iteration loop") | Nothing says the loop is a property of the platform. | Add to the line or the group's rule: "The loop is a first-class property of the platform, not of one game." The roadmap ratifies the loop under that heading, and the rules leave it out. | RM 2.4 heading: "The design-iteration loop (a first-class platform property)" |
| 13 | `the-editor-and-live-apply-ship-together` `line` and `source` | Line: "The mechanics editor is where the loop happens ... The editor and that apply ship together as one deliverable." Source: "... the design-iteration loop, the ratified floor." | Line: "The design tool's editor for the game's rules is where the loop happens ... The editor and that live apply are built and delivered as one piece of work." Source: "... the design-iteration loop, the minimum the owner ratified." "Mechanics editor" is a third name for the tool beside "the tool" and "the design tool"; "ship" and "deliverable" are trade words; "the floor" is jargon, and JT row 52 already gives "the floor" another meaning (what stays with staff who log in). | RM 2.4; JT row 52; plan v2 section 2 (the jargon table's wordings) |
| 14 | `hardware-scanner-work-waits-on-no-game` `line`, sentence 1 | "is platform work the engine commits to" | "is committed platform work". The commitment is the owner's and the program's; the engine commits to nothing. | RM 2.5: "Hardware-scanner firmware work for this is committed platform engineering" |
| 15 | `designers-change-pack-data-never-device-code` `line`, sentence 2 | "Never design a mechanic that can only be tuned by reloading the code on every hardware scanner." | "Never design a mechanic that can only be tuned by reloading the code on a whole set of devices." The roadmap says "a fleet of devices", a platform rule for any device built from code; the line narrows it to today's hardware scanner. | RM 2.5: "never design a mechanic whose iteration loop requires re-flashing a fleet of devices" |
| 16 | Group `the-engine-holds-no-opinion` and its rule `the-engine-holds-no-opinion-on-game-design` | Group title "The engine holds no opinion"; rule title "The engine holds no opinion on game design". The site's summaries say "about game design". | Two titles alike, rendered one under the other. Keep the group title and retitle the rule, for example "Game-design choices are pack and kit settings"; or, if the rule title stays, use "about" as the words box and design.json do. | Plan v2 section 4 (titles unique); `front.json` `words[5]`; `design.json` `ahead[3].settled` |
| 17 | `source` of the five identity rules | "rule 1", "rule 2" (twice), "rule 3", "rule 4" | The rule by what it says, or no position: for example "Roadmap, standing constraints, identity and player data, the rule on accounts". The log defends the numbers as the roadmap's list positions, but the site's rule is titles, not numbers, and no other group cites a position. | Plan v2 section 2, "Titles, not numbers"; the task's rule against visible numbers |
| 18 | `source` of `a-designer-can-upload-the-pack-s-media` and `media-bundles-move-between-machines` | "requirement (a) on the final tool"; "requirement (b) on the final tool" | "the final tool's requirement on uploading"; "the final tool's requirement on moving bundles". Visible letters on the site are reserved for the owner's questions, on the Decisions page only. | Plan v2 section 2 ("Questions carry a letter ... on the Decisions page only") |

## What was checked and found right

- **Coverage of the roadmap.** Every constraint in RM section 2 is
  carried, except the platform-property heading (conflict 12): 2.1's
  four rules and its privacy-defaults sentence (in `intro[1]`); 2.2's
  opening rule, its five checklist items (the media item carried once,
  by the media group, as the log says) and the features-and-seams
  sentence; 2.3's never-inside-the-pack rule, the names with
  fingerprints, the managed bundle, the design-tool upload, both
  requirements on the final tool and the out-of-era ruling; 2.4's
  point-of-the-work, the loop, the editor as its place, live apply and
  the one-deliverable floor; 2.5's four statements and both dates;
  2.6's whole list. The roadmap's background sentence on phones and
  stations, and its remark that media outside git is already the
  repo's practice, are rightly left out.
- **Rules that hold as written.** "How players are identified is the
  game's choice", "Game data stays on the kit", "The owner sets how long
  data is kept" ("game data" for "session data" is the site's word for
  the night's play), "No one kit's names inside engine code", "Network
  names and addresses work per kit", "Media never lives inside the pack"
  (fingerprint per JT row 64), "Games are playtested without code or
  settings files" (apart from conflict 12), "Phones and hardware
  scanners stay equal in ability" ("multi-tap player actions" is JT row
  57's wording), "Equal in ability, not in screens" and the no-opinion
  rule's list.
- **"Between games" in live apply** is JT row 16's wording for
  hot-apply, so the rule follows the table; it is not an addition.
- **Sources.** Every source names the right roadmap subsection; every
  date matches the roadmap (2026-08-29 for each ratification, the
  2026-07-18 first-class-platform ruling, "reaffirmed" for the
  no-opinion rule); dates are left off where the roadmap gives none, as
  `intro[1]` says. The source gloss "the engine's one design for who
  gets access" fits the one-auth principle (CONTEXT.md).
- **Slugs.** All 26 (6 groups, 20 rules) are the title in lower case
  with each run of non-letters as one hyphen, the rule the other v9
  files use; none repeats, and none collides with the Requirements
  page's other anchors (the promise anchors, `qt1`, `ex1`,
  `quality-*`, `rules`).
- **Visible text.** No em dash or en dash; no promise, decision,
  question, flaw, finding, quality-target or extension-case id; no
  section number, Q10 or E10; the only block named is the operations
  era, by name; "seam" is a words-box term; no metaphor beyond those in
  conflicts 2 and 13. Every title has three to eight words; every line
  has one or two sentences. JSON parses.
- **The words box and design.json.** `words[5]` agrees with the rules on
  accounts, game data on the kit, keeping data, media, the playtest
  loop, parity and no opinion; its gaps (the game's own identification,
  the one deliverable, the two further parity rules) are omissions of a
  summary, as the log says. Its disagreements are conflicts 4, 5 and 6.
  The three rules `design.json` cites are all in the file, and the log
  explains each (its checks 1 to 3).
- **The log.** Its count (20 rules in 6 groups), its group-to-subsection
  mapping, its two splits and its one carried checklist item are right;
  its per-rule quotations match RM section 2. Its claim "No constraint
  was added or strengthened" does not hold for conflicts 6, 9 and 15,
  and its defence of the identity rule numbers is answered in conflict
  17.
