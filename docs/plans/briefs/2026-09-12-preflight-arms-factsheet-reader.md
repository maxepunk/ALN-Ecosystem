# Fact-sheet reader brief — the preflight arms and the command line (read-only)

You read; you write one file, the fact sheet named under Output. Change
nothing else, run no git write commands, dispatch no subagents.
Vocabulary: `CONTEXT.md` §2 (one truth, the gate), §5 (preflight, paper
vs live, the honesty rule). Model: Sonnet.

## Where you work

Work only under `/home/user/ALN-Ecosystem/`. The top-level
`/home/user/ALNScanner` and `/home/user/ALN-TokenData` directories are
stale clones: never read them. The main checkout may carry another
lane's uncommitted edits to `backend/src/utils/logger.js` and
`backend/tests/e2e/setup/test-server.js`; neither is in your scope.

## Why

The orchestrator writes the implementer brief for the preflight arms
lane from facts, not memory. The plan's pins P8 and P9 and the task
section "the preflight arms and the command line" in
`docs/plans/2026-09-12-block2-hardening-plan.md` §3/§4 name the target;
you establish what exists today, with file:line citations, so the brief
can name exact seams. Cite every claim; run every test file you name and
paste the count line.

## Questions

1. `backend/src/services/preflightService.js` in full: `evaluate()`'s
   signature and return shape today; every row it produces and where
   each comes from; `limits`; whether it holds the last evaluation; the
   session preflight stamp and `restampAfterRestore`; every caller
   (grep) and every test file with its count.
2. `backend/src/gameRules/packNeeds.js` and `gameRules/resolution.js`:
   the need kinds and how a need is declared; `resolve()`'s verdict
   words and its `onAbsent` handling; where a `video-file` need would be
   declared for token videos and cue videos; tests and counts.
3. `backend/src/services/commandExecutor.js` `validateCommand()`: its
   shape, what it checks (sound files, video files, scenes, sinks), how
   it treats a dormant service, and every caller (the truth-sweep audit
   found none in production — confirm with grep).
4. Pack integrity seams: `packService.js` `resolvePackFile` (containment
   today?), the manifest builders (`backend/scripts/build-pack-manifest.js`
   and any other builder — find them by grep for `contentHash`), how
   each treats symlinks; the pack manifest's per-file sha1 field.
5. Delivery seams: `websocket/broadcasts.js` `pushServiceState` and
   every room emission; `websocket/gmAuth.js` room joins and where
   `socket.functions` / `socket.tier` are set (`socketServer.js`); how an
   operator-only push would be filtered today; `syncHelpers.js`
   `buildSyncFullPayload` — does it know the socket's tier?
6. The contract's sites for a new `service:state` domain, with line
   numbers: the `domain` enum, the prose list, any bullets, the
   `DomainState*` schema block, `SyncFull`'s required list and
   properties, and the domain contract test
   (`tests/contract/websocket/service-domain-state.test.js`: its
   producers table and `describe.each`). Use the `held` domain as the
   worked example: list every line it touched.
7. Shell-out and network idioms: is there an `execHelper` (grep
   `execFile`/`exec(` under `backend/src/utils`) with a bounded timeout;
   any `dns.Resolver` or TCP-connect probe today; the display driver's
   `probe()`; how the certificate files are located (`ssl/`, config).
8. `backend/scripts/`: the existing CLI scripts and their idiom (argument
   parsing, `--json`, exit codes); is there any `preflight.js`.
9. `docs/preflight-checklist.md`: its section list and which sections
   the code already verifies; `backend/config/profiles/aln-full-kit.json`
   `network` block and `stations`, `audio.sinks`.
10. Seams this lane will inherit from work that merges before it: the
    profile file check (plan pins P17–P20: the `profile:schema` row and
    `evaluate()` prepending it) and the supervisor lane (P12:
    `service:restart display`, `KNOWN_SERVICES`); name the functions the
    arms will call and what they look like today.

## Completion criterion

Every question answered with file:line citations; every test file named
has a pasted count line from a run this session; the Conclusions section
names the facts that change the design (a pin that assumes something the
code does not have).

## Output

`.superpowers/sdd/2026-09-12-block2-hardening-plan/preflight-arms-factsheet.md`,
opening with `## Conclusions (at most 40 lines)`, then one section per
question. Return to the orchestrator only: status, the path, and the
number of design-changing facts.
