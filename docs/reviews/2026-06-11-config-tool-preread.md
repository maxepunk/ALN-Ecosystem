# Config-Tool Architecture Pre-Read (Track B fitness)

**Date:** 2026-06-11 (Phase 3 prep, per owner request)
**Question:** can the current config-tool carry Track B (two-workspace pack
authoring per docs/proposals/2026-06-10-phase3-authoring-tooling.md), or does
it need redesign first? The proposal asserted "evolve, don't rewrite" (§5);
the owner asked for that posture to be stress-tested before we build on it.
**Method:** full factual re-map of the codebase (post-Phase-2 state), read
against the Phase 1 review (configtool-scripts-review.md), the TRIAGE 1f
fix-now batch (landed), and Track B/C scope in the Phase 3 program doc.

## 1. Verdict up front

**"Evolve, don't rewrite" survives — conditionally.** The codebase is small
(~5,900 LOC), clean (no dead code, no TODO debt, consistent patterns), and
Phase 2 fixed the entire write-safety class (schema validators on every
write path, atomic tmp+rename everywhere, transactional preset load, env
injection defense, secret masking, localhost default bind, an HTTP test
harness). Those are exactly the foundations you'd want before expansion,
and they carry over fully.

**The condition:** Track B is NOT "add five sections to the existing
shell." Three structural changes must land FIRST (call them **B0**),
because every page in the proposal assumes them. Building pages without B0
would wire each new editor to the wrong persistence model and then rewire
all of them.

## 2. What the tool is today (one paragraph)

A 27-endpoint Express server (express + multer only) that edits four LIVE
config files in place — `backend/.env`, `backend/config/environment/
{cues,routing}.json`, `ALN-TokenData/scoring-config.json` — plus asset
upload into `backend/public/{audio,videos}`, a read-only token browser, a
flat snapshot/restore preset system, and proxies to the orchestrator
(music) and Home Assistant (scenes). The frontend is a no-build vanilla-JS
SPA: six lazy-loaded section modules over a shared `render(container,
config, ctx)` / `markDirty` / `save()` lifecycle, an `el()` DOM-builder
idiom, a real visual timeline component (zoom, lane packing, drag), and
hardcoded trigger/action vocabularies mirrored by hand from the backend.

## 3. The structural gap: Track B changes the data model, not the page count

Today's model: **the running system is the document.** Every save writes
the live files the backend will read on next restart. Presets are whole-
system snapshots of those same files.

Track B's decided model (Q1: draft + publish): **the pack is the
document.** The Design workspace edits a versioned DRAFT of a game pack —
an artifact with identity, version, content hash, completeness validation,
diff-vs-running, export/import — and an explicit Publish makes it active.
The Venue workspace edits an INSTALLATION PROFILE (C1) that replaces
presets. The live files stop being the edit target and become (at most)
the publish projection.

Nothing in the current tool models any of that: `configManager.js` is a
fixed five-path map into live locations; sections receive one merged
`config` snapshot; "dirty" means "differs from live file." This is the
real Track B engineering, and it's in the tool's server layer and app
shell — not in the pages.

## 4. B0 — the three prerequisite workstreams

**B0.1 — Pack/profile store (server).** A store module alongside (then
replacing parts of) configManager: draft packs + active-pack pointer +
installation profiles, each versioned + content-hashed, with
draft→validate→publish lifecycle and bundle export/import (reuse the sha1
asset-manifest machinery, per the proposal). Per E9 the published pack
targets the ALN-TokenData submodule (extended); drafts live in a
tool-private workspace dir; publish gains the "commit & push pack"
affordance (kills F-TOOL-22's silent-dirty-submodule trap). The existing
validators.js pattern extends naturally — schema-per-store-kind, shared
with backend loaders per the program doc's "one definition, three
enforcers."

**B0.2 — App-shell state + frontend testability.** Cross-cutting state the
current shell has no home for: which pack is open, draft-vs-published
status, per-page dirty, pack-wide validation results, staleness vs the
running backend. Introduce a small shared store (vanilla, no framework —
an event-emitting module is enough) and adopt the **model-module
discipline** that `musicModel.js` already proves: pure state machine per
page, thin DOM layer over it, model unit-tested in node:test. Add a minimal
DOM harness (jsdom) for the thin layers + a couple of Playwright smokes
(the repo already has deep Playwright experience). The current frontend is
~2,400 LOC with zero tests — fine at six read-mostly sections, not fine
under 5 new editor pages (the F-TOOL-13 detached-DOM class is what
untested DOM code does).

**B0.3 — Auth + served vocabulary.** The decided posture (Q2: LAN + shared
admin password + JWT + HTTPS, reusing the backend's pattern) goes in
before the tool becomes more capable — it's also the first consumer of the
O3 one-auth-story design, so build it FROM that 3.1 design section, not ad
hoc. Same milestone: stop hand-mirroring TRIGGER_EVENTS / ACTION_DEFS /
sink names — the backend serves its command+trigger vocabulary (it already
serves scenes/playlists/tokens via the same pattern), killing the
F-TOOL-09/32 drift class permanently; with packs, parts of the vocabulary
(modes, lighting roles) become pack-defined anyway, so served-vocab is the
only model that survives Phase 3 at all.

## 5. Keep / refactor / rebuild, per area

| Area | Verdict | Notes |
|---|---|---|
| Express server + routes + supertest harness | **Keep** | Add auth middleware (B0.3); routes grow per store |
| validators.js (schema-per-write) | **Keep, extend** | Becomes schema-per-store-kind; shares JSON Schemas with backend |
| Atomic write + transactional-load machinery | **Keep** | Already the right pattern; store reuses it |
| configManager.js five-path live-file map | **Refactor (B0.1)** | Live files become publish projection; paths stay for Venue/infra editing |
| Preset system | **Replace** | Superseded by installation profiles (C1) + pack store; migration: old presets importable as "legacy snapshot" or explicitly retired (owner call, low stakes) |
| App shell (nav/dirty/save lifecycle) | **Refactor (B0.2)** | Two workspace roots; shared store; lifecycle survives |
| el() idiom + CSS system | **Keep** | Adequate for all proposed pages incl. previews |
| timelineView.js | **Keep, upgrade** | The E5 three-segment renderer builds ON it — real asset, 382 LOC of the hardest UI already working |
| cueEditor / commandForm / conditionBuilder | **Keep, re-source vocab** | Hardcoded dicts → fetched vocabulary (B0.3); role pickers replace raw HA entity IDs (B8) |
| tokenBrowser | **Keep** | Becomes the Content view's base |
| music section + musicModel | **Keep** | Model-module exemplar for all new pages |
| Frontend test coverage | **Build (B0.2)** | jsdom + model modules + Playwright smokes |
| No-build vanilla JS stance | **Keep** | Nothing in Track B requires a framework; revisit only if preview panes demand it (proposal §5 caveat stands) |

## 6. Topology question (for the 3.1 docs, with recommendation)

Should config-tool stay a separate process (port 9000) or fold into the
backend? **Recommend: stay separate.** It protects the live game (the tool
can be down/up without touching the orchestrator, preserving E7's pre-show
posture), the proxy pattern it needs already exists and works, and the
one-auth story covers two processes fine (shared secret/JWT). Cost: schema
sharing needs a deliberate home (a shared `schemas/` consumed by both — to
be settled in the A1 schema draft). Folding in would buy marginal
simplicity at the price of coupling authoring-tool deploys to the live
game engine — wrong trade for a kit that runs shows.

## 7. Implications for the Phase 3 program

- Track B gains an explicit **B0 foundations milestone** (the three
  workstreams above) gated on the A1/C1 schema drafts and the O3 auth
  design — i.e., B0 is the tool-side implementation of those 3.1 docs.
  Pages then proceed in the proposal's order unchanged.
- Estimate impact: +1 session (B0) on top of Track B's existing 2-3; page
  estimates unchanged — arguably safer, since pages now land on the right
  substrate instead of being rewired later.
- The A2 staleness-visibility work (consumers report loaded pack
  version/hash) is what makes the tool's "running vs on-disk" indicator
  honest — B0.1 and A2 should co-design that surface.

## 8. Owner decisions surfaced (none blocking, all routable to 3.1 docs)

1. Tool topology — separate process (recommended, §6) vs fold-in.
2. Legacy presets — importable as legacy snapshots vs retired at cutover.
3. Draft-pack location — tool-private drafts dir + publish-into-submodule
   (recommended) vs drafts inside the submodule working tree.
