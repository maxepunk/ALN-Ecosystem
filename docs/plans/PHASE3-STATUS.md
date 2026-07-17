# PHASE 3 — LIVE EXECUTION STATE

> **Fresh session? Read this first.** Program: `2026-06-11-phase3-program.md`
> (DoD ratified: Phase 3 = A+B+C + toy-pack gate; D/E are Phase 4).
> Design docs (all ratified or open points marked inline):
> `2026-06-13-phase3-1-pack-schemas.md` · `2026-07-09-phase3-1-installation-profile.md`
> · `2026-07-09-phase3-1-standalone-pack-loading.md` · `2026-07-09-phase3-1-one-auth.md`.
> Keep this file CURRENT — update it in every commit that changes execution state.

**Last updated:** 2026-07-17 · **Working branch:** `claude/phase3-foundations`
(parent + all four submodules). The parent→main merge has happened (live-state
parity PRs, 2026-07-11). Decision: FINISH A2 on foundations — `origin/main`
was merged back into foundations 2026-07-17 (ALNScanner pin fast-forwarded to
main's `e38c1ea`) — then rebase foundations onto main at the A2 boundary;
slice-sized branches begin there.

## Where we are

| Item | State |
|---|---|
| Phase 2 (+2.x, + two review rounds, + field fixes) | ✅ merged to all mains, production-validated |
| Phase 3.0 program + all 3.1 design docs | ✅ complete, ratified 2026-07-09 (incl. the ATTRIBUTION CORRECTION — see below) |
| **A1 slice 1** — schemas as files, ALN as a pack, toy pack, manifest generator, 24-test contract suite | ✅ FULLY landed 2026-07-10: TokenData `0b5cd93` on its origin, parent pin bumped, loud-skip guard deleted. Suite runs 24/24 in every checkout. |
| **Live-state parity cluster** (field-reported stale-UI bugs) | ✅ **MERGED TO MAIN 2026-07-11 by owner** — parent PR #18 then ALNScanner PR #11, in the documented order. Owner follow-ups on the PR branch (`6d03cb7` music gameclock pause/resume also refresh state — closes the last idle-FIFO dependency; `77f905f` docker-lifecycle repaired under the blanked HA token) were absorbed into foundations 2026-07-17 via merge of `origin/main`. Zero open PRs in either repo. |
| **A2 runtime pack loading** | ✅ **COMPLETE 2026-07-17** (parent `e73a020`→`3267b30`+, ALNScanner `df7cfed`/`707368d`, PWA `73ac71c`, ESP32 `92d763d`). Pack channel contracted + served (whitelist-only, frozen at boot); staleness identity reported by EVERY consumer (backend /health + sync:full + session stamp; GM UI + WS handshake; PWA config page; ESP32 boot log + CONFIG); PACK_PATH harness seam; GM packLoader with staged atomic refresh + runtime scoring (F-TOOL-05 dead); sync pipeline regenerates the pack manifest (Python builder, byte-parity-pinned); sync:full completeness structural test. Verified: backend 2187 unit/contract + 342 integration + coverage ratchet; scanner 1389 + ratchet + build artifacts + 07b/07c full-stack E2E; PWA 161; ESP32 native 120; scripts 66. Execution detail: "A2 execution record" below. |
| 2026-07-17 plan review (blind-spot audit) | ✅ six real gaps + five ambiguities found and resolved; all folded into A2 and landed |
| **A2 boundary work** | ⬅ **NEXT**: rebase foundations onto main (per the branch decision above — foundations currently carries main merged-in, so this is the clean cutover point); slice-sized branches begin. Then **A3 slice 1** (modes & mode names extraction; toy pack as second consumer; Tier L against BOTH packs via the now-landed PACK_PATH seam). |
| A3 extraction slices → B0/B pages → C2/C3 | queued per program §3/§4 |

## A2 execution record (COMPLETE — scope as set by the 2026-07-17 plan review)

- **Backend:** ~~pack endpoint contract tests + packService unit tests~~ ✅
  + ~~load-time pack identity capture~~ ✅ + ~~toy-pack exit test~~ ✅
  (landed 2026-07-17: `activatePack()` freezes identity AND the serving
  whitelist at boot with a loud drift warn; `/api/pack/*` contract-tested
  against BOTH packs incl. whitelist/traversal 404s; the shared OpenAPI
  `Error` enum gained `NOT_FOUND` — long-standing wire reality first pinned
  by these 404 tests). ~~TOKENS_PATH→PACK_PATH~~ ✅ (landed 2026-07-17
  across all 6 consumers; injection is now a pack DIRECTORY with NO
  silent fallback — a pack missing tokens.json refuses to boot; parity
  fixture became `packs/parity-pack/`; verified by live boot on toy-heist
  + the full 07c E2E flow with the migrated harness). ~~Session pack
  stamping~~ ✅ (landed 2026-07-17: `session.metadata.pack` stamped at
  creation from the ACTIVE pack, nullable `pack` on the Session metadata
  schema in BOTH contracts, legacy sessions migrate to explicit null, and
  restore loud-warns on any mismatch — including unknown-provenance
  legacy sessions). **The backend half of A2 is DONE** — remaining A2
  work is client-side (GM scanner packLoader) + ride-alongs.
- ~~**GM scanner:**~~ ✅ (landed 2026-07-17, ALNScanner `df7cfed`):
  packLoader (network→cache→bundled, staged atomic refresh, serving-origin
  channel rule); runtime scoring from pack game.json with the loud baked
  shim (ledger L2 tripwire live); settings pack line + bundled badge;
  client packHash in the WS handshake (server-side capture + mismatch
  warn landed `23e4610`). ALSO: sw.js cache GC now EXEMPTS `aln-pack-*`
  caches — the SW's activate handler would have wiped the activated pack
  on every SW update (found in review during implementation). Verified:
  1389 unit tests + coverage ratchet + build-artifact suite + full-stack
  07b/07c E2E against the rebuilt dist. NOTE: a live end-to-end
  mismatch-warn E2E assertion (client bundled hash vs a different server
  pack) rides the C1 preflight slice, where mismatch becomes enforcement —
  both ends are unit-pinned today.
- ~~**Pipeline (load-bearing):**~~ ✅ (landed 2026-07-17):
  `sync_notion_to_tokens.py` now regenerates `pack-manifest.json` after
  writing tokens.json via `scripts/build_pack_manifest.py` — a Python
  port of the Node builder, proven byte-identical TRANSITIVELY: pytest
  asserts it reproduces the committed manifests, which the backend
  contract suite pins to the Node builder (no Node needed in the Python
  test env).
- ~~**Ride-alongs (scoped by review):**~~ ✅ (landed 2026-07-17):
  PWA `73ac71c` — `loadPackInfo()` network-first identity fetch per
  serving origin + Game Pack line in config.html (identity only, staged
  refresh deferred per ledger L3; 161 tests green). ESP32 `92d763d` —
  pack identity EMBEDDED in the asset manifest by the sync pipeline
  (`generate_asset_manifest.build_manifest(pack_dir=…)`, reading the
  TOP-LEVEL TokenData, never the lag-prone nested pin; pack-manifest
  rebuild reordered BEFORE the asset manifest so the embedded identity is
  fresh), captured by AssetService during sync, surfaced in boot log +
  serial CONFIG (120/120 native; scripts 66/66).

**Decisions taken on review defaults (owner may veto):**
- GM-scanner standalone pack origin = **canonical cross-origin pack URL**
  (the published TokenData content; GitHub serves
  `Access-Control-Allow-Origin: *`). Reason: the ALNScanner Pages workflow
  publishes ONLY `./dist` from the pinned submodule, so a same-origin
  `./data/` network tier doesn't exist there — bundled-only would rebuild
  the F-TOOL-05 coupling A2 exists to remove.
- Refresh attempts at app start + new-session creation only; no mid-session
  periodic retries (consistent with session-frozen rules).
- Standalone-loading §7 defaults confirmed in effect: bundled warning badge
  shown; no mid-session pack swaps.

## Transitional-debt ledger

Doctrine: every deliberately-transitional construct gets a row here with a
retirement trigger and a tripwire; retire the row in the commit that
retires the debt.

| # | Debt | Retirement trigger | Tripwire |
|---|---|---|---|
| L1 | Scoring dual-source window: GM scanner reads pack `game.json` scoring (A2) while backend still reads `scoring-config.json` | A3 slice 2 — backend reads game.json, `scoring-config.json` deleted from TokenData | Migration-parity contract test in `pack-schemas.test.js` pins game.json scoring == scoring-config.json (its comment already says delete when the legacy file retires) |
| L2 | GM scanner legacy scoring shim: baked build-time values as last-resort fallback. NOTE: scoring-config.json is deliberately NOT pack inventory — the shim falls back to BAKED values, never a fetched file | One release cycle after A2 ships everywhere | Shim logs a loud warn when used (added with the packLoader work); `grep scoring-config ALNScanner/src` |
| L3 | PWA pack loading scoped to visibility only (manifest fetch + hash display; no staged atomic refresh) | PWA becomes rules-bearing (scoring/strings), or a field staleness incident | This row + the ride-along commit message |
| L4 | `teamId` stays on the wire as the entity-field alias (semantics are mode-dependent per the attribution model) | Phase 4 wire migration (pack-schemas doc §2 entities) | Contracts document the alias at every `teamId` site |

## Spike results / field validation (2026-07-17, owner-reported)

- **S1 iPhone-taps-token: PASS** — the NDEF URL background read fires on a
  production token. Recorded as the go-signal input for the Phase 4 E-gate
  (tap-to-web receiving experience).
- **ESP32 scanners field-validated** — working well after the fixes now on
  main; the ESP-1 concern is effectively closed by field use. (A formal
  Tier H run on the Pi remains unconfirmed — owner item.)
- **S2 (Cloudflare DNS-01 cert on the Pi): still open** — gates E2 (real
  domain + cert), which the program wants early for broadest payoff.

## ⚠ Critical understanding — the attribution model (owner-corrected)

Attribution is NOT separate machinery: the entity field ("teamId" on the
wire) has MODE-DEPENDENT semantics — `ledger` (wallet/shell account) in
blackmarket, `attribution` (byline: "Nova" NPC default, or a character
claiming credit) in detective, flowing to the report's "Exposed By"
column. Encoded in game.schema.json (`modes[].entityRole` /
`defaultEntity`). Do not reintroduce a separate attribution field; the
schema doc §5.2 records the correction.

## ✅ Blocker RESOLVED (2026-07-10): submodule WRITE access

Sessions created with the four submodule repos added as sources
(ALN-TokenData, ALNScanner, ALNPlayerScan, arduino-cyd-player-scanner) can
push to all of them — verified by dry-run AND by the real A1 transplant
push. **Keep creating sessions this way**; a session without the submodule
sources is still parent-push-only.

One leftover the proxy won't allow from a session (branch DELETION 403s
even where commit pushes succeed): the obsolete parent-repo ref
`staging/tokendata-phase3-a1` still exists on origin. Owner: delete it
from the GitHub UI or any local clone
(`git push origin :staging/tokendata-phase3-a1`) — see owner task list.

## Session mechanics (recurring gotchas)

- Bootstrap hook (`.claude/hooks/session-start.sh`) handles cold-start; it
  leaves submodules DETACHED when two branches share a pin — check out
  `claude/phase3-foundations` explicitly before submodule work.
- The proxy sometimes installs a global `url.…insteadOf` rewriting
  github.com → proxy; if submodule FETCHES 403, remove it
  (`git config --global --unset url.<proxy>.insteadof`) — reads are
  allowed directly.
- Never commit a submodule pin that isn't pushed to that submodule's
  origin (breaks every fresh clone with "not our ref").
- Manifest freshness: after editing any pack file, run
  `node backend/scripts/build-pack-manifest.js <packDir>` or the contract
  suite fails (by design).

## Open design points (owner, non-blocking — proceeding on defaults)

1. Standalone-loading §7 defaults + the 2026-07-17 review defaults (see
   "Decisions taken" above) — in effect unless vetoed.
2. One-auth doc §6: token lifetimes (operator 24h / device 7d / session
   30d); scoreboard as auto-minted `display/observe` token.

## Owner task list (can trickle in)

- ~~S1 iPhone-taps-token~~ ✅ PASS 2026-07-17. Remaining spike: S2
  Cloudflare DNS-01 cert on the Pi (run at home; kit-network posture
  decided — `docs/decisions/2026-07-09-kit-network-posture.md`; router =
  owned TP-Link Archer, guidance to be router-agnostic).
- ~~Confirm ESP-1 verdict~~ ✅ field-validated 2026-07-17. Still open:
  whether a formal Tier H ran on the Pi post-merge.
- Housekeeping someday: delete merged phase2 PR branches; bump nested
  `data/` pins past the schema commit; delete the obsolete
  `staging/tokendata-phase3-a1` ref on ALN-Ecosystem (sessions get 403 on
  branch deletion, needs owner).
- `backend/.env` is COMMITTED with a live HA long-lived token — it made CI
  jest runs dial a phantom Home Assistant (the lighting flake source,
  neutralized in jest.config.base.js 2026-07-10; docker-lifecycle repaired
  under it in `77f905f`) and is a mild secret-hygiene smell. Decide
  someday: untrack it (deploy keeps a local copy) or keep as-is.
