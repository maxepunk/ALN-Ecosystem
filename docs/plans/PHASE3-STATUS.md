# PHASE 3 — LIVE EXECUTION STATE

> **Fresh session? Read this first.** Program: `2026-06-11-phase3-program.md`
> (DoD ratified: Phase 3 = A+B+C + toy-pack gate; D/E are Phase 4).
> Design docs (all ratified or open points marked inline):
> `2026-06-13-phase3-1-pack-schemas.md` · `2026-07-09-phase3-1-installation-profile.md`
> · `2026-07-09-phase3-1-standalone-pack-loading.md` · `2026-07-09-phase3-1-one-auth.md`.
> Keep this file CURRENT — update it in every commit that changes execution state.

**Last updated:** 2026-07-18 · **Working branch:** `claude/phase3-a3-slice1`
(parent; chained from the verified slice-0 tip `8a944b4`, draft PR #20).
Under the frozen-production model (see the development-model row) slice
branches CHAIN — slice N+1 branches from slice N's verified tip, each slice
keeps a draft PR to main for CI, and the stacked PRs land in R14 order
whenever the owner merges. The earlier "rebase foundations onto main at the
A2 boundary" directive is SUPERSEDED — foundations is frozen history beneath
slice 0. (History: parent→main live-state parity merge 2026-07-11; A2
finished on foundations with `origin/main` merged back in 2026-07-17.)

## Where we are

| Item | State |
|---|---|
| Phase 2 (+2.x, + two review rounds, + field fixes) | ✅ merged to all mains, production-validated |
| Phase 3.0 program + all 3.1 design docs | ✅ complete 2026-07-09 (incl. the ATTRIBUTION CORRECTION — see below). Precision (2026-07-18 holistic review): pack-schemas §5 review points RESOLVED and standalone-loading stamped EXECUTED; one-auth and installation-profile remain **DRAFT-status docs proceeding on recorded defaults** (open: token lifetimes, scoreboard token, legacy-preset import) — "ratified" covers the program + the decided review points, not every open point. |
| **A1 slice 1** — schemas as files, ALN as a pack, toy pack, manifest generator, 24-test contract suite | ✅ FULLY landed 2026-07-10: TokenData `0b5cd93` on its origin, parent pin bumped, loud-skip guard deleted. Suite runs 24/24 in every checkout. |
| **Live-state parity cluster** (field-reported stale-UI bugs) | ✅ **MERGED TO MAIN 2026-07-11 by owner** — parent PR #18 then ALNScanner PR #11, in the documented order. Owner follow-ups on the PR branch (`6d03cb7` music gameclock pause/resume also refresh state — closes the last idle-FIFO dependency; `77f905f` docker-lifecycle repaired under the blanked HA token) were absorbed into foundations 2026-07-17 via merge of `origin/main`. Zero open PRs in either repo. |
| **A2 runtime pack loading** | ✅ **COMPLETE 2026-07-17** (parent `e73a020`→`3267b30`+, ALNScanner `df7cfed`/`707368d`, PWA `73ac71c`, ESP32 `92d763d`). Pack channel contracted + served (whitelist-only, frozen at boot); staleness identity reported by EVERY consumer (backend /health + sync:full + session stamp; GM UI + WS handshake; PWA config page; ESP32 boot log + CONFIG); PACK_PATH harness seam; GM packLoader with staged atomic refresh + runtime scoring (F-TOOL-05 dead); sync pipeline regenerates the pack manifest (Python builder, byte-parity-pinned); sync:full completeness structural test. Verified: backend 2187 unit/contract + 342 integration + coverage ratchet; scanner 1389 + ratchet + build artifacts + 07b/07c full-stack E2E; PWA 161; ESP32 native 120; scripts 66. Execution detail: "A2 execution record" below. |
| 2026-07-17 plan review (blind-spot audit) | ✅ six real gaps + five ambiguities found and resolved; all folded into A2 and landed |
| **2026-07-17 ADVERSARIAL five-phase review** | ✅ six lenses, findings R1-R24 in `2026-07-17-adversarial-plan-review.md`; all doc corrections APPLIED same day (program §1/§3/§7/§9/§11, pack-schemas, one-auth, BILL scoping, this file). OWNER decisions: timeline = HONEST accepted (≈13-20, cut set declined); tokens-v2+genericization = ADDED as slice 2b; E2/S2 = warn-only default adopted, S2 run pending. |
| **Development model (owner-corrected 2026-07-18)** | **Production is FROZEN until the program completes**: the game-running Pis will NOT pull new code mid-program (one game 2026-07-18/19 — which does NOT use the PWAs — then a break until development is done; final deployment = one coordinated cutover through the preflight). `production-2026-07` branches in ALL FIVE repos pin the exact main SHAs serving that game (created via the GitHub API — the session proxy refuses tag pushes). Consequences: main = integration trunk, NOT deployed state; deploy-choreography constraints relax to architectural ordering (the R12 skew policy + the slice-2 same-pin-bump coupling apply only to the FINAL cutover); tests-green-at-every-merge, contract-first, the coverage ratchet, and the debt ledger stay fully in force. **A2 landing timing (owner decision 2026-07-18): ALL merges to main wait until after the game** — the four submodule PRs then the parent PR land in the R14 order. **Development does NOT wait**: slice 0 branched from the frozen foundations tip (`claude/phase3-a3-slice0`) and PRs against main once the train lands. |
| **A3 sequence** | Per the REVISED slice list (program §3 + §11/§12): slice 0 ✅ → slice 1 🔨 → slice 2 (rules migration + gate headroom-rejection — **opens only with its own design doc + honest re-price**, program §12.3: its scope has accreted from ≥4 documents with no consolidated restatement, and A2 ran 2.3-2.7× estimate) → **slice 2b** (tokens v2 + pack-declared category vocabulary — owner-added) → 3a/3b/3c → slice 4 (R4 resolver/fallback guard; **C1 ratification is an explicit prerequisite**, program §12.4 — the R4 guard needs an in-repo fully-bound ALN installation profile and C1 is still DRAFT) → 5/6/7. *(The old "rebase foundations onto main" NEXT-step here is superseded — see the development-model row.)* |
| **A3 slice 0 (dual-pack gate infra)** | ✅ **COMPLETE & CI-CONFIRMED 2026-07-18** (developed on `claude/phase3-a3-slice0`, branched from foundations per the frozen-production model — lands via draft PR #19 once the A2 train merges). LANDED: E2E_PACK_PATH inherited by every non-pinning startOrchestrator call (explicit pins win) + `npm run test:e2e:toy-pack`; toy pack 6→14 tokens / 11 distinct qualifying owners + second group; `packService.getGameConfig()` (activation-snapshot, audit F4); capability gate in activatePack (audit F2 + R6: engine.minVersion semver + schemaVersion exact + `requires` ⊆ ENGINE_CAPABILITIES, refusal = boot failure; ENGINE_VERSION=3.0.0 decoupled from npm version; baseline caps: scoring.tabular / groupRules.all / duplicatePolicy.once); `requires` block in game.schema.json (TokenData `0eef578`) with BOTH real packs declaring the baseline — the gate exercises on every activation. Verified: backend 2199 unit/contract + ratchet; pack contract 37; scripts byte-parity 66. Extraction brake (R13): no matrix rows moved — pure infrastructure. **CORRECTION (2026-07-18, owner-caught):** the earlier "CI has no E2E runner" note was FALSE — read off a truncated grep. Parent CI's `backend-e2e-tier-l` job runs full Tier L (Playwright Chromium, GM dist rebuild, workers=3) on every PR to main; the F3 CI matrix over {production, toy-heist} is therefore implemented FOR REAL in `.github/workflows/test.yml` (fail-fast:false, per-leg artifacts). **DUAL-PACK TIER L RESULTS (2026-07-18, first run in project history):** production leg 112P/0F/58S; toy leg 111P/2F/57S — the 2 failures were ONE test (07a standalone scoring, both projects) and the GATE'S FIRST REAL CATCH: the E2E scoring ORACLE was pack-blind (expected ALN's 75000; the scanner CORRECTLY scored toy values 1300×2=2600 via runtime game.json — the engine was right, the oracle wrong; the live face of ledger L1's two-oracle window). Fixed: `helpers/scoring.js` `loadPackScoring()` + pack-derived `calculateExpectedScore`; 07a verified 2/2 on BOTH packs; backend expectations stay legacy-oracle until slice 2 (documented at the source, converges with L1 retirement). CI matrix committed (both legs proven). SKIP-DELTA RESOLVED (per-test JSON diff): the one differing test is 07b "completes group and backend applies multiplier bonus" (mobile-chrome) — SKIPPED on production, PASSED on toy. Classification: COVERAGE GAIN, not regression — production tokens.json currently contains exactly ONE grouped token ("Marcus Mention", 1 token), so NO completable group exists in live ALN data and 07b's networked group-bonus path has been silently self-skipping on production all along; the toy pack is now the only pack exercising it full-stack. ⚠ OWNER FINDING: group-completion bonuses can never fire with current production content — intentional content decision or Notion-sync drift? (Docs still cite "Server Logs (x5)" as canonical. First flagged 2026-06-11 in `docs/pr-drafts/2026-06-11-phase2-merge-prs.md` — "flagged, content decision"; escalated to the owner task list now that the dual-pack run made the coverage consequence concrete.) **SLICE 0 COMPLETE & CI-CONFIRMED** — all Tier L executed tests pass on both packs, every skip accounted for; PR #19 run 75 GREEN across all 8 jobs (both matrix legs ~11 min each on real runners; the one first-contact failure — scripts job missing submodule checkout for the A2 byte-parity tests — fixed in `569d7e6`). |
| **A3 slice 1 (modes → semantics flags)** | 🔨 **IN PROGRESS on `claude/phase3-a3-slice1`** (chained from slice-0 tip `8a944b4`; draft PR #20 per standing practice). Design **RATIFIED 2026-07-18**: `2026-07-18-phase3-a3-slice1-modes.md` (D1 `area.variant` capability ids ✓ · D2 consuming-appraise ✓ · D3 hard refusal with the two-flavor coherence refinement ✓). Census ground truth: 39 mode-literal sites (backend 8 / 4 files; scanner 31 / 10 files). The 2026-07-18 HOLISTIC REVIEW (5 parallel corpus readers + coherence critic over the full plan corpus) verified the design against every claimed companion section; the one deliberate divergence — the two-flavor refinement supersedes program-§3/R9's "contradictory" framing of `none ∧ countsTowardGroups` — was back-annotated into the program the same day (§12.2). Verified in-repo pre-build: BOTH real packs' game.json already carry complete per-mode flag records (appraise already at the D2 shape incl. `surface:"none"`, which is already schema-legal) — no pack edits needed. Implementation notes from the review: game.schema.json's closed enums (scoringPolicy/entityRole/surface) OPEN to plain strings in the contract-first commit (the capability gate takes over enforcement — openness property 2); the modeSemantics resolver normalizes absent `displayBehavior` → `{surface:'none'}`. |
| A3 slice 2+ → B0/B pages → C2/C3 | queued per program §3/§4 (slice-2 pre-open design doc required, §12.3; C1 before slice 4, §12.4) |

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

**PR-review residue (recorded so it isn't lost — PR #12 rounds 5-7
converged to traced approvals; RE-HOMED 2026-07-18: slice 0 closed
without items a/b, so the old "slice-0/C1 bucket" wording no longer
holds — both now bind to the C1 preflight slice's test-hardening
bucket, which already hosts the live mismatch-warn E2E):**
(a) packLoader timeout coverage pins the SIGNAL WIRING, not a live
hang→abort→fallthrough — behavioral timeout test → **C1 bucket**;
(b) the accepted staging-cache race (parallel-fetch failure path) is
comment-documented but has no forced-interleaving regression test →
**C1 bucket**; (c) `aln-pack-*` caches have no orphan sweep independent
of a successful refresh (sw.js GC exempts them by design) — revisit
only if long-lived devices accumulate strays; (d) pack JSON reaches
computed-key object writes (benign today — packs are fully trusted
content; re-examine when the one-auth/E4 era touches pack provenance).

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

**DoD linkage (owner goal, 2026-07-18): the 2026-07-18 holistic-review
fixes are part of the Phase-3 definition of done.** Phase 3 is not
complete while (a) any "Doc-refresh obligations" item below lacks
execution, (b) any ledger row is neither retired nor carrying an
owner-ratified post-Phase-3 retirement point (today exactly two qualify:
L2 = final cutover + one cycle, L4 = Phase-4 wire migration), or (c) any
PR-review residue item still lacks a slice that executed it (a/b → C1;
c/d are conditional watches with recorded triggers, acceptable to close
Phase 3 open). Untracked transitional debt is a DoD violation by
definition.

| # | Debt | Retirement trigger | Tripwire |
|---|---|---|---|
| L1 | Scoring dual-source window: GM scanner reads pack `game.json` scoring (A2) while backend still reads `scoring-config.json` | A3 slice 2 — backend reads game.json, `scoring-config.json` deleted from TokenData | Migration-parity contract test in `pack-schemas.test.js` pins game.json scoring == scoring-config.json (its comment already says delete when the legacy file retires) |
| L2 | GM scanner legacy scoring shim: baked build-time values as last-resort fallback. NOTE: scoring-config.json is deliberately NOT pack inventory — the shim falls back to BAKED values, never a fetched file | One release cycle after the FINAL cutover deploys A2 everywhere (restated 2026-07-18 under frozen production: "ships everywhere" happens only at the coordinated cutover, so this trigger = cutover + one cycle) | Shim logs a loud warn when used (added with the packLoader work); `grep scoring-config ALNScanner/src` |
| L3 | PWA pack loading scoped to visibility only (manifest fetch + hash display; no staged atomic refresh) | PWA becomes rules-bearing (scoring, or pack-driven display strings — note the A3 3a/3b/3c slices do NOT touch the PWA; a slice that does trips this row) | This row + the ride-along commit message |
| L4 | `teamId` stays on the wire as the entity-field alias (semantics are mode-dependent per the attribution model) | Phase 4 wire migration (pack-schemas doc §2 entities) | Contracts document the alias at every `teamId` site |
| L5 | Backend-flow E2E scoring expectations pinned to the LEGACY oracle: `tests/e2e/helpers/scoring.js` `calculateExpectedScore(token)` without a packScoring arg reproduces scoring-config values, used by networked/backend-authoritative flows while the backend itself is pack-blind (the test-side face of L1; row added 2026-07-18 — the slice-0 oracle fix left this deliberately transitional but unrowed, against ledger doctrine) | A3 slice 2 — backend reads game.json and backend-flow expectations switch to the pack oracle in the same change (converges with L1) | TWO-ORACLE comment block in `helpers/scoring.js`; `grep -n packScoring backend/tests/e2e/flows` shows which flows have/haven't converged |

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

## Doc-refresh obligations (assigned by the 2026-07-18 holistic review)

- `docs/SCORING_LOGIC.md` — root CLAUDE.md's designated scoring
  single-source-of-truth still describes the dead build-time Vite-import
  bake and has no pack awareness. Loud staleness banner added 2026-07-18;
  **FULL REWRITE rides A3 slice 2** (the commit that changes scoring truth).
- `docs/preflight-checklist.md` — under frozen production this checklist is
  the instrument of the one coordinated cutover, and it is stale beyond the
  already-assigned R2 §4.4 rewrite (Spotify/spotifyd-era sections predate
  the 2026-05-20 MPD cutover; no pack-identity/pack-endpoint checks exist).
  Banner added 2026-07-18; **full refresh rides Track C2** (decide there:
  refresh the hand-run doc or absorb it into the C2 preflight mechanism).
- Adversarial **R20** (B0 draft-store location + backup/export) lives only
  inside the adversarial review — carry it into the B0 design doc the day
  B0 opens, or it gets lost.
- The 2026-06-18 documentation audit's 81 findings have no follow-through
  tracking — sweep for still-open items when a docs-focused slice next
  opens (3a is the natural host).

## Standing practice: draft-PR-per-slice (owner-adopted 2026-07-18)

Parent CI fires ONLY on main pushes and PRs targeting main — a slice
branch gets ZERO CI until a PR exists (discovered when the entire
foundations + slice-0 line turned out to be locally-verified only).
Practice: the moment a slice branch is cut, open a DRAFT PR to main
([DRAFT] title, do-not-merge note). CI then runs on every push; the
draft state blocks accidental merges; the diff self-corrects once the
branches beneath it land. Slice 0 = parent PR #19 · slice 1 = parent
PR #20. Manual dispatch (`workflow_dispatch` on test.yml, any ref)
covers ad-hoc runs.

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
- **Group content question (dual-pack run 2026-07-18; first flagged in the
  Phase-2 merge record):** production tokens.json has NO completable
  2+-token group ("Marcus Mention" is a 1-token group) — group-completion
  bonuses can never fire in live ALN content, and the docs still cite
  "Server Logs (x5)" as canonical. Intentional content decision or Notion
  drift? If content: fix in Notion + resync before the next real game.
- **Q10 (capability matrix): ESP32 standalone stance** — never formally
  resolved in the pack-era decisions; the operative posture is the
  pre-Phase-3 CLAUDE.md "always networked (offline queue for resilience)".
  Confirm it as the recorded decision or direct otherwise.
- Housekeeping someday: delete merged phase2 PR branches; bump nested
  `data/` pins past the schema commit; delete the obsolete
  `staging/tokendata-phase3-a1` ref on ALN-Ecosystem (sessions get 403 on
  branch deletion, needs owner).
- `backend/.env` is COMMITTED with a live HA long-lived token — it made CI
  jest runs dial a phantom Home Assistant (the lighting flake source,
  neutralized in jest.config.base.js 2026-07-10; docker-lifecycle repaired
  under it in `77f905f`) and is a mild secret-hygiene smell. Decide
  someday: untrack it (deploy keeps a local copy) or keep as-is.
