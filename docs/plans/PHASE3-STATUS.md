# PHASE 3 — LIVE EXECUTION STATE

> **Fresh session? Read this first.** Program: `2026-06-11-phase3-program.md`
> (DoD ratified: Phase 3 = A+B+C + toy-pack gate; D/E are Phase 4).
> Design docs (all ratified or open points marked inline):
> `2026-06-13-phase3-1-pack-schemas.md` · `2026-07-09-phase3-1-installation-profile.md`
> · `2026-07-09-phase3-1-standalone-pack-loading.md` · `2026-07-09-phase3-1-one-auth.md`.
> Keep this file CURRENT — update it in every commit that changes execution state.

**Last updated:** 2026-07-09 · **Working branch:** `claude/phase3-foundations`
(parent + all four submodules; slice-sized branches begin when foundations
rebases onto main after the next parent→main merge).

## Where we are

| Item | State |
|---|---|
| Phase 2 (+2.x, + two review rounds, + field fixes) | ✅ merged to all mains, production-validated |
| Phase 3.0 program + all 3.1 design docs | ✅ complete, ratified 2026-07-09 (incl. the ATTRIBUTION CORRECTION — see below) |
| **A1 slice 1** — schemas as files, ALN as a pack, toy pack, manifest generator, 24-test contract suite | ✅ landed (parent `30c70c3`..`509213f`) — with ONE pending transplant (blocker below) |
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

## 🔴 Active blocker: submodule WRITE access

Sessions can READ all repos but can only PUSH to maxepunk/ALN-Ecosystem —
the git proxy scopes writes to the session's SOURCES, and add_repo tooling
is not exposed. **Fix: owner creates sessions with the four submodule repos
added as sources** (ALN-TokenData, ALNScanner, ALNPlayerScan,
arduino-cyd-player-scanner).

**Pending transplant when write access exists** (full instructions:
`docs/staging/tokendata-a1/README.md`): the A1 pack artifacts' real home is
ALN-TokenData commit `0b5cd93` — preserved on GitHub as parent ref
`staging/tokendata-phase3-a1` AND as plain files in that staging dir. Steps:
push it to ALN-TokenData `claude/phase3-foundations` → bump the parent
submodule pin → DELETE the transient loud-skip guard in
`backend/tests/contract/pack/pack-schemas.test.js` → delete the staging dir
+ ref. Until then the pack contract suite loud-skips in CI (24/24 green
locally when the submodule worktree has the artifacts).

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
