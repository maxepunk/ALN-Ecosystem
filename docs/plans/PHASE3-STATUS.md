# PHASE 3 — LIVE EXECUTION STATE

> **Fresh session? Read this first.** Program: `2026-06-11-phase3-program.md`
> (DoD ratified: Phase 3 = A+B+C + toy-pack gate; D/E are Phase 4).
> Design docs (all ratified or open points marked inline):
> `2026-06-13-phase3-1-pack-schemas.md` · `2026-07-09-phase3-1-installation-profile.md`
> · `2026-07-09-phase3-1-standalone-pack-loading.md` · `2026-07-09-phase3-1-one-auth.md`.
> Keep this file CURRENT — update it in every commit that changes execution state.

**Last updated:** 2026-07-10 · **Working branch:** `claude/phase3-foundations`
(parent + all four submodules; slice-sized branches begin when foundations
rebases onto main after the next parent→main merge).

## Where we are

| Item | State |
|---|---|
| Phase 2 (+2.x, + two review rounds, + field fixes) | ✅ merged to all mains, production-validated |
| Phase 3.0 program + all 3.1 design docs | ✅ complete, ratified 2026-07-09 (incl. the ATTRIBUTION CORRECTION — see below) |
| **A1 slice 1** — schemas as files, ALN as a pack, toy pack, manifest generator, 24-test contract suite | ✅ FULLY landed 2026-07-10: TokenData `0b5cd93` pushed to its origin `claude/phase3-foundations`, parent pin bumped, loud-skip guard deleted, staging dir + ref removed. Pack contract suite runs 24/24 in every checkout. |
| A2 runtime pack loading | ⬅ **NEXT** (backend `GET /api/pack/*`, TOKENS_PATH→PACK_PATH, staleness in sync:full//health; design: standalone-loading doc) |
| A3 extraction slices → B0/B pages → C2/C3 | queued per program §3/§4 |

## ⚠ Critical understanding — the attribution model (owner-corrected)

Attribution is NOT separate machinery: the entity field ("teamId" on the
wire) has MODE-DEPENDENT semantics — `ledger` (wallet/shell account) in
blackmarket, `attribution` (byline: "Nova" NPC default, or a character
claiming credit) in detective, flowing to the report's "Exposed By"
column. Encoded in game.schema.json (`modes[].entityRole` /
`defaultEntity`). Do not reintroduce a separate attribution field; the
schema doc §5.2 records the correction.

## ✅ Blocker RESOLVED (2026-07-10): submodule WRITE access

The fix worked: sessions created with the four submodule repos added as
sources (ALN-TokenData, ALNScanner, ALNPlayerScan,
arduino-cyd-player-scanner) can push to all of them — verified by dry-run
AND by the real A1 transplant push. **Keep creating sessions this way**;
a session without the submodule sources is still parent-push-only.

The pending transplant is DONE: TokenData `0b5cd93` is on its origin
`claude/phase3-foundations`, the parent pin is bumped, the loud-skip guard
in `backend/tests/contract/pack/pack-schemas.test.js` is deleted, and
`docs/staging/tokendata-a1/` + the `staging/tokendata-phase3-a1` ref are
removed. From here on, a skipped pack contract suite means something is
genuinely wrong (stale pin), not the known A1 gap.

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

## Open design points (owner, non-blocking — proceed on defaults if unanswered)

1. Standalone-loading doc §7: bundled-fallback warning badge posture; and
   confirm no-mid-session pack swaps.
2. One-auth doc §6: token lifetimes (operator 24h / device 7d / session
   30d); scoreboard as auto-minted `display/observe` token.

## Owner task list (unchanged, can trickle in)

- E1 spikes: S1 iPhone-taps-token; S2 Cloudflare DNS-01 cert on the Pi
  (run at home; kit-network posture decided — see
  `docs/decisions/2026-07-09-kit-network-posture.md`; router = owned
  TP-Link Archer, guidance to be router-agnostic).
- Confirm ESP-1 verdict (REJECTED_NO_SESSION content display,
  `Application.h` decision point) and whether Tier H ran on the Pi
  post-merge.
- Housekeeping someday: delete merged phase2 PR branches; bump nested
  `data/` pins past the schema commit.
