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
| **2026-07-17 ADVERSARIAL five-phase review** | ✅ six lenses, findings R1-R24 in `2026-07-17-adversarial-plan-review.md`; all doc corrections APPLIED same day (program §1/§3/§7/§9/§11, pack-schemas, one-auth, BILL scoping, this file). OWNER decisions: timeline = HONEST accepted (≈13-20, cut set declined); tokens-v2+genericization = ADDED as slice 2b; E2/S2 = warn-only default adopted, S2 run pending. |
| **A2 boundary work** | ⬅ **NEXT**: rebase foundations onto main (per the branch decision above); slice-sized branches begin. Then **A3 per the REVISED slice list (program §3 + §11)**: slice 0 (dual-pack gate infra + capability-gate skeleton + getGameConfig + toy-pack growth) → slice 1 (mode BEHAVIOR to open semantics flags) → slice 2 (rules migration + gate extension) → **slice 2b (tokens v2 + pack-declared category vocabulary — added by owner decision)** → 3a/3b/3c → slice 4 (with the R4 resolver/fallback guard) → 5/6/7. |
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

**PR-review residue (non-blocking, recorded so it isn't lost — PR #12
rounds 5-7 converged to traced approvals):** (a) packLoader timeout
coverage pins the SIGNAL WIRING, not a live hang→abort→fallthrough — a
behavioral timeout test joins the slice-0/C1 test-hardening bucket
alongside the live mismatch-warn E2E; (b) the accepted staging-cache
race (parallel-fetch failure path) is comment-documented but has no
forced-interleaving regression test; (c) `aln-pack-*` caches have no
orphan sweep independent of a successful refresh (sw.js GC exempts them
by design) — revisit only if long-lived devices accumulate strays;
(d) pack JSON reaches computed-key object writes (benign today — packs
are fully trusted content; re-examine when the one-auth/E4 era touches
pack provenance).

**Decisions taken on review defaults (owner may veto):**
- GM-scanner standalone pack origin — **AS BUILT: same-origin static**
  (CORRECTED 2026-07-17, surfaced by PR #12 review round 4): the earlier
  "canonical cross-origin pack URL" text was based on a wrong premise —
  Vite `publicDir` IS the TokenData submodule, so every Pages deploy
  publishes the pinned pack files at the deploy root and a same-origin
  network tier DOES exist there. Staleness property, stated honestly:
  orchestrator-served scanners refresh from the pack channel on every
  load; Pages-standalone scanners refresh when a Pages deploy carries a
  new nested pin (no app-shell rebuild needed, but not
  publish-independent). Cross-origin canonical remains a clean later
  upgrade if Pages-standalone staleness ever matters — owner may direct.
- Refresh attempts at app start + new-session creation only; no mid-session
  periodic retries (consistent with session-frozen rules).
- Standalone-loading §7 defaults confirmed in effect: bundled warning badge
  shown; no mid-session pack swaps.

## 2026-07-17 FORWARD audit (pre-cutover; five dimensions, owner-requested)

Ran after A2 completion, before the branch cutover. Verdict: **A2's as-built
shape is sound — nothing needs to change now** — but the audit found four
findings that reshape A3, and four content-type gaps NO slice covers.

**Findings that reshape A3 (proposed plan changes, owner to ratify):**
- **F1 — Mode names are load-bearing constants.** ~40 branch points key off
  the literal strings 'detective'/'blackmarket' (backend gameRules +
  scanner); the pack's per-mode semantics flags (`scoringPolicy`,
  `entityRole`, `countsTowardGroups`, `displayBehavior`) are read by
  NOTHING. A3 slice 1 must migrate BEHAVIOR to the flags, not just rename
  ids. The backend Joi mode enum is hardcoded (game.schema.json's
  "validated at runtime" claim is currently false).
- **F2 — No engine capability gate; headroom is silently absorbed.** A pack
  declaring `threshold` groups or `per-entity` claims passes the ENTIRE
  test suite green and silently runs as `all`/`once`. `gameClock.duration`/
  `overtimeAt` are never read (the toy pack already diverges silently), and
  the duration contract pin MASKS the gap. Gate home: `activatePack()` +
  scanner packLoader, reading a capability descriptor co-located with
  `gameRules/`; skeleton lands with slice 0 (per the ratified §11 amendment), extended in slice 2 (flipping
  headroom from silently-ignored to loudly-rejected — the stated principle).
- **F3 — The dual-pack Tier L gate has NO mechanism.** Zero tests load
  toy-heist today; the per-slice program rule has no executable gate. Build
  (small): `E2E_PACK_PATH` env honored by every flow's startOrchestrator
  (~20 call sites), an npm script, a CI matrix over {production, toy-heist}.
  Known casualties mapped: flow 27 hard-fails (toy pack needs ≥10
  distinct-owner tokens — grow the toy pack), 07c FAILS against toy-heist
  until slice 2 (correct — it IS the ledger-L1 tripwire), video flows
  self-skip (structural — see F5). Must land FIRST in A3 ("slice 0").
- **F4 — Backend has no game.json reader.** `getGameConfig()` accessor with
  the same activation-snapshot semantics as `getManifest()` — needed by the
  F2 gate (slice 0), the slice-2 scoring/rules migration, AND the
  one-auth grant substrate (the Phase-3 OPERATOR subset per the corrected
  program §7 — adversarial R1; extended for player tiers in Phase 4). One
  accessor serves all three.
- **F9 — "Strings & theming" is THREE slices, not one:** A3a pure
  text/branding; A3b formatting LOGIC (currency forked across 5
  implementations, star rendering 4 ways with a hardcoded 5-star scale);
  A3c CSS/mode taxonomy (mode + memory-type vocabularies live in both code
  and stylesheets). BOOBY TRAP: the scoreboard's "Case File" title is a
  FUNCTIONAL selector (`displayDriver.js` xdotool window search) —
  rebranding it silently breaks HDMI control; extract as shared config
  consumed by both sides.

**Content-type gaps NO slice covers (owner decisions needed — feeds the
toy-game capability scoping):**
- **F5 — Videos are not pack content.** Playback resolves from
  `backend/public/videos` (+ hardcoded idle-loop.mp4); the manifest's
  `asset-video` role is decorative. A pack cannot carry its videos.
- **F6 — Music/playlists are backend-local** (`config/music-playlists.json`
  + `public/music/`), inexpressible via the pack.
- **F7 — Cues are backend-local AND reference concrete assets**
  (sound/video filenames, tokenIds, HA scene ids). Planned B8 covers ONLY
  the lighting-role indirection — nothing moves cues.json into the pack.
- **F8 — ESP32 branding is compiled into flash** ("NeurAI Memory Scanner"
  etc.); no plan lets a pack rebrand the CYD (program §6.4 concedes this —
  confirm the posture: reflash-per-game is acceptable?).

**Confirmed sound / cleanly deferred:** draft-pack real-device preview is a
genuine unresolved gap but correctly parked in B0 with clean options — the
strongest reuses the PACK_PATH seam (second orchestrator on the draft dir);
B0 must also record a preview EXEMPTION for the handshake mismatch warn /
future preflight. Phone-scale pack serving is fine as-built (Express default
ETag/304; ~2.9MB one-time for 80 phones); web-FORMAT media for phones is a
Phase-4 E3 decision; hot-apply (E10) is cleanly additive (re-activation
entry point + broadcast + session-boundary client re-fetch — nothing
prevents it); packLoader should be core-extracted or thinned for the E3
tap-to-web client; verify the /api rate-limiter's per-IP keying vs NAT
before Phase 4 load.

## BILL game project (2026-07-17 — capability scoping + plan integration)

Owner's BILL constellation-game design (v0.1) scoped against the engine:
`docs/plans/2026-07-17-bill-capability-scoping.md`. Plan integration
ADOPTED 2026-07-17 (owner-directed) and written into the AUTHORITATIVE
planning docs — program §11 amendments (A3 slice list revised IN PLACE:
slice 0 gate infra, open-vocabulary slice 1, slice 3 split 3a/3b/3c,
slice 4 rescoped to show-control-content-into-pack), one-auth addendum
(actor-centric grants + server-side projection), pack-schemas addendum
(`requires` block + runtime-validation correction + open flag
vocabulary), standalone-loading doc stamped EXECUTED. Summary of what
was adopted:
- Framing: platform PHASES (3–5) vs recurring GAME PROJECTS; BILL = the
  first game project with new-module needs. No new platform phase.
- Phase 3 absorbs ONE scope change: A3 slice 4 rescoped from "cue role
  refs (B8)" to "show-control content into the pack" (cues + music REFS
  — settles audit F7 + half of F6). F5 videos deferred to B pages.
  Phase 3 DoD unchanged.
- Phase 4 sharpened, not grown: E5 = compound-scan engine per BILL's tap
  grammar; E4 += actor-centric grants + server-side per-surface
  projection; B9 += per-game state namespaces; P6/F8 conditional on
  CYDs-as-BILL-scanners. Gates unchanged; E-before-D ordering available
  if BILL pressure grows.
- BILL-E entry criteria: Phase 3 DoD + E4/E5. BILL-D (design spikes:
  contagion-math simulation, category grammar, paper prototypes) can
  start NOW, zero engine dependency — owner-paced.

## Transitional-debt ledger

Doctrine: every deliberately-transitional construct gets a row here with a
retirement trigger and a tripwire; retire the row in the commit that
retires the debt.

| # | Debt | Retirement trigger | Tripwire |
|---|---|---|---|
| L1 | Scoring dual-source window: GM scanner reads pack `game.json` scoring (A2) while backend still reads `scoring-config.json` | A3 slice 2 — backend reads game.json, `scoring-config.json` deleted from TokenData | Migration-parity contract test in `pack-schemas.test.js` pins game.json scoring == scoring-config.json (its comment already says delete when the legacy file retires) |
| L2 | GM scanner legacy scoring shim: baked build-time values as last-resort fallback. NOTE: scoring-config.json is deliberately NOT pack inventory — the shim falls back to BAKED values, never a fetched file | One release cycle after A2 ships everywhere | Shim logs a loud warn when used (added with the packLoader work); `grep scoring-config ALNScanner/src` |
| L3 | PWA pack loading scoped to visibility only (manifest fetch + hash display; no staged atomic refresh) | PWA becomes rules-bearing (scoring, or pack-driven display strings — note the A3 3a/3b/3c slices do NOT touch the PWA; a slice that does trips this row) | This row + the ride-along commit message |
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

- ~~DECIDE (R7): timeline posture~~ ✅ **RESOLVED 2026-07-17: HONEST
  figures ACCEPTED, cut set DECLINED** ("we need to be thorough") —
  remaining Phase 3 ≈13-20 sessions (incl. new slice 2b); slices 4/6/7
  + full B page set stay in scope.
- ~~DECIDE (R5+R11): tokens v2 + genericization~~ ✅ **RESOLVED
  2026-07-17: ADDED as A3 slice 2b** (structured group field + the
  pack-declared category vocabulary; design basis = pack-schemas §4;
  sequenced after slice 2 so 3c builds on the final vocabulary).
- **RUN S2 NEXT (adversarial R8)** — the DNS-01 cert spike gates E2;
  the warn-only-cert preflight default is adopted; veto if E2 should
  hard-gate the DoD.
- **D-track prerequisite (adversarial R19):** four-domain wireframes +
  owner walkthrough — schedulable NOW, zero engine dependency; moot if
  Phase 4 runs E-first.
- **Kit capacity (adversarial R18):** before Phase-4 phone load, size
  the Archer for expected client counts (DHCP pool, AP ceiling) + add a
  preflight client-count check; verify /api rate-limiter per-IP keying
  vs NAT.
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
