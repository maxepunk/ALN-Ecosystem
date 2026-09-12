# CONTEXT-MAP.md — where the vocabulary lives

The map of `CONTEXT.md` files, per `docs/agents/domain.md` (root
CLAUDE.md references this file; it was a dead reference until
2026-09-12 — created then as part of the post-walk container audit).

| Scope | File | Status |
|---|---|---|
| System-wide (the ubiquitous language) | `CONTEXT.md` (root) | SEEDED 2026-08-29; the authoritative vocabulary |
| Per-component | `<component>/CONTEXT.md` | none exist yet — created lazily when a component grows vocabulary the root file shouldn't carry; add a row here when one is created |

Rule: read the root `CONTEXT.md` before designing or naming
anything. A per-component file supplements the root, never
contradicts it; conflicts resolve upward into the root file.
