# Domain Docs

How the engineering skills should consume this repo's domain documentation when exploring the codebase.

## Before exploring, read these

- **`CONTEXT-MAP.md`** at the repo root if it exists: it points at one `CONTEXT.md` per context. Read each one relevant to the topic.
- **`docs/adr/`**: read ADRs that touch the area you're about to work in. In this repo, also check the component's own `docs/adr/` for context-scoped decisions.

If any of these files don't exist, **proceed silently**. Don't flag their absence; don't suggest creating them upfront. The `/domain-modeling` skill (reached via `/grill-with-docs` and `/improve-codebase-architecture`) creates them lazily when terms or decisions actually get resolved.

## File structure — multi-context (chosen at setup, 2026-08-29)

This is a git-submodule monorepo; the "contexts" are its components, each of
which already carries its own `CLAUDE.md`:

```
/                              ← CONTEXT-MAP.md (lazy) + docs/adr/ (system-wide)
├── backend/                   ← CONTEXT.md + docs/adr/ (orchestrator engine)
├── config-tool/               ← CONTEXT.md + docs/adr/
├── ALNScanner/                ← CONTEXT.md + docs/adr/ (SUBMODULE — lives in its own repo)
├── aln-memory-scanner/        ← same (submodule)
├── arduino-cyd-player-scanner/← same (submodule)
└── ALN-TokenData/             ← same (submodule — data + schemas)
```

Note: a `CONTEXT.md`/ADR written inside a submodule is a commit in THAT
repo — it rides the same lockstep-train discipline as any other submodule
change (see `SUBMODULE_MANAGEMENT.md`).

## This repo's existing decision corpus

This repo already carries a dense, authoritative decision record that
predates these skills. Treat it exactly like the ADR corpus below — read
what touches your area, use its vocabulary, and flag contradictions rather
than silently overriding:

- `docs/plans/` — the Phase 3 program doc, per-slice design docs (each with
  ratified decisions, owner rulings, and adjudication records), and
  `PHASE3-STATUS.md` (status rows, debt ledger, development model)
- `docs/reviews/2026-06-platform-review/capability-matrix.md` — the
  engine/game/venue classification of every capability
- Per-component `CLAUDE.md` files — component architecture + gotchas
- `docs/SCORING_LOGIC.md` — scoring single source of truth

## Use the glossary's vocabulary

When your output names a domain concept (in an issue title, a refactor proposal, a hypothesis, a test name), use the term as defined in `CONTEXT.md`. Don't drift to synonyms the glossary explicitly avoids.

If the concept you need isn't in the glossary yet, that's a signal: either you're inventing language the project doesn't use (reconsider) or there's a real gap (note it for `/domain-modeling`).

## Flag ADR conflicts

If your output contradicts an existing ADR (or a ratified decision in the
corpus above), surface it explicitly rather than silently overriding:

> _Contradicts ADR-0007 (event-sourced orders), but worth reopening because…_
