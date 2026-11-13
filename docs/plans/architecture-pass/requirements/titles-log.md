# Titles log: quality targets and extension cases

Written 2026-11-01 for the owner's site, version 9 (site plan v2, section 4: each quality target and extension case gains a `title`, three to eight plain words, unique across both files, read by the builder directly).

Each title names what the item asks. Its source is the item's own `situation` (targets) or `case` (cases) field in the file named below; no title adds a fact that is not in that field. Wordings follow `report/site/checks/jargon-table.md` (the trial copy, the program watcher's programs, not installed tonight, the published protocol, a pass, test stand-ins, one written list of what the machine should carry, the pack's media files, a running copy of the engine, the hardware scanner, the phone's scanner, staff who log in). No title carries an id, a number, a sequencing number or an em dash.

## Quality targets (42 items), `2026-11-01-quality-targets.json`

- QT1: A power cut loses nothing of the game
- QT2: Crashed programs restart on their own
- QT3: A tablet reconnects to the same facts
- QT4: Each scan counts exactly once
- QT5: Screens say when the engine goes silent
- QT6: Red means broken, grey means not installed tonight
- QT7: A refused scan never reads as complete
- QT8: The preflight states its own limits
- QT9: A published change plays within minutes
- QT10: A broken pack is refused at the desk
- QT11: A trial copy never touches the live show
- QT12: A designer builds a whole game without code
- QT13: Set up the kit from the guide alone
- QT14: Power on straight into a running show
- QT15: Every red row carries its own actions
- QT16: The engine writes the night's record by itself
- QT17: Every fact is decided in one place
- QT18: Every message and file is defined once
- QT19: A newcomer proves a first change alone
- QT20: No word of ALN's inside the engine
- QT21: New abilities for a second game break nothing
- QT22: A new device kind joins by its pass
- QT23: Replacing an outside program leaves the rest untouched
- QT24: Nothing assumes one kit, one pack, one production
- QT25: A whole game runs with no venue hardware
- QT26: Every test runs twice and never skips silently
- QT27: A test run cannot touch the live show
- QT29: Players tap with no account and no login
- QT30: Game data stays on the kit
- QT31: Every request is checked against its pass
- QT32: The engine filters before it sends
- QT33: Sized for a two-hour show with headroom
- QT34: Phone capacity is measured before the first phone
- QT35: A small pack with checked media files
- QT36: The whole show runs with no internet
- QT37: A standalone game is normal, never a fault
- QT38: No game mixes engine and standalone devices
- QT39: A standalone game leaves its own record
- QT40: Offline scans are kept and sent once
- QT41: The machine matches what it should carry
- QT42: Replugging the old machine undoes a release
- QT43: Running copies of the engine stay separate

## Extension cases (24 items), `2026-11-01-extension-cases.json`

- EX1: A whole second game, as a pack
- EX2: Change one value between shows and play it
- EX3: A third way to turn in a token
- EX4: A new scoring model added once
- EX5: Adding tokens and their media files
- EX6: A cue names roles, the venue binds them
- EX7: Each game's own words, colours and labels
- EX8: A game divided into acts
- EX9: Configuring screens, and a new kind of screen
- EX10: Players' own phones and two-tap actions
- EX11: Who may do what on which device
- EX12: A small game with no show machine
- EX13: A new venue is a new profile
- EX14: Rehearsing the whole show on stand-ins
- EX15: A different lighting system or video player
- EX16: A second production takes the platform
- EX17: A new engine version by swapping machines
- EX18: A different content tool feeds the same pack
- EX19: The director tells the night from the record
- EX20: The owner's second game needs new modules
- EX21: A stranger extends the platform from the guide
- EX22: The pack says what a scan causes
- EX23: A different installed game each night
- EX24: The owner sets how long records are kept

Total: 66 titles, all unique across both files.

## The check of 2026-11-01, applied

Source: `report/site/checks/v9-check-titles.md`, 7 conflicts (6 targets, 1 case). Each was read against its item's own fields and the jargon table before any change. 6 applied, 1 rejected. No field but `title` changed; the item order, ids and layout of both JSON files are as before.

Applied:

- QT21: was "A second game runs without an engine fork"; now "New abilities for a second game break nothing" (8 words). Verified: "fork" is not in QT21's `situation` (it appears only in its `why`), and the jargon table has no wording for it; the log's own rule is that a title adds nothing its `situation` lacks. The new words come from the `situation` ("Adding that capability is an additive change: ALN's pack and the toy game's pack run as before, every existing test passes") and from "the abilities the pack requires" (EX4 `throughWhat`).
- QT23: was "Swapping an outside program changes one place"; now "Replacing an outside program leaves the rest untouched" (7 words). Verified: the `situation` names two places that change (the code that talks to the program, and the venue profile) and says "no cue, pack, screen or test changes"; "one place" misstated it. The `why`'s "the engine should change in one place only" speaks of the engine alone, and the title is read from the `situation`.
- QT26: was "Both games pass and nothing skips silently"; now "Every test runs twice and never skips silently" (8 words). Verified: the `situation` says "runs the full set of tests twice, once with ALN's pack and once with the toy game's pack, and both must pass"; it is the test runs that pass. "Pass" also collides with the access pass of QT22 and QT31 (jargon table rows 52 and 56).
- QT35: was "A small pack and a checked media bundle"; now "A small pack with checked media files" (7 words). Verified: jargon table rows P16 and P53 list "the media bundle" as a term and give "the pack's media files" as its wording; plan v2 section 2 applies the table's wordings to every listed term. The `situation` still says "The media bundle carries the files" and EX1 and EX5 use the term in their own fields; those fields are outside this task and are left for the owner of those texts.
- QT41: was "One written list of what the machine carries"; now "The machine matches what it should carry" (7 words). Verified: jargon table row 62 reads "one written list of what the machine should carry"; the old title dropped "should" and so named an inventory instead of the comparison the `situation` asks for ("A status check at start compares the machine with that list and names any piece that differs"). The wordings sentence at the head of this log misquoted row 62 the same way; corrected above.
- QT43: was "Each engine copy keeps to itself"; now "Running copies of the engine stay separate" (7 words). Verified: "keeps to itself" is an idiom, against plan v2 section 6's plain words; jargon table row 11 gives "a running copy of the engine" and row 10 "each running copy of the engine keeping its own files, network ports and settings". The `situation`: "Two running copies of the engine share one machine ... Each keeps its own files, network ports and settings; neither can stop the other's programs, read its records or accept its passes."

Rejected:

- EX6: the check asks for "Cues name roles, never a venue's equipment" in place of "A cue names roles, the venue binds them". Rejected on three sources. First, the jargon table does not retire the verb: row C60's own wording keeps "binding the pack's names to real equipment", row A28 replaces the phrase "which real instrument each of the pack's names binds to" in the Venue fit part's description, and row C75 replaces "binds the installation profile", a different phrase. Second, the sources use the verb as plain English: the glossary's entry is "Lighting role / binding / fallback" (`CONTEXT.md`, named in EX6 `status`), QT13 `situation` has the technician "bind each of the pack's names (lights, speakers, screens) to a real instrument on one page", and EX6's own `throughWhat` says "the venue profile binds each name to an instrument", with the `case` saying "bound per venue". So the check's claim that the venue binds nothing fails against the item. Third, the suggested title keeps only the `mustNotNeed` half (no venue names in the pack) and drops the half the `case` and `throughWhat` state, that each name is bound at the venue, which is what makes the case an extension case for the venue technician as well as the designer. The title stands.

After the check: 66 titles, three to eight words each, all unique across both files; the six new titles were compared against the other 65 and against the promise, flaw, decision and question titles in `report/site/decisions.json`, `report/2026-10-31-cause-cards.json`, `report/2026-10-31-engine-jobs.json`, `report/2026-11-01-engine-shape.json` and `DECISIONS.md`, with no match.
