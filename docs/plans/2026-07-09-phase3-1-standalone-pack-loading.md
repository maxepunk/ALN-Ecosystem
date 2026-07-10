# Phase 3.1 — Standalone Pack Loading Design (A2's hard half)

**Date:** 2026-07-09
**Status:** DRAFT for owner review (deliverable 3 of the program §10;
resolves program §6.1).
**Problem:** networked clients fetch the active pack from the orchestrator
(`GET /api/pack/*`). A STANDALONE GM scanner has no orchestrator — today it
bakes scoring config and tokens in at Vite build time, which is the
F-TOOL-05 silent-stale-scoring class. Standalone devices must (a) work with
zero network at game time, (b) take pack updates WITHOUT an app rebuild,
(c) make the loaded pack version VISIBLE.

## 1. Core split: app shell vs pack channel

The engine client (app shell) and the game pack are delivered on separate
channels everywhere:

| Deployment | App shell channel | Pack channel |
|---|---|---|
| Networked (served from orchestrator) | orchestrator static | `GET /api/pack/*` (manifest + files) |
| Standalone web (GitHub Pages) | Pages deploy | **same-origin `./data/` static** — the pack IS the published submodule content |
| ESP32 | firmware flash | asset-manifest sync (existing, extended with pack files) |

The standalone insight: **the update channel already exists.** Both scanner
Pages deploys already publish the ALN-TokenData submodule at `./data/`
(that's how tokens.json ships today, and `sync.py --deploy` is the
publishing flow). Since the pack lives in that submodule (E9), publishing a
pack update to standalone devices is the EXISTING sync flow — the change is
that the scanner reads game config from there at RUNTIME instead of
importing it at build time.

## 2. Load order (client, all web deployments)

```
1. FETCH  pack-manifest.json from the pack URL (small, network-first)
   ├─ hash == cached hash → serve pack from SW cache (fast path)
   ├─ hash != cached hash → staged refresh (§3), then serve new pack
   └─ fetch fails (offline) ↓
2. CACHE  last successfully-activated pack from the service worker
   └─ none (first run offline) ↓
3. BUNDLED snapshot — a pack copy embedded at build time, last resort only
```

Every load records `{version, contentHash, source: network|cache|bundled}`
and the UI displays it (§4).

## 3. Staged, atomic refresh (no mixed-version packs)

A pack update fetched file-by-file into the live cache could leave v1
strings with v2 scoring after an interrupted refresh. Instead:

1. Fetch the new manifest; diff sha1s against the active cache (the ESP32
   manifest machinery's model, reused).
2. Fetch changed files into a STAGING cache (`aln-pack-<newHash>`),
   verifying each file's sha1; copy unchanged files from the active cache.
3. Only when the staging cache is COMPLETE and verified: flip the active-
   pack pointer (one IDB/localStorage write), delete the old cache.
4. Any failure → staging discarded, active pack untouched.

**Activation timing:** a newly-flipped pack takes effect at APP START or
NEW-SESSION only — never mid-session (a session's rules are frozen at
start; this is also what makes scoring reproducible per session). The
networked hot-apply path (E10) is a separate orchestrator-driven flow and
inherits the same session-boundary rule for rules-bearing files.

## 4. Staleness visibility (the F-TOOL-05 killer)

- Scanner UI shows `pack <version> (<hash-prefix>) · <source>` in
  settings/about AND a warning badge when running from `bundled` (never
  refreshed) — a GM can eyeball-compare devices.
- Networked: every client reports its loaded pack hash in the WebSocket
  handshake / heartbeat; `sync:full` and `/health` carry the SERVER's
  active hash; preflight (C1 §3.5) fails on mismatch. Standalone: the
  displayed hash is the human check.
- The Vite `import scoring-config.json` is deleted; `scoring.js` reads
  from the runtime-loaded pack (game.json `scoring` block), with the
  legacy-file fallback shim during migration only.

## 5. Per-client notes

- **GM scanner (Vite):** gains a `packLoader` module implementing §2-§3;
  the bundled snapshot is produced at build time from the submodule (so a
  fresh build's fallback equals the pack at build date — same as today's
  behavior, now labeled as the fallback it always was).
- **PWA player scanner (no-build):** already network-first on tokens.json
  with cache fallback (F-PARITY-07); extends the same SW pattern to the
  pack file set + manifest-driven staging. Its "bundled" tier is the
  committed repo copy it is served from — trivially present.
- **ESP32:** pack files (game-relevant subset: tokens + strings the
  firmware renders) ride the existing sha1 asset-manifest sync; the
  firmware's manifest already handles verify-and-retry. Pack version
  surfaces in the boot log + serial CONFIG.
- **Backend:** `GET /api/pack/manifest` + `GET /api/pack/files/<path>`
  serve the ACTIVE pack directory (A2); TOKENS_PATH generalizes to
  PACK_PATH for the harness (the 2.x.4 seam grown as planned).

## 6. Failure-mode table

| Scenario | Result |
|---|---|
| First run, offline | bundled snapshot, badge shown |
| Refresh interrupted / file sha1 mismatch | active pack untouched (staging discarded) |
| Manifest fetch 404s (mis-deployed Pages) | cache (or bundled) + badge |
| Device offline whole event | last activated pack, correct and labeled |
| Two devices, different pack versions | visible via displayed hash (standalone) / preflight failure (networked) |

## 7. Open points for owner review

1. **Bundled-fallback badge posture:** treat `bundled` as a warning state
   (yellow badge, "pack never refreshed on this device") — OK, or too
   noisy for devices that are deliberately imaged-and-frozen?
2. **Session-boundary activation** (no mid-session pack swaps, even
   networked hot-apply for rules files) — confirm this matches your
   operational intuition.
