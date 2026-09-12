# The truth sweep's audit — three readers (reading only)

You read; you write exactly one file, the fact sheet named under Output. Change nothing else, run no git write commands, run no tests except the read-only `npx jest <file>` runs named below, dispatch no subagents. Work only under `/home/user/ALN-Ecosystem/`; the top-level `/home/user/ALNScanner` and `/home/user/ALN-TokenData` directories are stale clones: never read them. Every claim cites file:line; every count is verified by a grep you paste. Model: Sonnet.

The sheet OPENS with a section "Conclusions (at most 40 lines)": the facts most likely to change the design, the risks, and the gaps between the plan and the code. The orchestrator reads only that section; the implementer reads the whole sheet.

## Why
The roadmap's truth sweep: audit every path from an engine event to what the GM panel shows, and fix every place the panel shows something false. The census `docs/plans/2026-09-12-block3-truth-sweep-census.md` (tree `e87f8c5`) inventoried the paths; the tree has since gained the dormancy core (three health words, the display service, the door). This audit verifies truth path by path on the CURRENT tree and returns findings, each a concrete false display with the producer value, the rendered value, and the file:line on both sides. Three readers, one file each.

## Reader A — producers and the contract (backend)
For each of the 10 domains (census §1, §2): the push-time producer function, its top-level keys, the AsyncAPI `DomainState*` schema, and every key mismatch; the debounce and the undebounced paths; `sync:full`'s builders (census §3) versus the domain producers: any field present in one and absent in the other. Output `/home/user/ALN-Ecosystem/.superpowers/sdd/2026-09-12-block2-hardening-plan/sweep-audit-producers.md`.

## Reader B — transport and renderers (scanner)
For each domain: the `messageRouters.js` route into the StateStore, the renderer that consumes it, the fields it reads, the fields it drops or reshapes (census §4, §5), any domain without a renderer, any renderer reading a key the producer never sends (after the dormancy core: `door`, `display`). Output `/home/user/ALN-Ecosystem/.superpowers/sdd/2026-09-12-block2-hardening-plan/sweep-audit-renderers.md`.

## Reader C — reconnect restore and the five recorded desync classes
The 10 restore paths on `sync:full` (census §3 and §7): which sections restore which domain, the key mapping, what an EMPTY section does (stale state left on screen?); then each of the five recorded desync classes (census §8): the current code on both sides and whether the class is still reachable, with the exact steps a rig test would take to show it. Output `/home/user/ALN-Ecosystem/.superpowers/sdd/2026-09-12-block2-hardening-plan/sweep-audit-restore.md`.

## Completion criterion (each reader)
Every domain covered; every finding has producer file:line, renderer file:line, the two values, and a one-line statement of what the GM would see that is false; the census counts re-verified by grep on the current tree (state the new counts).

## Output
One file per reader as named. Reply with at most three lines: status, path, the number of findings.
