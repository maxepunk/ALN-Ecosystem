# PHASE 3 — LIVE EXECUTION STATE

> **Fresh session? Read this first.** Program: `2026-06-11-phase3-program.md`
> (DoD ratified: Phase 3 = A+B+C + toy-pack gate; D/E are Phase 4).
> Design docs (all ratified or open points marked inline):
> `2026-06-13-phase3-1-pack-schemas.md` · `2026-07-09-phase3-1-installation-profile.md`
> · `2026-07-09-phase3-1-standalone-pack-loading.md` · `2026-07-09-phase3-1-one-auth.md`.
> Keep this file CURRENT — update it in every commit that changes execution state.

**Last updated:** 2026-09-04 · **Working branch:** `claude/phase3-b0` (theme unit CLOSED; B0 OPENED, PR #32)
(parent; chained from the verified slice-7 tip `4923575`, per the slice train).
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
| **A3 sequence** | Per the REVISED slice list (program §3 + §11/§12): slice 0 ✅ → slice 1 🔨 → slice 2 ✅ (CLOSED 2026-07-18 — design doc + honest re-price honored, program §12.3) → slice 2b ✅ (CLOSED — tokens v2 + pack-declared vocabulary, D1b/D2b/D3b executed in full, two-round adversarial review) → 3a 🔨 (decision-free core ✅; open on Q1–Q5 only) → 3b 🔨 (decision-free core ✅; open on Q-3b-1/Q-3b-2 only) → 3c 🔨 (decision-free core ✅; open on Q-3c-1 only) → **slice 4** (UNBLOCKED 2026-08-22 — C1 RATIFIED, all 12 items + drop-cold; the R4 guard's in-repo fully-bound ALN profile is now buildable to the ratified schema) → **5 🔨 (decision-free core ✅ 2026-08-22, CI-confirmed; open on Q-5-1/2/3 only — built AHEAD of the blocked slice 4: no dependency edge from 4 into 5)** → 6/7. *(The old "rebase foundations onto main" NEXT-step here is superseded — see the development-model row.)* |
| **A3 slice 0 (dual-pack gate infra)** | ✅ **COMPLETE & CI-CONFIRMED 2026-07-18** (developed on `claude/phase3-a3-slice0`, branched from foundations per the frozen-production model — lands via draft PR #19 once the A2 train merges). LANDED: E2E_PACK_PATH inherited by every non-pinning startOrchestrator call (explicit pins win) + `npm run test:e2e:toy-pack`; toy pack 6→14 tokens / 11 distinct qualifying owners + second group; `packService.getGameConfig()` (activation-snapshot, audit F4); capability gate in activatePack (audit F2 + R6: engine.minVersion semver + schemaVersion exact + `requires` ⊆ ENGINE_CAPABILITIES, refusal = boot failure; ENGINE_VERSION=3.0.0 decoupled from npm version; baseline caps: scoring.tabular / groupRules.all / duplicatePolicy.once); `requires` block in game.schema.json (TokenData `0eef578`) with BOTH real packs declaring the baseline — the gate exercises on every activation. Verified: backend 2199 unit/contract + ratchet; pack contract 37; scripts byte-parity 66. Extraction brake (R13): no matrix rows moved — pure infrastructure. **CORRECTION (2026-07-18, owner-caught):** the earlier "CI has no E2E runner" note was FALSE — read off a truncated grep. Parent CI's `backend-e2e-tier-l` job runs full Tier L (Playwright Chromium, GM dist rebuild, workers=3) on every PR to main; the F3 CI matrix over {production, toy-heist} is therefore implemented FOR REAL in `.github/workflows/test.yml` (fail-fast:false, per-leg artifacts). **DUAL-PACK TIER L RESULTS (2026-07-18, first run in project history):** production leg 112P/0F/58S; toy leg 111P/2F/57S — the 2 failures were ONE test (07a standalone scoring, both projects) and the GATE'S FIRST REAL CATCH: the E2E scoring ORACLE was pack-blind (expected ALN's 75000; the scanner CORRECTLY scored toy values 1300×2=2600 via runtime game.json — the engine was right, the oracle wrong; the live face of ledger L1's two-oracle window). Fixed: `helpers/scoring.js` `loadPackScoring()` + pack-derived `calculateExpectedScore`; 07a verified 2/2 on BOTH packs; backend expectations stay legacy-oracle until slice 2 (documented at the source, converges with L1 retirement). CI matrix committed (both legs proven). SKIP-DELTA RESOLVED (per-test JSON diff): the one differing test is 07b "completes group and backend applies multiplier bonus" (mobile-chrome) — SKIPPED on production, PASSED on toy. Classification: COVERAGE GAIN, not regression — production tokens.json currently contains exactly ONE grouped token ("Marcus Mention", 1 token), so NO completable group exists in live ALN data and 07b's networked group-bonus path has been silently self-skipping on production all along; the toy pack is now the only pack exercising it full-stack. ⚠ OWNER FINDING: group-completion bonuses can never fire with current production content — intentional content decision or Notion-sync drift? (Docs still cite "Server Logs (x5)" as canonical. First flagged 2026-06-11 in `docs/pr-drafts/2026-06-11-phase2-merge-prs.md` — "flagged, content decision"; escalated to the owner task list now that the dual-pack run made the coverage consequence concrete.) **SLICE 0 COMPLETE & CI-CONFIRMED** — all Tier L executed tests pass on both packs, every skip accounted for; PR #19 run 75 GREEN across all 8 jobs (both matrix legs ~11 min each on real runners; the one first-contact failure — scripts job missing submodule checkout for the A2 byte-parity tests — fixed in `569d7e6`). |
| **A3 slice 1 (modes → semantics flags)** | ✅ **COMPLETE & CI-CONFIRMED 2026-07-18 — PR #20 run 82 GREEN across all 8 jobs** (both Tier L matrix legs ~10 min each on real runners; head `187c7a6`, branch chained from slice-0 tip `8a944b4`). Design **RATIFIED 2026-07-18**: `2026-07-18-phase3-a3-slice1-modes.md` (D1 `area.variant` capability ids ✓ · D2 consuming-appraise ✓ · D3 hard refusal with the two-flavor coherence refinement ✓). Census ground truth: 39 mode-literal sites (backend 8 / 4 files; scanner 31 / 10 files). The 2026-07-18 HOLISTIC REVIEW (5 parallel corpus readers + coherence critic over the full plan corpus) verified the design against every claimed companion section; the one deliberate divergence — the two-flavor refinement supersedes program-§3/R9's "contradictory" framing of `none ∧ countsTowardGroups` — was back-annotated into the program the same day (§12.2). Verified in-repo pre-build: BOTH real packs' game.json already carry complete per-mode flag records (appraise already at the D2 shape incl. `surface:"none"`, which is already schema-legal) — no pack edits needed. **SLICE GATE RECORD (what the gate + verification ladder caught this slice, in order):** (1) a masked-migration bug in `computeTeamScores` (internal isGroupComplete call omitted gameConfig, silently rode the ALN shim) — caught PRE-COMMIT by the new open-vocabulary unit suite; (2) TWO accidental ratchet raises on untouched timing-sensitive files (displayDriver/processMonitor branchy process-control code — local timing luck raised bars CI couldn't meet); (3) the scanner DEFAULT-EXPORT BOOT FAILURE (validateSettingsMode added as named export only; app.js consumes the default object; 44/50 L2 tests failed while jsdom unit tests — which mock the module — saw nothing) — caught by the L2 browser suite, now pinned by a structural default-export-completeness test; ALSO exposed that piping test runs through `| tail` masks the real exit code (first L2 run reported exit 0 falsely — test exit codes are now read directly); (4) the integration-harness stub gap (backend `browser-mocks.js` InitializationSteps lacked validateSettingsMode — 85 CI failures; the third harness surface mirroring scanner init); (5) the WALL SCOREBOARD as an OUT-OF-CENSUS mode consumer (`backend/public/scoreboard.html` filtered evidence on the 'detective' literal at both the WS ingest and sync-rebuild paths — toy tipoff evidence never rendered; now pack-driven from /api/pack/files/game.json, loaded before socket connect, legacy fallback + loud warn); (6) three E2E ALN-label assertions made pack-derived (loadPackModes/expectedModeLabels helpers). Every catch has a regression pin. Ledger: L6 row added (mode-table shims both sides + scoreboard fallback, drift tripwires). Implementation notes from the review: game.schema.json's closed enums (scoringPolicy/entityRole/surface) OPEN to plain strings in the gate commit (the capability gate takes over enforcement — openness property 2); the modeSemantics resolver normalizes absent `displayBehavior` → `{surface:'none'}`. **Backend seam LANDED** (contract-first commit): `gameRules/modeSemantics.js` (resolveMode/wireModeIds/defaultModeId, legacy shim L6 with drift tripwire pinning the baked table == real ALN game.json), all 8 census sites migrated (scoring.js threads gameConfig; transactionService gates on scoringPolicy; model keeps a STABLE legacy-history default while processScan defaults pack-aware; Joi enum → runtime wireModeIds check with the enum-era `any.only` error shape), openapi+asyncapi mode enums → type:string + runtime-validation rule. Verified: 2220 unit+contract green + ratchet. The new open-vocabulary suite caught its first bug pre-commit: computeTeamScores' internal isGroupComplete call omitted gameConfig and silently rode the ALN shim — invisible to every ALN-shaped test. **Gate + coherence LANDED** (second slice-1 commit, atomic with the TokenData schema opening `55752cf`): `_gateCheck` gains mode-drivability (ENGINE_MODE_CAPS: scoringPolicy {standard,none} / entityRole {ledger,attribution} / surface {rankings,evidence,none}; refusals name the mode + every undrivable flag); `_coherenceCheck` lands with BOTH ratified flavors — (i) timeless contradictions (empty declared modes, duplicate ids, defaultEntity∧ledger) worded "self-contradictory", (ii) none∧countsTowardGroups worded "not driveable by this engine yet (see slice 2)" with the retirement named, NEVER "incoherent" (tests pin the language rule both ways); deliberately-LEGAL combinations pinned green (attribution∧standard, surface:none, D2 appraise shape); both real packs pass gate+coherence. game.schema.json's three flag enums OPENED to strings in the same change (`when` stays closed — ungated headroom refused); manifest byte-identical (schema is authoring-time, not pack-served). Verified: 2236 unit+contract + ratchet + 342 integration. **Scanner seam LANDED** (ALNScanner `173eba6`, third slice-1 commit): `src/core/modeSemantics.js` mirrors the backend seam (applyPackModes at Phase 1A, resolveMode + sugar predicates, L6 shim + drift tripwire vs data/game.json); all 31 census sites migrated across 10 files (scoring→scoringPolicy, groups→countsTowardGroups, evidence/report/scoreboard→declared surfaces, presentation→declared labels — ALN wording untouched, 3a owns strings); segmented selector rendered from pack modes (#modeSelector) with the pill kept as the N-mode cycle control (`<label> Mode` text byte-identical for ALN — E2E page objects unchanged); stale persisted mode resets to the pack's first declared mode (loud); ?mode= override accepts any declared id, refuses undeclared; **nested data/ pin bumped to TokenData `55752cf`** (housekeeping item retired — the bundled tier now ships game.json, so Pages deployments run pack modes+scoring instead of the shims). Verified: 1416 unit + ratchet (63 files) + build + build-artifact tests. **parity-pack fixture** gained its minimal ALN-shaped game.json + manifest (design §5 — 07c parity flows now exercise the seam, not the shim; backend 2236 re-verified green). SCOPE NOTE for the slice-2 design doc: `backend/scripts/lib/` post-session validators (DetectiveModeCheck, ScoringIntegrityCheck, LogParser mode heuristics) are mode-literal consumers OUTSIDE the 39-site census (diagnostic tooling, ALN-named) — they re-point at the pack when backend scoring migrates. |
| **A3 slice 2 (rules migration)** | ✅ **COMPLETE & CI-CONFIRMED 2026-07-18 — SLICE CLOSED** (decision-free core + all four owner-ratified closers + adversarial review). Core record: **DECISION-FREE CORE** — PR #21 run on `681bbf4` GREEN across all 8 jobs (both Tier L matrix legs); local dual-pack gate: production 112P/0F/0-flaky, toy 113P/0F/0-flaky (skip-delta = the known 07b coverage-gain). Slice REMAINS OPEN on D1s2–D4s2 only. (Branch `claude/phase3-a3-slice2` chained from slice-1 tip, PR #21 draft.) Design doc `2026-07-18-phase3-a3-slice2-rules.md` (§12.3 register; ratification of D1s2–D4s2 still HELD FOR OWNER — nothing decision-gated was built). LANDED, in order: **(§2a/§2e)** `packService.getScoringRules()` (normalized: numeric ratings, lowercased types, `unknown` always present; LEGACY_ALN_SCORING loud shim + drift tripwire) consumed by tokenService; config/index.js scoring-config read DELETED; `getClockRules()` (duration/overtimeAt from pack gameClock, config fallback) wired into sessionService overtime + syncHelpers expectedDuration; clock masking pin deleted per its design note. **(§2b, ledger L1 RETIRED)** scanner L2 shim VENDORED first (frozen literal + drift tripwire vs data/game.json — deletion can't break scanner builds), then `scoring-config.json` DELETED from TokenData (`00d35dc`), parity pin + legacy unit test deleted, tokens-schema scoreability re-pointed, scoringConfigLoader re-pointed at game.json (loud throw, no baked fallback — D4s2 depth still open). **(§2c, ledger L5 RETIRED)** all five flows (07a/07b/07c/07d-02/23) on the SINGLE pack oracle; calculators throw without it; verified Tier L 23P/0F/0-flaky. **(§2f, D3-ratified)** scored-only bonus base in `gameRules/scoring.js` (`groupBonusAmount` sums only members claimed in a standard-scoring mode; completion counts any counting claim, live + rebuild paths; live path runs completion for counting∧unscored claims via extracted `_applyGroupCompletion` — group:completed can fire with bonus 0, asyncapi documented) → **the flavor-ii refusal DELETED on schedule** (event-only groups legal; legality pinned; scanner parity PINNED by test — LocalStorage always had §2f semantics naturally: countsTowardGroups guard + recorded-points base). **(§2i/§2j)** rules-block drivability gates: duplicatePolicy ∉ {once/unlimited} and groupRules ∉ declared table → named refusals ("slice 2 implements the declared table only"); duplicatePolicy.js documented as the declared table's implementation. **(§2l)** R2 pair: DEPLOYMENT_GUIDE pack-rollback runbook + preflight §4.4/§13.3 rewritten pack-aware. **(§2m)** SCORING_LOGIC.md FULL REWRITE (banner down — values are per-pack, formulas are engine rules, delivery table current). **(§2o)** public/ sweep clean (one CSS z-index false positive). Verified: backend 2262 unit+contract + ratchet (raise-audit caught the SAME displayDriver/processMonitor timing flake as slice 1 — floors restored, legitimate transactionService raise 55→60 kept) + 342 integration; scanner 1417 + ratchet. **ADVERSARIAL SLICE REVIEW (2026-07-18, 8-angle finder pass over the full 187c7a6..HEAD delta): 10 verified findings, ALL FIXED + PINNED (`7c0a232` + scanner `1ded9f5`, CI green, dual-pack gate re-run green 111P+112P/0F; the 2 retry-passed flakes are UI-timing timeouts, not score mismatches).** Top catches: (1) standard∧non-counting claims completed groups LIVE that the rebuild un-completed (isGroupComplete's unconditional currentTokenId injection — now gated on the claim's countsTowardGroups, caller contract documented); (2) the §2f bonus base counted non-counting scored claims (teamScoredTokenIds now requires BOTH flags; shared _teamClaimedTokenIds body so the two group currencies cannot drift); (3) the unscored path dropped completions for unregistered teams (auto-create extracted + shared); plus: declared-but-unusable scoring now REFUSES at activation; SESSION_TIMEOUT-ignored warn; activatePack moved BEFORE token load (snapshot semantics now true) + rules memo; validator `|| 1`/'personal' defaults fixed (ALN null-type tokens were mis-validated at 1x); E2E oracle mirrors engine case normalization; config-tool writeScoring pair-atomic + rollback guard; scanner tokensScanned scored-claims-only (backend parity, pinned); dead calculateGroupBonus/imports/twin-fetchers removed. **COVERAGE ENDGAME (post-review):** the recurring displayDriver/processMonitor ratchet flake was DEFLAKED for real — the two flapping arms got explicit deterministic tests and the floors were RAISED (85→90 / 90→95) on `a0e9729`, CI-CONFIRMED (run 29638025514 all 8 jobs green: the claim held on CI runners, closing a flake that recurred across three slices); then `0bda09e` drove both files to exact 100% branches+lines (six remaining arms tested; ONE provably-unreachable branch — length>0 behind run()'s trimmed output — DELETED from source per the dead-tail doctrine, never fake-covered) with floors locked at 100, decisive ratchet job CI-green. **CLOSERS BUILT 2026-07-18 (owner rulings, design doc §6a/§6b):** D1s2 phases gate + toy trim (`5ab7fdc` — gate's first catch was the toy's own 2-phase clock); D2s2 allowNegative (`d2e69f5` + scanner `41381c8` — reject-not-clamp, LATENT RESTORE CRASH killed: Joi min(0) fired at hydration on any persisted negative; TWO pre-existing standalone bugs fixed: adjustment wiped by next scan's invariant recompute, rebuild dropping adminAdjustments); D3s2 claims flag (`e6877c5` + scanner `67996b3` + TokenData `ca90dc0` — schema+gate+engine+scanner ONE change, consuming default so no pack edits, non-consuming never blocked/never registers, flavor-ii re-instantiated for non-consuming∧counting); D4s2 validator sweep (`6b96917` — packResolver stamped-pack resolution w/ match|mismatch|unstamped verdicts, every mode literal through the seam, DetectiveModeCheck→NonScoringModeCheck, §2f bonus math from gameRules, scripts/lib's FIRST tests, CLAUDE.md '15 validators' corrected to the 9 wired). **CI RATCHET CATCH:** closer-added gameOps branches dropped below floor — CI's fresh coverage caught the stale local check (`cd0a9d6`, 60-floor→69.04%; lesson: scanner coverage:check is only as fresh as the last local --coverage run). **CLOSER ADVERSARIAL REVIEW (35-agent workflow: 6 finder angles → per-finding adversarial refuters): 25 CONFIRMED findings ALL FIXED + PINNED (`4b9464c` + scanner `10d7467`), 4 refuted.** Top catches: transaction:failed unmark not claims-gated (non-consuming failure erased a consuming claim's mark — the A7 optimistic-lie class); deleteTransaction registry removal mode-blind (deleting a non-consuming tx stripped the consuming claim's per-device entry); TQ-6 reconcile silently dropped queued non-consuming txs; ScoringIntegrityCheck false-FAILed floored sessions (now models the D2s2 rebuild floor); phases-gate raw TypeError on null entries; packResolver 'match' on hash-less stamps; client defense for non-consuming∧counting on never-gated standalone packs; plus convention dedups (banked predicate single home, DEFAULT_PACK_DIR single source), contract completeness (2 missed signed-currentScore sites), doc truth (SCORING_LOGIC.md floor/claims/phases sections, root+scanner CLAUDE.md claims-conditional duplicate rule), and the three D4s2 pin gaps closed. **CLOSE GATE (all green):** backend 2328 unit+contract + ratchet + lint; integration 342; scanner 1442 + FRESH-coverage ratchet; PWA 165, config-tool 93, ESP32 native 125; dual-pack Tier L TWICE (closers: 112P+113P/0F/0-flaky; review fixes: 112P+113P/0F/0-flaky); CI green on BOTH heads (`8a7df6f` run 29648284288, `4b9464c` run 29651156715, all 8 jobs each). Next: slice 2b — **pre-open census COMPLETE** (`2026-07-18-phase3-a3-slice2b-tokens-v2.md` DRAFT: 20 SF_Group parse sites / 8 files / 4 duplicate regex impls, ~29 SF_MemoryType consumers incl. the closed schema enum as the v2 unlock point, scanner exact-case vs backend lowercased type-lookup parity hazard; the census also caught the config-tool + Notion-sync L1 stragglers, fixed in `66124cc` — CI-CONFIRMED, run 29634851785 all 8 jobs green incl. the config-tool test+lint steps inside the Scanner job). C1 before slice 4, §12.4. |
| **A3 slice 2b (tokens v2 + pack vocabulary)** | ✅ **COMPLETE & CI-CONFIRMED — SLICE CLOSED** (all three rulings ratified as recommended and EXECUTED: D1b groups-block, D2b exact-case canon, D3b sync-as-sole-parser + atomic cutover; full execution record in `2026-07-18-phase3-a3-slice2b-tokens-v2.md`). Branch `claude/phase3-a3-slice2b` chained from the slice-2 tip (PR #22 draft CI vehicle). LANDED, in order: **(D1b staged)** pack `groups` block authoritative everywhere a multiplier is read — tokenService `c0db062`, scripts TokenLoader `4dcdd7c`, activation groups-coverage gate `e92d1e9`, scanner PACK_GROUPS mirror ALNScanner `1072805`; TokenData `1c19b89` (schema `groups` def + ALN "Marcus Mention" x1 + toy blocks, mechanically derived, zero conflicts). **(D3b authoring)** sync `derive_groups` (multiplier conflict = HARD ERROR naming both tokens) + atomic `write_groups_block` (`5a3bbc2`); skill sync twin retired to a loud stub (`64c12e8`). **(D2b)** exact-case type canon (`e8fcaf3`): `_normalizeScoring` keys VERBATIM + `UNKNOWN` bucket, backend lowercase normalization dropped, TYPE-COVERAGE gate refuses case-mismatched tokens at boot (null legal → UNKNOWN 0×), all loaders/oracles mirrored, old case-insensitivity pin REWRITTEN to pin the new canon. Also caught+fixed: the D3b pipeline-test sandbox had written its sandbox-derived empty groups block into the REAL ALN game.json (GAME_JSON_PATH now monkeypatched; file restored). **(THE ATOMIC v2 CUTOVER, `99e34e5` + TokenData `a80fafc`)** all four runtime "(xN)" parsers DELETED (tokenService parseGroupMultiplier, TokenLoader static parser, scanner parseGroupInfo regex + tokenManager fallback), gate v1-compat strip removed, E2E oracle → `loadPackGroups()` (throws on undeclared names), tokens.schema.json v2 (`not`-pattern makes suffixed SF_Group ILLEGAL; SF_MemoryType OPEN exact-case), production + fixture packs stripped to pure names + manifests regen, contract group-consistency test → declared-in-groups. **(D3b emission, `fe31732`)** parse-once discipline: derive from the RAW shorthand, then `strip_group_suffixes` emits pure names — validation/dry-run/write all see the exact v2 shape. **(PACK_SCHEMA_VERSION 1→2, `33953c6` + TokenData `072b772`)** engine const + BOTH manifest stampers (JS + python) + schemas const-pinned + all three packs restamped; EXACT match BOTH directions (new pin: a PAST-version pack refuses — this engine has no suffix parser). **(Scanner cutover, ALNScanner `c0022bc`)** suffix regexes deleted, `PACK_GROUPS` sole multiplier source, fixtures flipped to pure names + `applyPackGroups` declarations, nested data pin → v2, dist rebuilt. **(Docs, `6716626` + TokenData `5af9082` + ALNScanner `7feb214`)** SCORING_LOGIC.md v2 posture + all CLAUDE.md schema sections. **ADVERSARIAL REVIEW (workflow-orchestrated, TWO rounds — round 1's 3-lens verify fleet hit a usage-credit wall at 91/107 agents, its one fully-verified finding fixed; round 2 re-ran 8 finders + 1 strict refuter each, 40 agents/0 errors: 23 CONFIRMED / 9 refuted, ALL 23 FIXED same-day (`8c741ac`, `0baca9b` + ALNScanner `b89d1c3`)).** Top catches: (1) **the D1b gate ran only when a groups block was DECLARED** — a v2 pack omitting `groups` activated with every grouped token silently reading 1x, and a lingering v1 suffixed SF_Group activated verbatim (confirmed 3-0; gate made UNCONDITIONAL: absent block = empty declaration set); (2) **the scanner had NO v2 enforcement** (5 lenses converged) — no schemaVersion gate anywhere scanner-side and silent 1x for undeclared/absent groups on the surface that is scoring-AUTHORITATIVE standalone, reachable via SW-cache/Pages tiers the backend gate never sees → scanner-side `PACK_SCHEMA_VERSION` EXACT-match gate at the load boundary + `_warnUndeclaredGroups` client defense (the L2/L6 shim doctrine applied to groups) + the C20 mutation pin (deleting `applyPackGroups` now fails a test); (3) **prototype-chain lookups** — a group or type named `constructor` passed the gates via `in`/truthy-index then scored NaN → `Object.hasOwn` everywhere + declared-entry validation (integer multiplier ≥ 1); (4) sync hard edges — suffix-only `(x5)` (silently ungrouped + empty-string group key), `(x0)`, double-suffix `A (x2) (x3)` all sync-time HARD ERRORS; dry-run now previews the groups-block write; (5) TokenLoader game.json via fs not require() (path-cache staleness); (6) manifest-freshness pin for every bootable fixture pack; (7) doc truth — stale "LOWERCASED type keys" claims corrected (packService JSDoc, root CLAUDE.md, SCORING_LOGIC.md), `_gateCheck` header no longer promises "v1 packs activate exactly as before", openapi manifest example → 2. **ACCEPTED RESIDUAL EXPOSURE (documented):** an OLD deployed scanner build + v2 pack suffix-parses pure names into silent 1x — old code cannot be gated by new code; covered by frozen production until the coordinated cutover (R12 skew policy); NEW code gates both directions. PWA/ESP32 don't read SF_Group; the PWA nested data pin (pre-v2) rides the R14 train. **CLOSE GATE (all green):** backend 2336 unit+contract + FRESH ratchet + lint; integration 342; scanner 1447 + FRESH ratchet + dist rebuilt; scripts 72; PWA 165, ESP32 native 125, config-tool green; dual-pack Tier L TWICE (post-cutover: ALN 111P/0F w/ 1 retry-passed UI-timing flaky + toy 113P/0F/0; post-review-sweep on the FINAL heads: **ALN 112P + toy 113P / 0F / 0-flaky**); CI green on all 12 slice-branch runs incl. final heads (parent `0baca9b` run 32459144808, scanner `b89d1c3` dispatch run 32459154080). *(Ops note: a mid-slice container recycle forced a workspace restore from origin + a Playwright browser-revision bridge (1194→1200 layout symlink) — no work lost, everything was pushed.)* Next: slice 3a (strings), then 3b/3c. |
| **A3 slice 3a (pack-declared strings)** | ✅ **FULLY CLOSED 2026-08-29** — decision-free core closed 2026-08-21 (record below); the five held owner questions were RULED 2026-08-22 and BUILT by the **A3 owner-ruled closers** slice (see its row). (branch `claude/phase3-a3-slice3a` chained from slice-2b tip `be24d96`, PR #23 draft; heads parent `c580345` / ALNScanner `ee9cd17` / TokenData `80a2c22`, parent CI run 120 + scanner CI run 85 GREEN). Census (6-agent workflow): **160 3a / 50 → 3b / 16 → 3c / 35 out**; design + full execution record: `2026-08-21-phase3-a3-slice3a-strings.md` §7. **LANDED:** all three pre-fixes (shared `SCOREBOARD_WINDOW_MARKER` consumed by displayDriver + served page via `%%WINDOW_MARKER%%` injection, tripwired; admin password de-baked to serve-time injection; idle-loop → `config.display.idleLoopFile`); strings infrastructure (`strings.schema.json` open-vocabulary + gate: declared⇒must-load-or-REFUSE, undeclared⇒`getStrings()` null benign-wording class, frozen-at-activation snapshot); consumers — scoreboard page (`%%PACK_STRINGS%%` + STR table: header/emptyTicker/emptyEvidence/unknownOwner, the last doubling as the evidence grouping key), GM scanner (packLoader `strings` rules role riding the staged refresh + `core/strings.js` getString with drift-pinned baked defaults + document title/scan prompt/stat labels/shared ×3 emptyEvidence hint via `applyPackStringsToDom`; flow-27 pin pack-derived — the toy Tier-L leg proves "Awaiting tips..." end-to-end), backend award message (`strings.scoring.awardMessage` `{points}` template, ALN verbatim), config-tool (`GET /api/config` pack identity + title/mode-label derivation; terminology keys deferred to coordinate with 3b). ALN sidecar wording VERBATIM throughout (zero visible change); toy pack declares a genuine second wording; parity-pack stays undeclared (null path). **ADVERSARIAL REVIEW round 1 (workflow: 6 lenses → dedup → strict refuters; 30 agents/0 errors): 22 confirmed / 2 refuted → 7 distinct defects, ALL FIXED same-day.** Top catches: stored-XSS script-context breakout via `</script>` in the JSON injections (jsonForScript `<` + tripwire); `replaceAll` `$`-substitution corrupting all three injections (a `p@$$w0rd` password served MANGLED — function replacements now, `$$`/`$&`/`$'` pinned); gate crash on `null` sidecar / silent pass for primitives (type guard); packLoader fast path stranding pre-3a-staged caches on baked wording (refetch; offline tier deliberately tolerates — tokens beat wording); role-vs-pointer split closed at 3 layers (schema `const 'strings.json'` + gate refusal + staged-refresh declared-check); scoreboard STR `packStr()` type guard; history-label missed consumer; test-quality sweep (mutation-proof marker pin, both-direction schemaVersion refusal, STR drift tripwires, packless serve pin). **CLOSE GATE (all green on final heads):** backend 2375 + fresh ratchet + lint; integration 342; scanner 1477 + ratchet (strings.js at 100/100/100) + L2 50 ×2; config-tool 95; dual-pack Tier L **ALN 111P/0F (1 environmental retry-flaky, flow 24 solo-clean 2P/0)** + **toy 113P/0F/0**. Process lesson re-learned: two slice-inflicted CI lint reds (runs 115/118) both traced to `| tail` masking local exit codes — eliminated. **Q1–Q5 RESOLUTION (2026-08-22 rulings → closers slice):** Q1 entities.label WIRED (Account rebrand); Q2 claimedLabel/icon BUILT (R-Q2); Q3 tokenNoun BUILT; Q4 report wording OUT confirmed (future `verbNoun` deferred to slice 7); Q5 scoreboard chrome BUILT. |
| **A3 slice 3b (pack-driven formatting)** | ✅ **FULLY CLOSED 2026-08-29** — decision-free core closed (record below); Q-3b-1 was RULED option (c) 2026-08-22 and BUILT by the **A3 owner-ruled closers** slice; Q-3b-2 (star glyphs = visual identity) was ruled INTO the scheduled **theme unit** (with the ALN star-display drop). (branch `claude/phase3-a3-slice3b` chained from the 3a tip `4dee0aa`, PR #24 draft; heads parent `e60dfc9` / ALNScanner `04e8b79` / TokenData `d8a65d9`; scanner CI runs 86+87 green). Census re-verified post-3a (all sites confirmed; 11 additional findings — `scoring.display` had ZERO readers, both normalizers DROPPED it; toy already declared `#,### cr`). **LANDED (ruling R-3b-1):** `scoring.display.format` is the driving spec — one `#,###` signed grouped-integer token + literal affixes, schema pattern + activation-gate refusal twins; `gameRules/formatting.js` (backend parity surface) + scanner `formatCurrency` (all 17 call sites + strays + static seeds) + scoreboard-page vendored grammar + config-tool formatter, each with the baked ALN fallback byte-identical incl. the `$-25,000` negative quirk; `formatStars` centralizes ALL star constructions (scanner ×3 + config-tool ×2, scale from `baseValues` keys, clamped — the rating>5 RangeError defect FIXED); E2E harness went format-agnostic (four `[$,]`-strip sites → digits/sign parsing, numeric score waits) PLUS rendered-affix Tier-L pins in flows 23+30 (`formatMoneyExpected(score, moneySpec(pack))`, dual-pack). OUT: report generator (B9 golden), validators family, debug logs, PWA (L3), award-number formatting (Q-3b-1), star glyphs (Q-3b-2). **Adversarial review round 1** (workflow: 5 lenses → strict refuters, 24 agents/0 errors, 14 confirmed/5 refuted → 6 distinct defects, ALL FIXED same-day): top catch — pack-controlled affixes reached GameOpsRenderer **innerHTML unescaped at 12 sites** (a gate-passing format could execute markup in the GM origin holding the admin JWT; all wrapped `escapeHtml`, pinned); plus the missed uiManager star site, the affix-blind-E2E gap (dead helper exports gained their intended consumers; false in-page comment corrected), the shim-path test-reset trap, the frozen-path display pin, and config-tool grammar tests + honest negatives note. Ledger candidate (pre-existing, OUT): scanner scoring.js shim path does not restore baked TABLES after a pack applied different ones. **CLOSE GATE (final heads, exit codes direct):** backend 2411 + fresh ratchet + lint; integration 342; scanner 1503 + ratchet + L2 50 ×2; config-tool 98; dual-pack Tier L **ALN 112P/0F/0-flaky** + **toy 113P/0F/0-flaky**. |
| **A3 slice 3c (CSS/mode/type taxonomy)** | ✅ **FULLY CLOSED 2026-08-22** — decision-free core closed (record below); Q-3c-1 RULED option (a): the minimal theme.json ships as the scheduled **theme unit** (with Q-3b-2 glyphs + the ALN star-display drop) — nothing further belongs to this slice. (branch `claude/phase3-a3-slice3c` chained from the 3b tip `54e248c`, PR #25 draft; heads parent `fd04970` / ALNScanner `d407f19`; scanner CI 88+89 green). **LANDED (ruling R-3c-1 — style by SEMANTICS):** `modeClassNames()` derives `mode-scoring`/`mode-evidence` from the same flags that gate behavior, riding alongside the slugged `mode-<id>`; three emitters + static seed converted; visual-role CSS re-keyed (ALN byte-visual-identical; toy pills/borders BECOME styled); `slugifyId` kills the two-class type bug; type badges get the type-unknown floor; orphan mode CSS deleted; team-detail accent neutralized; scoreboard `?mode=` evidence view is surface-keyed (toy `?mode=tipoff` works — was a silent no-op; dual-pack flow-23 pin); the TOY PACK gained a divergent type id (`Contraband` — the census found toy shipped ALN's exact five, so type openness was untestable). **Review round 1** (13 agents, 8 confirmed → 4 distinct defects, ALL FIXED): the bare pill rules LEAKED glow/white onto activity rows (computed-style verified — scoped to `.mode-indicator.mode-*`); reserved slugs stop id-forged semantic classes; the unpinned timeline emission pinned; CSS-source tripwires added. **CLOSE GATE (final heads, exit codes direct):** backend 2411 + ratchet + lint; integration 342; scanner 1525 + ratchet + L2 50 ×2; dual-pack Tier L **ALN 113P/0F/0** + **toy 114P/0F/0**. **Q-3c-1 RESOLVED (2026-08-22): option (a) — the theme unit is a scheduled Phase-3 work item, not 3c scope.** |
| **A3 owner-ruled closers (Q1/Q2/Q3/Q5/Q-3b-1)** | ✅ **COMPLETE & CI-CONFIRMED ON ALL HEADS 2026-08-29** (parent runs 138-143 ALL GREEN — run 140 on `8567a8d` covered the full build incl. BOTH dual-pack Tier L legs, 141 the review fixes, 142/143 the close records + final pins; scanner runs 91-94 ALL GREEN; final heads parent `4a59e04` / scanner `567dfa8` / TokenData `1d323a7`). Branch `claude/phase3-a3-closers` chained from the slice-5 tip `094ca22` (parent PR #27; scanner PR #13 draft; TokenData `1d323a7`). Design + R-Q2 (option A as amended by the FIRST mixed-model design red-team, 37 objections/6 BLOCKING pre-code): `2026-08-22-phase3-a3-closers.md`. **LANDED (lockstep TokenData → scanner → backend):** **(Q2/R-Q2)** modes gain `claimedLabel` (template, exactly one `{entity}`) + `icon` (1-4 plain glyphs) — schema patterns + BOTH resolver mirrors normalize (control/bidi strip; scanner DECLINEs loudly once-per-mode, backend silent value-level helpers) + activation-gate refusal twins; scanner `claimAnnouncement()` renders escaped announcements with GetSubstitution-safe FUNCTION replacement (an entity named `$&` renders literally, pinned); per-FIELD three-tier fallback (declared → engine-generic `CLAIMED by {entity}`/no icon → L6 bakes byte-identical, drift-tripwired both repos); GameOpsRenderer card headline resolves the CONSUMING claim, timeline stays per-event with declared glyphs (content-only — never class keys); NEW pack-controlled-strings XSS block (markup-bearing templates render inert; hostile icons never reach the DOM). **(Q1)** `entities.label` wired through `applyPackEntities`/`entityLabel()` — ALN rebrands Team → Account across renderer strings, statics (applyPackStringsToDom extension + index.html ids), dialogs (E2E-load-bearing reset confirm pack-derived in 07d-02), errors, teamRegistry labels, and the CSS-rendered team-list empty state (custom property via JSON.stringify); baked Team/Teams byte-identical; dead populateDropdown DELETED. **(Q3)** tokenService group-name fallback noun via `strings.terminology.tokenNoun` (baked 'Memory'; toy 'Take', declared-branch PACK_PATH pin added post-review). **(Q5)** scoreboard chrome → `packStr`/STR (6 status call sites + REC + video overlay + INITIALIZING, baked byte-identical); ScoreboardPage gates connection on the STATUS CLASS (pack-agnostic, kiosk-safe attached-state) — text assertions pack-derived via loadPackStrings. **(Q-3b-1)** awardMessage `{pointsFormatted}` under the pack money grammar (function replacements); ALN sidecar rewords to "Token scanned successfully. {pointsFormatted} awarded." → renders "$150,000 awarded." (LOCKSTEP pin: money, never the word 'points'); baked packless default keeps `{points}` wording. **(Toy = second consumer)** FENCED/TIPPED/APPRAISED templates + icons 💼🕵️🔍, divergent status chrome (WIRED IN/GONE DARK/DIALING IN…), award reword → "1,300 cr added to the haul.", tokenNoun 'Take', manifest regen; 07b gains the dual-pack rendered claim-announcement pin (verified live: "SOLD to Team Alpha …"). **(Sync)** write_groups_block `ensure_ascii=False` + emoji round-trip test (icons must not churn game.json bytes/contentHash). **ADVERSARIAL REVIEW (mixed-model per the ratified policy — 25 agents, 5 lens finders [Fable injection / Opus parity+state / Sonnet coverage+honesty] → per-finding refuters [Fable for MAJORs]): 20 findings → 6 CONFIRMED / 14 refuted, ALL 6 FIXED (`8c4a75d` scanner + `a346dd5` parent):** the MAJOR — local ALNScanner/dist stale (design-doc-mandated rebuild skipped; CI unaffected — it builds fresh — but local E2E provably red: refuter reproduced 07d-01:133 failing, green after rebuild + 07b/07d-02 re-verified locally); two Q1 census-missed error toasts (gameOps :124/:224) rewired through entityLabel; scanResponse.test afterEach mock defaults DEAD under resetMocks:true → beforeEach; tokenNoun declared branch had ZERO coverage (mutation-verified: deleting the read stayed green) → PACK_PATH pin added. **CLOSE GATE (exit codes direct):** backend 2455 unit+contract + fresh ratchet + lint; integration 344; scanner 1556 + ratchet (raises: initializationSteps functions 90→95, teamRegistry 45/60/65 — slice-touched only); scripts 73; local E2E spot-runs 07d-01 4P/0F, 07b 6P/0F (claim pin live), 07d-02 6P/0F; dual-pack Tier L via CI run 140 (both legs green). **This slice CLOSES 3a and 3b.** GitGuardian incident 36469941 RESOLVED (owner marked false-positive 2026-08-29 — the flagged strings are the 3a review's deliberate GetSubstitution/quote-safety fixtures; optional fixture rename declined-by-default, available on request). |
| **A3 slice 5 (clock phases + trigger-starts)** | ✅ **FULLY CLOSED 2026-08-22** — decision-free core CI-confirmed; all three held questions RULED same day: Q-5-1 phase-relative cue `at` → Phase-4 D-track obligation (REQUIRED by full-project completion), Q-5-2 validator phase-awareness deferred to the first real phases-bearing game (validators are post-real-game diagnostics on a surface slice 7/D-track still moves), Q-5-3 parallel-cues posture confirmed. (branch `claude/phase3-a3-slice5` chained from the 3c tip `c1e11d7`, PR #26 draft; final heads parent `050bbf4` / ALNScanner `55a7836`; parent CI run 136 GREEN all 8 jobs, scanner CI run 90 green). **LANDED (ruling R-5-1 — current phase DERIVED, "latest satisfied start", overtime generalized):** getClockRules serves the declared phases table; the D1s2 gate refusal RETIRED on schedule (residual rules: dup ids, non-monotonic/non-finite time starts, unknown or pre-clock trigger events, phases-without-duration); gameClockService phase runtime (silent seed, skip-forward, E1 mark-don't-fire restore with persisted phaseId, trigger observation gated on running); phase rides the service:state gameclock domain + sync:full as required-nullable {id,label}|null (NO new discrete wire event); phase:changed joined the cue trigger vocabulary + conditions (ENGINE normalizer; wiring dispatcher feeds gate-identical vocabulary); scanner renders the null-hidden #game-clock-phase label (ALN byte-identical, toy GAINS labels); the toy's owner-committed two-phase clock RESTORED + trigger-started `the-getaway` on group:completed ("The Getaway" landed LIVE in a real browser after group completion — skip-forward exercised dual-pack). **Review round 1** (30 agents: 17C/8R → 9 defects, all fixed): stale-phase-across-sessions, dead session:created trigger, phases-without-duration, phase-persistence crash window, empty-id E1 defeat, non-finite at, the expect.any(Array) MAJOR test gap, 3 doc-truth fixes, and the config-tool TRIGGER_EVENTS linkage test (F-TOOL-09's event-name drift class now tripwired) + a CI fix (backend deps for the linkage test). **Close gate:** backend 2441 + fresh ratchet (raises only on slice-touched files) + lint; integration 344; scanner 1532 + ratchet; config-tool 100; dual-pack Tier L **ALN 113P/0F/0** + **toy 114P/0F/0** locally AND both CI legs green twice. Design doc §6 carries the full record. |
| **A3 slice 5 — original opening record** | 🔨 **OPENED 2026-08-21** (branch `claude/phase3-a3-slice5` chained from the 3c tip `c1e11d7`, draft PR CI vehicle; opened AHEAD of the owner-blocked slice 4 per the ordering note in the design doc). Census VERIFIED by an 8-reader workflow (design doc `2026-08-21-phase3-a3-slice5-clock-phases.md`): B11's decision record is three bullets (phase model in gameClockService, `phase:changed` as cue trigger + condition, ALN degenerate); the schema already legalizes multi-phase + trigger-starts (only the D1s2 gate refuses, message names "see slice 5"); the toy's real clock (casing@0 + the-job@1800, trimmed in `5ab7fdc`) is the owner-committed restoration target. **Ruling R-5-1 (recommended): current phase is DERIVED — "latest satisfied start in declared order" — overtime generalized**; delivery rides the existing service:state gameclock domain + sync:full (NO new discrete wire event, no MESSAGE_TYPES change); E1 mark-don't-fire restore with persisted `phaseId`; residual gate rules (dup ids, non-monotonic time-starts, unknown trigger events); scanner gains `#game-clock-phase` (null-hidden — ALN byte-identical, toy GAINS its label); toy also gains a trigger-started `the-getaway` on group:completed (3c Contraband precedent — both start kinds exercised dual-pack). Owner questions Q-5-1 (manual phase advance), Q-5-2 (phase-aware validators), Q-5-3 (overtime unification) HELD. |

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

**DoD linkage (owner goal, 2026-07-18; clause REFRESHED 2026-08-29 —
the enumeration had gone stale, per the ambiguity sweep).** Phase 3 is
not complete while (a) any "Doc-refresh obligations" item below lacks
execution, (b) any ledger row is not in one of the four classes marked
in the table itself — **retired / in-queue / post-Phase-3 (owner-
ratified) / conditional-watch (owner-ratified: "acceptable to close
Phase 3 open")** — or (c) any PR-review residue item still lacks a
slice that executed it (a/b → **C2+C3**, re-homed 2026-08-29 from the
nonexistent "C1 preflight slice"; the packHash mismatch-warn→
ENFORCEMENT obligation is likewise homed to C2, warn-vs-refuse logged
as a C2 design point; c/d are conditional watches with recorded
triggers). Owner ratifications 2026-08-29: **L2, L4, L6 →
post-Phase-3** (L6 joins the cutover class its trigger always implied);
**L3 → conditional-watch**. New rows inherit a class at creation —
never a fresh owner question each time. Untracked transitional debt is
a DoD violation by definition.

| # | Debt | Retirement trigger | Tripwire |
|---|---|---|---|
| ~~L1~~ | **RETIRED ON SCHEDULE 2026-07-18 (A3 slice 2).** Backend reads the pack via `packService.getScoringRules()` (normalized snapshot; loud baked shim for packless checkouts); `scoring-config.json` DELETED from TokenData (`00d35dc`); the migration-parity pin deleted with it per its own comment; scanner's L2 shim vendored first so the deletion can't break scanner builds; validator loader re-pointed at game.json (loud throw, no baked fallback) | — (done) | — (retired; the packService drift tripwire vs ALN game.json is the ongoing guard) |
| L2 | GM scanner legacy scoring shim: baked build-time values as last-resort fallback. NOTE: scoring-config.json is deliberately NOT pack inventory — the shim falls back to BAKED values, never a fetched file | One release cycle after the FINAL cutover deploys A2 everywhere (restated 2026-07-18 under frozen production: "ships everywhere" happens only at the coordinated cutover, so this trigger = cutover + one cycle) | Shim logs a loud warn when used (added with the packLoader work); `grep scoring-config ALNScanner/src` |
| L3 | **[conditional-watch, owner-ratified 2026-08-29]** PWA pack loading scoped to visibility only (manifest fetch + hash display; no staged atomic refresh) | PWA becomes rules-bearing (scoring, or pack-driven display strings — note the A3 3a/3b/3c slices do NOT touch the PWA; a slice that does trips this row) | This row + the ride-along commit message |
| L4 | `teamId` stays on the wire as the entity-field alias (semantics are mode-dependent per the attribution model) | Phase 4 wire migration (pack-schemas doc §2 entities) | Contracts document the alias at every `teamId` site |
| ~~L5~~ | **RETIRED ON SCHEDULE 2026-07-18 (A3 slice 2, converged with L1).** Every E2E scoring expectation now uses the SINGLE pack oracle (`loadPackScoring()` from the running orchestrator, threaded through all five flows: 07a/07b/07c/07d-02/23); the calculators THROW on a missing oracle (no silent second source); the in-process legacy import and the unused `calculateExpectedTotalScore` deleted; TWO-ORACLE comment block retired. Verified: Tier L 23P/0F/0-flaky on the five touched flows | — (done) | — (retired) |
| L6 | **[post-Phase-3, owner-ratified 2026-08-29]** Legacy ALN mode-table shims BOTH sides: backend `gameRules/modeSemantics.js` and scanner `src/core/modeSemantics.js` resolve against a baked ALN modes table when the active pack ships no game.json modes block (packless checkouts, parity fixtures, integration harness). Also covers the wall scoreboard's legacy detective evidence-filter fallback | Every pack in play ships game.json with a modes block (parity-pack gained one in slice 1; retire when the pre-pack deployment class is gone — at latest the final cutover) | LOUD once-per-process warns on all three shims ('LEGACY MODE TABLE ACTIVE'/'LEGACY SHIM ACTIVE'/'LEGACY MODE FILTER ACTIVE'); DRIFT TRIPWIRE tests both sides pin the baked tables byte-equal to the real ALN game.json modes |
| L7 | **[in-queue, recorded 2026-08-29 at S3 — D-4.5 "lands with the code"]** `lightingRoleFallbacks` concrete-id bridge: the game.json key + schema property + gate rule 5 + the resolver fallback branch (`commandExecutor._resolveLightingRole`). One venue scene id per role, used ONLY when the installation profile has no binding; every fallback-resolved FIRE warns loudly. ALN's block itself is authored at S4 | C4 (the bindings page): delete the key from ALN game.json, the schema property, gate rule 5, and the resolver branch | LOUD warn per fallback fire; BUILD-TIME drift tripwire `backend/tests/unit/services/lightingRoleTripwire.test.js` pins fallbacks === profile `.ha` bindings (vacuous until S4 authors the block) |
| L8 | **[post-Phase-3, owner-ratified 2026-08-29 (OQ7a); recorded at S4]** The ENDGAME cue's `target: "bluetooth"` audio literal, migrated VERBATIM into pack content (`ALN-TokenData/cues.json`, the policesounds entry). Deliberate diegetic staging (police sounds from a specific speaker), but a venue routing-target literal living in pack data | The pack-manager media page's design (ROADMAP §8.2 checkpoint): retire it via audio roles / re-authoring, or explicitly re-ratify it | This row; `grep -n '"target"' ALN-TokenData/cues.json` |
| L9 | **[post-Phase-3, same family/class as L2]** Scanner `src/core/scoring.js` shim path does not RESTORE the baked tables after a pack applied different ones (benign today: single pack load per session; 3b review note "worth a row", added 2026-08-29 per the ambiguity sweep) | Retires with L2 (the shim family dies together at cutover + one cycle) | 3b's scoring-formatting test snapshot-and-restore pattern; `grep 'LEGACY SHIM' ALNScanner/src` |
| L10 | **[RETIRED 2026-08-29 at slice-6 open]** `scoreboard.html` numeric `7200` fallback duplicated pack `gameClock.duration` (3a "adjacent note"). RESOLVED by documentation (design doc D-6.4): the real duration is already delivered live on every sync (`sync:full.gameClock` + `service:state` domain `gameclock` → `syncCountdown`); the two literals (now at `:853` seed + `:951` `|| 7200`) are inert pre-connect chrome / defensive fallback, so there was nothing to wire — both sites now carry a source comment saying so. Line numbers in the original row (799/892) were stale | CLOSED — source comments at `scoreboard.html:853,951` | grep `7200` in scoreboard.html shows only the two commented placeholder/fallback sites |
| L11 | **[RETIRED 2026-09-03 at theme unit ST.F]** `scoreboard.html:12-14` Google Fonts CDN links — offline-LAN risk, same class as the fixed socket.io CDN bug (3a "adjacent note", added 2026-08-29). RESOLVED by self-hosting (D-T.6): five families as woff2 latin+latin-ext subsets with unicode-range — scoreboard's three (IBM Plex Mono, Libre Baskerville, Special Elite; 16 files under `backend/public/fonts`) + config-tool's two (DM Sans, JetBrains Mono; 12 files under `config-tool/public/fonts`), generated `@font-face` css, live fallback stacks kept. Playfair Display NOT hosted — it retired with its dead `--font-display` token (zero `var()` consumers; a font nothing renders would be dead weight — the D-T.6 six-family text reconciled to five at the ST.F review, design §8). CDN stylesheet links AND both googleapis/gstatic preconnects removed from both pages | CLOSED — tripwire tests `backend/tests/unit/utils/fontSelfHosting.test.js` + `config-tool/tests/fontSelfHosting.test.js` | `grep -rlE 'fonts\.(googleapis\|gstatic)' backend/public config-tool/public` = zero (test-enforced, both halves). SCOPE NOTE (ST.F review, finding c): the row's original command used `-R` which FOLLOWS the `gm-scanner`/`player-scanner` submodule symlinks into the NFC tools — a DIFFERENT surface, tracked as L14. The engine's own served page chrome (this row's scope) is `-r` over the `public/` trees; the tests enforce exactly that (symlinks skipped) |
| L14 | **[in-queue, recorded 2026-09-03 at theme unit ST.F review]** The NFC tools `tag-writer.html` + `token-checkin.html` (ALN-TokenData source, served through `backend/public/gm-scanner/` + `backend/public/player-scanner/data/` submodule symlinks) still carry Google Fonts CDN links — the SAME offline-LAN silent-CDN-failure class as L11, but a SEPARATE surface (NFC programming tools, not venue display chrome) out of L11/D-T.6 scope. Surfaced by the ST.F spec review's tripwire-scope catch (the `-R` vs `-r` symlink difference) | A fonts sweep when the NFC-tool surface is next touched (or the B-pages/tooling work if it subsumes these tools): self-host their families the ST.F way, or promote the fallback stacks | `grep -RlE 'fonts\.(googleapis\|gstatic)' backend/public` shows ONLY these two files (×2 symlink paths each); zero when the sweep lands |
| L13 | **[post-Phase-3, recorded 2026-09-03 at slice-7 S7.2 — class inherited from its trigger, per the DoD-linkage rule]** ALN-flavored wording retained inside ENGINE-FIXED report structure: the `## Detective Evidence Log` heading (ALN's own mode name), the `Exposed By` column header, and the H1 `Session Report` family — every divergent pack's report inherits them, because the contract names headings/column text as structure (Change Rules #1–#2) and the external pipeline parses them | The ROADMAP §8.10 bundle migration (the pipeline stops parsing markdown; the anchors stop being load-bearing and can localize) | The golden masters + the structural-invariant suite in `ALNScanner/tests/contract/sessionReport.contract.test.js`; contract doc v2 records the retention |
| L12 | **[in-queue, recorded 2026-08-29 at slice-6 S6.3]** The idle-loop config fallback: when a pack names an idle-loop channel (`surfaces.idleLoop`) that the installation profile has no binding for, `vlcMprisService._resolveIdleLoopFile()` falls back LOUDLY to `config.display.idleLoopFile` (the L7 lighting-role-fallback shape). A venue-media identity resolved from engine config instead of the profile | The pack-manager media page + venue-media binding UI (ROADMAP §8.1): every idle-loop channel gets a real profile binding, and the config fallback becomes a hard "no idle loop configured" refusal | LOUD warn per fallback fire ("no installation-profile binding — falling back … ledger L12"); `grep -n "ledger L12" backend/src/services/vlcMprisService.js` |

## Owner rulings 2026-09-04 (B0 design ratification)

B0 design r2 RATIFIED (full record: the B0 design doc §4-§6): Q10(a)
one unit at the honest 3.5–5-session estimate (owner-signed divergence
from the program's 1.5–2.5 — census: auth substrate entirely unbuilt;
red-team restored the dropped served-vocabulary scope); Q11(a) publish
refuses on base-hash conflict, re-draft is the recovery, merge waits
for the Design-workspace pages. 18 red-team objections all folded
(design §4 table): the observe-token requireAdmin bypass, the unnamed
WS enforcement point, the gate-seam module-graph leak, silent-revert
publish, and the GM-WS carve-out DELETED rather than ruled around.

## Owner rulings 2026-09-03 (batch — remaining-scope grill)

Full text: program doc §14 (the authoritative amendment). Summary:

1. **Track B bar:** all five Design-workspace pages ship in Phase 3;
   per-page build-vs-deferred split ruled in the pages' design doc,
   every deferral gets a NAMED ROADMAP §8 row, owner approves before
   build. Owner prior: only pack-version diffing reads as a genuine
   luxury; scoreboard real-device preview + true-duration timeline
   are IN.
2. **E10 hot-apply is INSIDE the Phase-3 gate**; the mechanics
   editor's draft→publish→hot-apply path and E10 are one deliverable.
3. **Surfaces-editor home:** named open question, resolved in the
   Design-workspace-pages design doc (which page edits `surfaces`).
4. **C2 = resolver + preflight presentation only** (reaffirms §13.7).
5. **GM-scan video cueing** named ROADMAP §8.16 → Phase-4 E5;
   standing-cue-per-token is the interim (works today, pack content).
6. **Vocabulary:** "Design-workspace pages" (not "B pages"),
   "presentation" (not "face"); idle-loop intent = ambient resting
   screen / pre-show atmosphere. CONTEXT.md updated same-day.

## Owner rulings 2026-08-22 (batch — question-walkthrough chat session)

All held slice questions RESOLVED and **C1 RATIFIED** (all 12 items of the
item-by-item walkthrough; legacy presets DROP COLD — see the C1 doc header).
Slice 4's §12.4 prerequisite is satisfied — the A3 train is fully unblocked.

- **Q1 (3a): "Account" IS the intended fiction** — wire `entities.label`
  as declared; GM screens visibly change Team→Account (~20 sites).
- **Q2 (3a): Option A** — `claimedLabel` + `icon` are additive optional
  fields ON THE MODE in game.json (mode wording stays co-located with
  label/verb; small schema change). Mechanism gets a design red-team pass
  before build (new subagent policy §2).
- **Q3 (3a): as proposed** — `strings.terminology.tokenNoun` for
  game-flavored sites only; engine "token" vocabulary stays.
- **Q4 (3a): report wording stays OUT** (external-contract default
  confirmed; revisit with slice 7 / the report-template migration).
- **Q5 (3a): scoreboard chrome IS game wording** — "Video Playing...",
  "INITIALIZING", "REC" (+ terminal-styled connection statuses) join
  `strings.scoreboard.*`.
- **Q-3b-1: option (c)** — additive `{pointsFormatted}` placeholder; AND
  ALN's award template rewords to show "$150,000"-style values with NO
  "points" (exact ALN sentence drafted at build, recorded in the doc).
- **Q-3b-2 + star ruling: glyphs are visual identity → theme unit.**
  Owner confirmed the star map (rating = bury-value input; star DISPLAYS
  are informational-only, 4 sites) and ruled **ALN does not need the star
  displays** — rating display becomes a themed choice; ALN opts out.
- **Q-3c-1: option (a)** — MINIMAL theme.json ships in Phase 3 (semantic
  mode colors, rating glyph/display incl. the ALN star-drop, scoreboard
  accent) so the Track B "strings & theme editor" page has a real
  substrate; full theming depth waits for the first real second game.
  → NEW SCHEDULED UNIT: "theme unit" (design once, folding Q5 depth +
  Q-3b-2 + the star ruling).
- **Q-5-1: Phase 4**, but REQUIRED by full project completion (manual GM
  phase-advance — the operator escape hatch for trigger-started phases).
  Recorded as a Phase-4 D-track obligation.
- **Q-5-2: deferred** — phase-aware post-session validation attaches to
  the first REAL phases-bearing game (validators are post-real-game
  diagnostics; their surface moves in slice 7/D-track anyway).
- **Q-5-3: parallel confirmed** — overtimeAt stays a scalar beside
  phases, permanently unless a pack needs per-phase overtime.
- **Subagent policy ratified** (same session): mixed-model fleets —
  Sonnet census readers/finders, Haiku mechanical sweeps, Opus refuters +
  security/state-machine lenses, Fable for the census doctrine-leg, the
  parity lens when rules move, MAJOR-finding refuters, injection/auth
  security lenses, and a NEW pre-build design red-team (2-3 Opus/Fable)
  attacking each design doc's mechanism section before code opens.

CONSEQUENCE — updated work queue: (i) ~~owner-ruled closers package~~
**DONE 2026-08-29** (Q1+Q2+Q3+Q5+Q-3b-1 built + reviewed + fixed; slices
3a and 3b FULLY CLOSED — see the closers row) → (ii) **slice 4** (OPEN;
design r2 red-teamed 24/24 findings folded; **OQ1–OQ7 ALL ANSWERED by
owner 2026-08-29** — role names for the SEVEN scenes + confirmed HA ids,
spine cues migrate renamed `warning-90min/60/30/15` + `endgame`, e2e
fixtures verbatim, sounds/videos reference-form with logged program-§13
amendment, playlists deferred, profile home confirmed, bluetooth target
preserved with L8's ROADMAP-§8.2 checkpoint; build IN PROGRESS —
**S1 schemas DONE 2026-08-29** (TokenData `42c281e` + parent `0164855`;
cues.schema.json with engine-tripwired vocabularies, game.schema
cues const-pin + lightingRoleFallbacks, builder `.schema.json` suffix
rule, installation-profile.schema.json at the OQ6 home; two-axis review
folded, incl. the duration reversal — execution record + adjudication:
slice-4 design doc §9; **S2 gate DONE 2026-08-29** — gameRules
`validateCuesBlock` (rules 1-7, pure pack-internal; owns the row-2.22
vocabulary incl. the 24-action cue table, five drift tripwires),
ENGINE_CAPABILITIES + the ratified trio, strings-mirror cues loader,
tick guard + loadCues dupe refusal; guard cues green at validator AND
gate; **S3 resolver + profile DONE 2026-08-29** — AsyncAPI role
alternative opened the stage; profileService (PROFILE_PATH, frozen at
boot, degrade-not-refuse) + the real aln-full-kit profile (all seven
OQ1 bindings, contract-validated + drift-pinned); executeCommand-top
role normalization with the L7 fallback warn + validateCommand silent
mirror; the cue paths now surface `success:false` on cue:error (the
D-4.4 promise upgraded the S2 observed swallow into scope); L7
build-time tripwire + always-on role-resolution integration proof;
**S4 cutover DONE 2026-08-29** — ALN cues.json authored (OQ1 roles,
OQ2 renames, OQ7a target verbatim, L8 recorded), engine loads the
frozen `packService.getCues()` snapshot, venue cues file DELETED
grep-clean, preflight cue checks rewritten, four E2E flows
ALN-pack-pinned (Tier L 17/0/0 on this machine; integration 348/348),
config-tool full surface re-pointed by the FIRST rule-2-delegated
build agent (writeCues in the writeScoring shape running the gate's
own validateCuesBlock; presets cues-stripped; role-picker UI);
**S5 toy second consumer DONE 2026-08-29** — toy cues (one action
class per cue), partial fallbacks, profilePath seam pinned per-call,
runtime-discovered-scene E2E green, builders gain the logs/ skip;
dual-pack TOY LEG: Tier L 116/0/0 (unit+contract 2582/2582);
**S6 close DONE 2026-08-29 — SLICE 4 CLOSED.** Dist rebuilt; dual-pack
Tier L gate COMPLETE (toy leg 116/0/0 at S5, ALN default leg 115/0/61
at close — skips capability-gated + loud, no VLC/MPD/audio/BT on this
runner). Backend 2597 unit+contract + ratchet RAISED (cueValidation +
profileService floors, app.js 30→65 branches, commandExecutor 90→95,
standingEvaluator 70→75 — never lowered); config-tool 114, Python
parity 75, GM Scanner 1556, PWA 165. ESP32 `pio` not installed here +
zero ESP32 changes → leg recorded unrun. **Mixed-model adversarial
review of the WHOLE slice** (subagent policy: two Opus refuters —
security + state-machine — a Fable doctrine/parity leg, a Haiku sweep):
10 findings FIXED (`847d7c5`), 2 accepted residuals. The two MAJORs:
(1) the gate validated a DIFFERENT read of cues.json than it froze +
executed — a boot-window swap ran unvalidated cues (session:end /
score:adjust / transaction:delete reachable); hoisted to a single read.
(2) CUE_ACTIONS was validation-time-only — added a dispatch-time
auth-floor guard (cue source ⇒ CUE_ACTIONS only) so operator-only
functions stay operator-only even if the gate is bypassed. Both
refuters CONFIRMED the commands-XOR-timeline predicate gap (gate
non-empty vs engine truthy → gate-passing cue crashed boot / half-reset,
also via the config-tool PUT path); one fix in the shared validateCuesBlock
closes both. Minors: profile drift-warn re-arm, sceneId gate `!== undefined`,
CONDITION_OPS hasOwn, invalid-clock warn latch, writeCues schemaVersion,
buildAssetUsageMap null-proto, Node tombstone regression test. Doctrine
leg: FAITHFUL-implementation verdict (owner answers present exactly,
migration byte-faithful under only the sanctioned deltas, five tripwires
bind under live mutation). Records: slice-4 design doc §9 S6 entry.
**Accepted residuals (ledger):** HA scene ids on the unauthenticated
pack channel → closes at C4 with L7; persisted cue-id rename collision
across a restart straddling the ONE cutover (production frozen, no live
session straddles it). **§6 residue RE-HOMED (design-doc obligation
landing at S6):** the PR-review residue (a) packLoader behavioral
timeout and (b) staging-cache race test are DEFERRED to the C2+C3 slice
(this slice never touched the scanner repos; the C1-preflight bucket has
no queue slot). R13 extraction brake: no matrix rows moved — the slice
adds pack content + a gate + a resolver, no scanner-parity surface
shifted. Merge-train entry #28 (parent) is READY; owner-paced) →
(iii) slice 6 (minimal reading ratified — program §13.2) → slice 7
(ruled — §13.4) → theme unit (boundary ruled — §13.5) → B0. **ROADMAP.md
RATIFIED 2026-08-29** — full-arc frame incl. the open-source north star,
the blue/green cutover (§3b; green-Pi work after Phase-3 close), and the
deferral registry every future deferral must point into.

**SLICE 6 OPENED 2026-08-29** (branch chains from the slice-4 tip; design
doc `2026-08-29-phase3-a3-slice6-display-surfaces.md`). Census by 3
parallel readers (backend machinery / GM-scanner side / schema+deferrals+R13).
Key finding: the three built-in DISPLAY surfaces are IDLE_LOOP/SCOREBOARD/
VIDEO (the `displayControlService` device-mode machine); the rankings-vs-
evidence axis is the MODE-display-surface (`displayBehavior.surface`),
already pack-driven since slice 1/3c and OUT of scope. The schema already
reserves a dormant `surfaces` key (`game.schema.json:489-492`, `type:object`,
no consumer) — slice 6 fills that, NOT a new `display` key (D-6.1). **R13
reclassification LOGGED (design doc §1):** row 2.3 (idle-loop) — the pack
gains a NAME reference (`surfaces.idleLoop`, a venue-channel name, NOT the
media file — file carriage stays ROADMAP §8.1); row 2.4 (display-mode set) —
Q14 CLOSED, the surface SET stays engine-fixed at three, packs gain
select/parameterize; genuinely-new surfaces (constellation renderer) stay
BILL-era headroom (ROADMAP §6/row 8.8). **Decision-free housekeeping DONE
2026-08-29:** ledger L10 RETIRED (7200 fallback documented as inert
pre-connect chrome — value already delivered live; source comments at
`scoreboard.html:853,951`); the slice1-modes.md:39 "pack-extensible surface
set" wording CORRECTED to match the ratified honesty table. **OWNER RULED
2026-08-29 (design doc §4 — all three the EXPANSIVE way; minimal
recommendations DECLINED):** Q6-1 → ALLOW OPT-OUT (a pack may declare no
idle loop / no scoreboard; the display-mode state machine honors it —
own E2E matrix); Q6-2 → PROFILE-BINDING RESOLVER NOW (reuse slice-4's
installation-profile pattern: pack names an idle-loop CHANNEL, the
profile binds it, `config.display.idleLoopFile` is the loud fallback —
S6.3 UN-HELD, full resolver this slice); Q6-3 → SCOREBOARD ALSO GAINS A
PARAM (the specific parameter is NOT yet named — a focused Q6-3
scoreboard-parameter census runs at open, content/behavior NOT styling
so the theme-unit boundary stays clean; D-6.7 records the pick).
Consequence: slice 6 is a FULL slice, estimate ≈3.5–5.5 sessions
(design doc §7). Build order (design doc §5): S6.2 housekeeping DONE;
S6.1 schema+gate (idleLoop channel + opt-out + the ruled scoreboard
param); S6.3 profile resolver + opt-out state machine + scoreboard
param; S6.4 close.

**SLICE 6 CLOSED 2026-08-29** (full record: design doc §8; branches
`claude/phase3-a3-slice6` both repos, parent tip after the close
commits, TokenData `4f29720`). Built: the `surfaces` block (schema +
gate + `surfaces.select` capability + unknown-key refusal), the
idle-loop profile resolver (`bindings.surfaces`, ledger L12 fallback),
both Q6-1 opt-outs (idle-loop null; scoreboard refusal), the Q6-3
`evidenceCycleMs` parameter, and `packService.getSurfaces()`. Dual-pack
Tier L on the FINAL tree: ALN 119/0/61 + Tier H 4/0/18; toy 120/0/60;
0 flaky both legs. Coverage ratchet never lowered (the one dip was
restored with a real test). Close review: Opus refuter ("essentially
clean", one MINOR fixed), Fable doctrine ("faithful implementation";
its MAJOR — the missing ruled E2E — fixed with the toy-pack-surfaces
flow), Haiku sweep 8/8 clean, plus a retroactive STANDARDS-axis pass
(5 findings fixed, 2 rejected on the rule of three). **Process note
(honesty rules):** the build stages ran during a fallback-model window
outside the §1 stage frame (no per-stage reviews; implementation-first
in places). The owner caught it; remediation is recorded in the design
doc §8 (standards pass, CONTEXT.md vocabulary capture + §4 rework,
frame restored). **Merge-train disclosure:** the slice-6 opening-docs
commit `16aed91` also sits on the slice-4 branch (an ordering slip
before the slice-6 branch was cut); PR #28 therefore carries it —
harmless content-wise (docs only), noted so the train walk is not
surprised. **Queue: slice 7 is NEXT but NOT opened — the owner directed
a pause after the slice-6 close (2026-08-29).**

**RE-ENGAGEMENT 2026-09-03 (task-#23 review, owner-confirmed).** The
owner returned, reset the goal, and the progress/codebase review
against ROADMAP.md ran first as directed. Verified: both slice-6
branches clean at their recorded tips (parent `dbab5ad`, TokenData
`4f29720`, in sync with origin); backend suite re-run live 2624/2624;
remaining queue matches ROADMAP §3 exactly (slice 7 → theme unit → B0
→ B pages → C2+C3 → C4 + DoD close-out); ledger classes all sound
(in-queue rows L7→C4, L11→theme unit, L12→§8.1 all have named
executors ahead). The review caught TWO merge-train gaps, both fixed
with owner approval: (1) slice 6 had NO draft-PR CI vehicle — the
standing draft-PR-per-slice step was skipped during the fallback
window and missed by remediation, so the slice-6 tree had ZERO CI runs
at close; **parent PR #29 opened 2026-09-03** (its first run is the
tree's first CI pass — watch it). (2) The TokenData train entry still
pointed at #3/closers, orphaning the slice-4 cues + slice-6 surfaces
pack data from the train; **TokenData PR #4 opened 2026-09-03** from
its slice-6 branch (subsumes #3), train table re-pointed. **Slice 7
OPENED by owner confirmation 2026-09-03** under the restored stage
frame.

**Regression found and fixed via PR #29's first CI run (2026-09-03).**
PR #29/#30's first runs failed on backend LINT — and PR #28's tip run
174 had already failed the same way on 2026-08-29, unnoticed. Root
cause: the slice-4 S4 cutover (`726b552`) retired the venue cues.json
block from `app.js initializeServices` and removed the function-scoped
`fs` require with it, while the ducking-rules block below still called
`fs.readFile`. The ReferenceError was swallowed by that block's own
catch, so every boot of the post-S4 tree logged "Failed to load
ducking rules" and ran with the DUCKING ENGINE INACTIVE — invisible to
the unit suite, caught only by eslint `no-undef`. The slice-4/6 close
gates omitted `npm run lint` (fallback-window drift; the close records
made no lint claim, but the step was skipped). Fixed red-first:
contract pin `backend/tests/contract/app/duckingConfig.test.js`
(initializeServices must hand routing.json's ducking array to
audioRoutingService) + the one-line require restore, committed at the
point of introduction (`d68948f` on slice-4, backend 2598/2598 +
ratchet + lint) and merged up the chain (slice-6 `11893cd` verified
2598 green, then slice-7). Frozen production (`production-2026-07`)
predates S4 and is unaffected. Standing correction: every close gate
runs `npm run lint` alongside the suite from now on.

**SLICE 7 (report wording + B9 bundle schema) — ✅ CLOSED & CI-CONFIRMED
2026-09-03.** Final heads: parent `9a16dcd`+close-record commit /
ALNScanner `46db231` / ALN-TokenData `c44a8ef`; CI green on every head
(parent runs 184–188 incl. both Tier L matrix legs; scanner runs 96–97).
Design + full execution record (census ×2, r2 red-team 19/19, per-stage
two-axis reviews, the whole-slice adversarial review, all adjudications):
`2026-09-03-phase3-a3-slice7-report-wording.md` §8. **LANDED:** the
program-§13.4 ruling executed both halves — (a) B9 session-bundle schema
as a versioned engine contract artifact
(`backend/contracts/session-bundle.schema.json`, kind/schemaVersion
consts, engine stamp required, optional closed data sections, reserved
`intake`/`gameState` namespaces, hardened id shape; 24 contract pins; NO
Phase-3 consumer by design); (b) the report generator's wording/structure
split — engine-fixed parse anchors (headings, table headers, `---`,
H1/metadata formats, ★ cell) stay literal and contract-doc-v2-governed,
ALL other rendered text pack-declared via `strings.report.*` + per-mode
`verbNoun` (schema + both value twins + gate refusal twin + scanner
DECLINE, code-point caps pinned at all three layers), bake-is-ALN's-voice
(inverted pin holds ALN's strings.json silent on report wording; goldens
pin the rendered tier byte-for-byte), ONE cell-once sanitizer for pack
wording AND session data (backslash-then-pipe escaping, control/bidi/
U+2028-9 stripped), currency affixes through the pack money spec (3b's
deferral closed), counted class census (residue exact, both-class
overlap loud), export provenance warn (non-network tier OR
declared-but-unapplied sidecar, via tokenManager's retained load record),
template mechanism tombstoned everywhere (schema stub, both manifest
builders, role enum, doc drafts). **The whole-slice mixed-model review
earned its keep: 3 MAJORs fixed red-first** (13 unsanitized data-carried
sinks — deviceId rides the unauthenticated /api/scan; a double-escape
regression producing GFM-LIVE pipes that the invariant helper's
lookbehind then green-lit; the unpinned bake-voice premise) — record in
the design doc §8. **CLOSE GATE (all green on final heads):** backend
2661 unit+contract + fresh ratchet (82 files, raises only) + lint;
scanner 1604 + fresh ratchet (65 files, raises only) + build + lint;
pack contract 113; bundle contract 24; config-tool 114; PWA 165; Python
75; ESP32 leg unrun (zero slice-7 changes, pio absent — slice-4
posture); dual-pack Tier L locally on the FINAL tree (ALN 119P/0F/61
capability-gated skips + 4 Tier-H, 0 flaky; toy 120P/0F/60S, 0 flaky)
AND both CI legs green. Merge-train vehicles: TokenData #5, ALNScanner
#14, parent #30 (table below current). **Queue: theme unit (§13.5) is
NEXT.**

**THEME UNIT — ✅ FULLY CLOSED 2026-09-04** (branch
`claude/phase3-theme-unit` chained from the slice-7 tip `4923575`;
draft PR #31 opened AT open per the corrected discipline). Full record:
the unit design doc §8 (2026-09-03/04 entries). Landed: theme.schema.json
+ the gate twin + getTheme() snapshot; scanner theme DECLINE mirror +
packLoader theme role + the three rating sites (ALN's ruled star-drop:
the detective result screen hides the whole Value Rating row) + the
four-rule mode-token recolor; ALN theme.json (one-deep-equal pin) + toy
divergent theme (💎/gold/sky/teal); scoreboard %%PACK_THEME%% single-pass
injection + sink-side hex guard; fonts self-hosted (L11 RETIRED, L14
recorded). Whole-unit adversarial panel: 8 findings ALL folded red-first
(top: the substitution-ordering DoS this unit introduced — one-pass
replacer; the zero-survivors DECLINE hole — convergent 2 refuters; the
stale bundled submodule — re-pointed + NEW drift tripwire; the enforced
config-tool suite — the vacuous-tripwire class's 4th instance). The
2026-09-03 remaining-scope grill batch rode the close (program §14,
ROADMAP §8.16, CONTEXT.md terms). CLOSE GATE (final heads, bare exits):
backend 2732 + ratchet + lint; scanner 1666 + ratchet + lint + dist;
config-tool 119 ENFORCED; dual-pack Tier L — **ALN 120P/0F/62S+4H,
0 flaky** + **toy 120P/0F/61S, 1 flaky (restart-timing class, passed on
retry, diagnosed theme-untouched)**. Heads: parent close-record tip /
ALNScanner `deddaf9` / TokenData `491c513`. Vehicles: TokenData **#6**
(subsumes #5), ALNScanner **#15** (subsumes #14), parent #31. **Queue:
B0 (tooling foundation) is NEXT.** Original scope inputs for the record: Governed as a full A3 slice (program
§13.5): design doc, honest estimate, red-team, dual-pack gate. Scope
inputs: Q-3c-1(a) minimal theme.json (semantic mode colors, rating
glyph/display, scoreboard accent), Q-3b-2 (glyphs are visual identity;
star map confirmed), the ALN star-drop (§13.5 boundary: the THREE
GM-scanner display sites only — config-tool previews + the report ★
cell excluded), ledger L11 (scoreboard Google-Fonts CDN links retire in
the styling-bearing slice). Census next.

**B0 — 🔨 OPENED 2026-09-04** (branch `claude/phase3-b0` chained from
the theme-unit tip `8752d53`; **draft PR #32 opened AT open**). Governed
as a full unit (census → design → red-team → staged build). Scope
inputs: program Track B (pack/profile store with draft→publish — the
tool stops editing live files; app-shell shared store + model-module
discipline + frontend test harness; operator-tier auth v1 per §7 R1 +
§13.6 incl. the backend substrate and the scoreboard PLAIN read-scope
token), the 2026-06-11 config-tool pre-read, and the 2026-09-03 §14
rulings (E10 floor binds the PAGES unit, not B0 — but B0's store must
not preclude it).

Progress: census ×2-verified + design r1 + 18-objection red-team +
design r2 + owner ratification Q10(a)/Q11(a) — full record in
`docs/plans/2026-09-04-phase3-b0-tooling-foundation.md`. **BS.1
CLOSED 2026-09-04** (§7 execution record): grants algebra
(`gameRules/grants.js`), gate runner (`scripts/validate-pack.js`,
accepted-with-pins over the in-process extraction), full O3 operator
claims, operator floor at the commandExecutor choke point + WS actor,
observe token (scoreboard's injected ADMIN_PASSWORD DELETED),
`/api/vocabulary` zero-drift endpoint. Two-axis review folded (4
lazy-require hoists, `_resolvePackHash()` extraction); gates 2772/135
+ ratchet + lint all exit 0. **BS.2 CLOSED 2026-09-04** (§8 execution
record): draft store (`config-tool/lib/draftStore.js` +
`packFs.js`) + publish pipeline (`lib/publish.js` — Q11(a) refusal
first red test, engine gate via execFile'd runner, ordered rename
manifest-LAST, landed re-verify, publish log, mutex); the two pack
writers re-pointed at draft-bound ConfigManagers; strings/theme first
writer; live-pack write routes refuse 409; gm:identify display-class
fix (verified-tier, no GM registration/capacity). Two-axis review
folded (restampBase atomicity, packFs extraction, PublishRefused
type, 7 validator pins re-homed; PACK_PATH divergence adjudicated as
the ruled D-4.7c posture). Gates: config-tool 144 + lint, backend
2775/136 + ratchet + lint, all exit 0. **BS.3 CLOSED 2026-09-04** (§9 execution record): tool
login mints the aud pair (config-tool half self-minted from
backend/.env, orchestrator half fetched from /api/admin/auth and held
server-side); HTTPS; EVERY API route behind the gate (r2/S8 — the
fold flipped the shipped loopback-reads-open posture; the SPA logs in
at boot); shared store + draft-routed editors + Design/Venue split;
served-vocabulary re-sourcing (killed bidirectional action-set drift
+ two typeOk authoring bugs) with a tool↔backend wire cross-pin;
PUT /api/music/playlists show-control-gated with the proxied token;
jsdom + Playwright harness (pinned 1.57.0) whose smokes caught the
[hidden]-vs-class CSS bug twice. Gates: config-tool 176 + 2 smokes +
lint, backend 2778/136 + ratchet + lint, all exit 0. **BS.4 CLOSED — B0 ✅ FULLY CLOSED 2026-09-04** (§10
execution record in the B0 design doc). §5 proofs landed (`655fe17`:
floor rejection ×3 surfaces; pack-switch identity at issuance) + the
scripted store tier proof (no-op publish of the REAL ALN pack =
identical contentHash, submodule git-clean). Whole-unit adversarial
panel (2 Opus + Fable doctrine + Haiku sweep) — all surviving
findings folded (`f5af7c9`): service: joined the floor map; observe
store capped/swept/reset-rotated; display identity from the token
claim; WS aud enforced; tool refuses beyond-loopback on default
credentials; scoreboard renews by RELOAD (retires the 24h/restart
blank-TV residual — recovery now beats the password era); publish
post-landing tolerance + dot-prefixed landing tmps (debris can never
be inventoried); dirty-confirm; asyncapi second-token-class doc;
CONTEXT.md floor entry corrected + draft/publish + observe-token
vocabulary. Close gates ALL exit 0: backend 2785/137 + ratchet +
lint; config-tool 180 + 2/2 smokes + lint; GM 1666; PWA 165; ESP32
125; **dual-pack Tier L on the final tree: ALN 120P/0F/62S 0-flaky
(+ Tier H 4P) 34.3m; toy 121P/0F/61S 0-flaky** (the theme close's
one flaky passed first-try; identical 182 totals per leg). Accepted
residuals recorded in §10. Tip: the close-record commit on
`claude/phase3-b0` (draft PR #32 — owner un-drafts when the train
reaches it; parent-only unit, NO submodule bumps: ALN-TokenData /
ALNScanner / PWA / ESP32 all untouched by B0). NEXT in queue:
Design-workspace pages (#11, carries the §14 rulings incl. the E10
floor + the surfaces-editor open question).
**CI amendment (2026-09-04, post-close):** branch CI was RED from run
212 (the BS.1 operator-floor commit) through run 226 — the close gates
ran unit/contract/E2E but NOT the integration suite, where the one
casualty hid (`lighting-role-resolution.test.js` gm-sourced call
predating the floor, carrying no actor — floor-refused correctly), and
the Scanner Tests job had outgrown its 10-minute timeout (axed at
10m13s in runs 222/225 — workload, not a hang). Both fixed at
`df5c711` (operator-actor fixture matching the actorFloor idiom;
timeout 20m); **GREEN CONFIRMED run 227** (integration 348/348,
all 8 jobs). Process lesson folded forward: unit-close gates MUST
include the integration suite (BS.4's list omitted it).

**Design-workspace pages — 🔨 OPENED 2026-09-04, design r2 DONE,
⏸ BUILD GATE HELD ON OWNER** (full record:
`docs/plans/2026-09-04-phase3-design-workspace-pages.md`). Census
(two legs: surface + 19-binding constraints; one correction — the GM
scanner is NOT hot mid-session, packLoader loads at app start) →
design r1 → mixed-model red-team (two Opus legs, 21 findings; the
BLOCKINGs: E10 was missing the cue-engine reload AND the client
re-load contract; the preview orchestrator would SIGTERM the live
show's helpers via the singleton /tmp/aln-pm-* paths) → design r2
(§7): E10 as FOUR named steps incl. the `pack:applied` client
directive; the preview runtime-namespace seam designed in; per-block
game.json writers with draft-wide referential checks; pack selection
among on-disk roots (re-entering per the B0 §8 adjudication);
commit&push with the sync.py credential posture + rendered
parent-bump instructions; the three-identity staleness surface;
honest estimate ≈ 5.25–7 sessions (above the program's 3–5; carried,
not squeezed). **Owner batch §8: Q1 surfaces home with wireframes
(rec: pack-manager media panel); Q2 hot-apply guard with the
playtest cost stated (rec: refuse during active/paused); Q3 the L8
retire-vs-re-ratify checkpoint (rec: retire); Q4 the §14.1 split +
estimate sign-off. PS.1 does not open before Q1 + Q4.**

**C2+C3 (resolution mechanism + dormant-vs-fault) — 🔨 OPENED
2026-09-04, design r2 DONE, ⏸ BUILD GATE HELD ON OWNER** (full
record: `docs/plans/2026-09-04-phase3-c2c3-resolution-dormancy.md`).
Design opened while the pages build gate held — adjudicated: C2
DECIDES the 8.5 warn→enforce question rather than waiting on it.
Census (two legs) → design r1 → mixed-model red-team (two Opus legs,
18 findings; the BLOCKINGs: sticky-dormant vs out-of-band `report()`
+ boot ordering; `system:reset` wiping dormancy AND disables; silent
quick-fire success on a disabled cue; r1's endpoints interior
CONTRADICTED the ratified C1 §1/§2 shape; role-unbound mis-folded
into cue-level disables; plus census corrections — `setAutoDiscard`
HAS a video_busy caller at cueEngineService.js:632, only the
service_down cue holds + `videoQueueService._holdVideo` lack timers)
→ design r2 (§6): ONE pure resolve() (`gameRules/packNeeds.js`
collectPackNeeds + `gameRules/resolution.js` applying the RATIFIED
C1 §2 table verbatim — pack-side `onAbsent` authored in
pack-manifest.hardware, profile endpoints = C1 §1's physical keys);
health enum `healthy|down|dormant` contract-first (3 sites +
registry validator, `degraded` dropped pending Q-C3-2); STICKY
dormant (report() ignored while latched; feed runs post-init, at
session create/restore, inside system-reset re-wiring; profile
boot-frozen); TWO disable sets (GM-persisted + dormancy-recomputed)
with honest refusals; hold policy (video_busy 10s stays; fault holds
get session-end expiry + recovery affordances; dormant never held);
preflight covers all six C1 §3 groups, cert line WARN-ONLY (R8),
unknown-never-fault inventory rule; honest estimate r2 ≈ 3.5–4.5
sessions (carried, not squeezed). **Owner batch §7 JOINS the pages
batch — one sitting: Q-C2-1 packHash warn-vs-refuse (rec:
warn-only); Q-C2-2 the checklist partial-absorption split; Q-C3-1
the unbound idle-loop taxonomy (rec: DORMANT — this decides C4's
`_resolveIdleLoopFile` L12 flip); Q-C3-2 the enum (rec: drop
`degraded`); Q-C3-4 estimate sign-off. CS.1 does not open before the
batch; build sequences behind the pages build on the shared
branch.**

## Owner rulings 2026-07-18 (batch — plain-English queue session)

- **Slice-2 closers RATIFIED**: D1s2 gate+trim (slice-5 anchor verified in
  program §3), D2s2 implement allowNegative, D3s2 BOTH claim policies
  (per-mode flag + full enforcement), D4s2 full validator sweep. Recorded
  in the slice-2 design doc §6a. Build = task #24.
- **Slice 2b RATIFIED** (D1b/D2b/D3b all yes) — EXECUTED IN FULL and CLOSED (see the slice-2b row + design doc execution record).
- **Q10 CLOSED — ESP32 is a FIRST-CLASS platform** (owner, emphatic): a
  bespoke platform created for this system. Future pack-capability work
  targets it fully (pack delivery via asset-manifest sync stands; E5
  primitives are for it).
- **Group content**: production's no-completable-group state is an
  INTENTIONAL content choice — 07b's production self-skip is accepted;
  the toy pack owns that coverage. Owner-flag resolved.
- **Tier H**: hardware suite ran (owner-confirmed). **backend/.env HA
  token**: accepted as-is. **Merge train**: blocks nothing (confirmed).
- **Phase-4 timing correction**: NOT months away — D-track wireframes and
  Phase-4 prep are nearer-term than previously assumed.
- **C1 precision (correction)**: the installation-profile doc's review
  points were ALL RESOLVED 2026-07-09 — the "open points" previously
  attributed to it belong to the ONE-AUTH doc. C1 ratification is a
  one-word owner sign-off of the doc as written; only a minor one-time
  legacy-preset import note remains inside it.

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
- The 2026-06-18 documentation audit's 81 findings — **RE-HOMED
  2026-08-29 (owner-ratified; 3a closed without hosting it):** rides the
  DoD close-out unit as a BOUNDED triage (classify still-open vs
  superseded, record the residue list here) — not an open-ended sweep.

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
  under it in `77f905f`). **GRADUATED 2026-08-29 from someday-list to
  MUST-FIX before any public release** (the open-source north star,
  ROADMAP §7.4): untrack + rotate the token + git-history sweep. Timing
  stays owner-paced — nothing in Phase 3–5 blocks on it.

## Merge train (owner-ratified 2026-08-29 — ONE grand train)

The answer to "what do I merge, in what order." Ruling: NOT per-slice
trains — one grand train matching the chained-branch reality. Submodule
PRs merge FIRST (parent pins reference their SHAs; wrong order breaks
fresh clones), then the parent stack in slice order. Every future slice
adds its PRs to this block.

| Order | Repo | PR | Head | Close condition / note |
|---|---|---|---|---|
| 1 | ALN-TokenData | **#6** (opened 2026-09-04 at theme-unit close) | `claude/phase3-theme-unit` @ `491c513` | Subsumes #5 (slice-7; which subsumes #4/#3/#2) — owner closes #5 and earlier as subsumed. Adds theme.schema.json + the ALN star-drop theme.json + game.json theme pointer/requires on top of the slice-7 tree |
| 2 | ALNScanner | **#15** (opened 2026-09-04 at theme-unit close) | `claude/phase3-theme-unit` @ `deddaf9` | Subsumes #14 (slice-7; which subsumes #13/#12) — owner closes #14 and earlier as subsumed. Adds the runtime pack theme (DECLINE mirror, three rating sites, bundled data re-point to themed TokenData + drift tripwire) |
| 3 | ALNPlayerScan | **#6** | foundations | PWA is visibility-only (L3); no later train commits exist |
| 4 | arduino-cyd-player-scanner | **#7** | foundations | ESP32 pack identity via asset manifest; no later train commits exist |
| 5–17 | ALN-Ecosystem (parent) | **#19 → #31 in numeric order** (slice 0, 1, 2, 2b, 3a, 3b, 3c, 5, closers, slice 4, slice 6, slice 7, theme unit) | chained slice branches | Each is a stacked superset of its predecessor; merging in order keeps every intermediate state coherent. #29 (slice 6) opened 2026-09-03 — the slice closed without its draft-PR CI vehicle (a fallback-window process miss caught by the task-#23 review), so #29's first run is the slice-6 tree's first CI pass. #30 is slice 7, #31 the theme unit (both opened AT slice open per the corrected discipline). Train grows with remaining slices (B0…) |

Timing: owner-driven, post-run (§ Final cutover below); nothing merges
before the owner walks this table.

## Final cutover (single enumeration — 2026-08-29; program §12.1's pointer lands here)

Everything parked on "the cutover," in one place. **Mechanism
(owner-ratified 2026-08-29): the blue/green Pi swap — ROADMAP §3b.**
Green-Pi preparation opens after Phase-3 close at the earliest (owner
direction); the 2026-09-18 → 2026-10-18 weekly run executes on
`production-2026-07` (blue) untouched.

Collapsed onto the cutover (with owners):
1. **Merge train** (above) — owner walks it first; main becomes the
   deployable truth.
2. **R12 skew half + slice-2 same-pin-bump coupling** (development-model
   row) — dissolved by the swap: green ships all repos at the train tip
   simultaneously.
3. **2b residual exposure — THE ordering constraint:** an old deployed
   scanner build + a v2 pack silently scores groups at 1x. Scanner dist
   and pack pins ship in the SAME step; on green this is satisfied by
   construction (one machine, one build), but any tablet/PWA cache is
   part of the step: verify every consumer's reported packHash at first
   green preflight.
4. **Ledger L2 retirement clock starts** (cutover + one cycle); **L6
   retires at cutover** (with L9 riding the same shim family).
5. **Preflight = the run instrument** — C2's refresh decides hand-run
   doc vs absorbed mechanism; the slice-4 S4 cue-check rewrite keeps it
   truthful until then.
6. **Nested `data/` pins** (PWA + ESP32 submodules, still pre-v2) bump
   as part of the train — moved out of "Housekeeping someday" into this
   list.
7. **Rollback path:** blue, physically — the entire pre-cutover system
   retained on the shelf for at least the first few post-cutover events
   (supersedes the pins-only rollback runbook as primary; the
   `production-2026-07` pins remain documented as the software-level
   fallback).
8. **Stage-C rehearsals** (ROADMAP §3b) — each off-day venue session is
   a full dress rehearsal of this list.
