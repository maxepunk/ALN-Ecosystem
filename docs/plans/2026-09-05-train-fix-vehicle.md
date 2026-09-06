# Train fix vehicle — design + full findings triage

**Status: DESIGN — build gate HELD on the owner's estimate signature
(the standing pricing rule).** Unit branch `claude/phase3-train-fixes`,
cut from vehicle 19 (`claude/phase3-docs-repair`), intended as the
train's final vehicle, walked last.

**Input:** the whole-train review
(`docs/plans/2026-09-05-whole-train-review.md`): 8 surviving MAJORs,
36 MINORs, ~60 NOTEs, all adversarially refuted and reproduced.

**Owner directives (2026-09-05), binding on this triage:**
1. Pre-existing MAJORs are NOT deferred — all 8 MAJORs are in scope.
2. Every MINOR and NOTE gets an INTENTIONAL disposition — fix-now,
   or deferred to a NAMED home with a stated WHEN. No silent
   deferrals. This document is that record; §4's completeness rule
   makes it checkable.

**One correction to the review (verified against git):** MAJOR 4's
attribution to vehicle #33 (the docs repair) is wrong — the
`toLowerCase` line predates the train (commit `dabba87`, 2026-06-11)
and exists on `main`; the check BROKE when slice 2b (vehicle #22)
flipped scoring keys to exact-case while the checklist kept the
lowercase read. Real defect, real train regression, wrong vehicle
named. Severity and fix unchanged.

---

## 1. Fix-now scope (this vehicle)

Two PRs: a parent PR (stacked on #33) and a NEW ALNScanner PR
(stacked on #15), plus the parent pin bump — the scanner fixes
(MAJORs 7–8, the parity one-liners) cannot land any other way.

### 1.1 The eight MAJORs (each with a regression pin)
1. **M1** display sockets join `session:<id>` (scoreboard freeze;
   gmAuth.js) — plus **LA-2** (the same carve-out's other half:
   `initializeSessionDevices` must not register display sockets as
   GM stations).
2. **M2** `/health` refuses `type=gm` registration (the 5-GET GM
   lockout; healthRoutes.js).
3. **M3** `_readDiskGameConfig` treats parse-error/non-object as
   gate REFUSALS; only ENOENT is the packless posture — plus the
   same-family hardening that rides it: **F-P2-2** (`_readPackTokens`
   parse swallow), **F-P2-4** (modes-loop null guard), **F-P2-6**
   (unparseable `engine.minVersion` must refuse, not pass).
4. **M4** preflight §13.3 drops the `.toLowerCase()` (exact-case
   D2b keys).
5. **M5** preset load/import runs the engine gate before
   `writeScoring` — plus riders: **F-P5b-4** (surface the server's
   `details` array so gate refusals are readable),
   **F-P5a-2/F-P5b-1** (preset export downloads a 401 body — fix
   the download path).
6. **M6** (P1-1) reset clears/epoch-stamps `adminAdjustments` so the
   rebuild replays only post-reset deltas.
7. **M7** (LC-1) cue `icon` slugified/escaped at the CueRenderer
   sink + the `cues.schema.json` pattern enforced in
   `validateCuesBlock` — plus **F-P5b-2** (the cue editor stops
   authoring schema-illegal icons; same rule, authoring side).
8. **M8** (LB-1) standalone `resetScores` performs the full A3
   restart (transactions, `scannedTokens`, `tokensScanned`,
   `completedGroups`); networked client clears its `scannedTokens`
   set on `scores:reset` — plus **LB-5** (the reset confirm dialog
   tells the truth per mode).

### 1.2 Riding fixes — parity, display truth, engine smalls
- **LB-2/S1-4** scanner floors token values (backend parity).
- **LB-3/S1-3** scanner type lookup via `Object.hasOwn` (backend
  parity; the C11 class).
- **LB-4** standalone rejects unrecognised tokens (backend parity).
- **P3-1** `gameclock` `service:state` carries `expectedDuration`.
- **P1-2** the legacy-history default mode applied on the restore
  path too.
- **P1-3** cue vocabulary stops advertising the three
  `transaction:accepted` condition fields the payload never carries.
- **P4-1** `.local` origins added to the Socket.io CORS check (makes
  `.env.example`'s claim true).
- **P4-3** OpenAPI documents the music-playlists PUT auth gate.
- **F-P2-5/F-P8a-2** the L1 shim's `display` half drift-pinned (the
  test's own claim made true).
- **F-P6-1** sync writes the trailing newline (stops contentHash
  churn on the next Notion sync).
- **S1-1** report `_cell` sanitizer covers pack money affixes
  (golden-safe: ALN affixes unchanged).

### 1.3 Test-infrastructure items that guard the gates themselves
- **P9b-5** the E2E scanner-init helper picks mode pack-derived (the
  dual-pack toy leg currently exercises the wrong selection — this
  guards every future block's close gate).
- **P9b-1** `restartOrchestrator()` preserves pinned
  `packPath`/`profilePath`.
- **F-P9a-4** completeness pin binding the auth FLOOR action map to
  the AsyncAPI GmCommand enum (the grants.js comment records this
  class escaping once already).
- **Coverage floors:** S2-1/S1-2 (`theme.js`) and
  F-P8b-2/F-P11a-6 (the 4 backend modules incl. the authorization
  floor table) get ratchet entries.

### 1.4 The docs vehicle completes its own scope
- **F-P11a-2** the scanner-assets path corrected (no
  `ALN-TokenData/assets/` — name the real locations).
- **F-P11a-3** scoreboard credential documented as the per-serve
  OBSERVE JWT at all four sites (incl. backend/CLAUDE.md's stale
  claim, which the docs repair had propagated).
- **F-P11a-4** ALL ten spotifyd sites in the preflight fixed (the
  repair fixed §12.3 only; the master go/no-go block still requires
  a daemon the system doesn't use).
- **F-P11a-5** `ENABLE_AUDIO_WIRES` added to the env reference
  (verified: `broadcasts.js:386,413`).
- **F-P11a-7** the dead `test-scoreboard-update.js` deleted.
- **F-P11a-8** the three remaining stale guide claims fixed.
- **F-P11a-9** preflight checks xdotool/wmctrl/chromium-browser.
- **F-P11b-1/2** record consistency: ROADMAP + CURRENT-STATE say 19
  vehicles/#33 (they still said 18/#32); the orphaned
  investigation-context cross-reference.
- **LA-9** (scanner PR) the Playwright guide's dead
  `.transaction-card` selector corrected.

### 1.5 Walk notes (documentation into the train table, this vehicle)
From the review's integrity section, recorded beside the table so
the walker sees them: #19/#20/#21 heads are `[skip ci]` docs-only
commits on top of green SHAs; #31's own PR page shows a red Summary
check but its head SHA passed 8/8 as PR #32's first run; **LD-2** —
scanner vehicles merge before the parent vehicle that carries the
MESSAGE_TYPES cross-repo pin (expected; the parent CI leg catches
drift before `main`); **F-P11a-10** — the Tier-L matrix renamed the
CI check, so re-point any branch-protection required-check when
walking.

### 1.6 Close gate for this vehicle
Full backend + scanner suites, fresh ratchet both repos, dual-pack
end-to-end run green (both legs), scanner dist rebuilt, adversarial
review of the fixes themselves, records updated.

---

## 2. Deferred — every item with a named home and a WHEN

**Documentation rule discharged here:** each deferral names its home;
the home's WHEN is stated once per group; two deferrals are
transitional debt and get LEDGER ROWS (L15, L16) in PHASE3-STATUS in
this same commit. CURRENT-STATE.md carries the per-block deferral
pointers.

### 2.1 → Block 2, the hardening block (WHEN: the next block after
this vehicle lands; scope list re-priced and owner-approved at its
open — these items are hereby ON that scope list)
- **P4-2 + LC-3** the read-plane credential posture (any non-`gm`
  deviceType connects tokenless and reads full game state; the
  observe token exists for exactly this surface). Deliberate today,
  test-pinned, and now DOCUMENTED here as the standing posture; the
  keep-or-gate decision is an owner question at Block 2's open —
  it is the hardening block's core subject matter.
- **F-P2-3** manifest-builder symlink divergence + the symlinked
  inventory serving files from outside the pack dir.
- **F-P2-7** content-edit-without-manifest-rebuild detection (the
  drift warn compares manifest-to-manifest only).
- **F-P2-8** surfacing the active profile's identity (rides the
  preflight instrument, which reports profile identity anyway).
- **LC-6 + P9b-9** workflow `permissions:` blocks, action SHA-pins,
  concurrency guard.
- **P9b-4 + P9b-8** rung-1 hygiene (placeholder media in tree; HA
  token + world-writable bus left in /tmp).

### 2.2 → Block 2's close — the test-hardening & contract-truth
sweep (WHEN: Block 2's close gate; the hardening block opens
contracts for the health enum anyway, so the contract-inventory
items land in the same pass)
Test quality: S2-2, S2-3, S2-4, WE-4, F-P8a-1, F-P8a-3, F-P8b-1,
F-P8b-3, F-P8b-4, F-P8b-5, F-P9a-1, F-P9a-2, F-P9a-3, P9b-2, P9b-6.
Contract truth: P4-5, P4-6, P4-7, LA-6/WE-2, LA-7, LA-8,
P1-observation (the dead `allTeamScores` field).

### 2.3 → Block 5, the pages/config-tool re-cut (WHEN: the preview
block's design; CONDITION making the deferral safe: the config tool
remains loopback-only, operator-credentialed, and pre-show until
then)
- F-P5a-3 (the full README rewrite — an interim one-paragraph
  accuracy banner IS in §1's fix-now scope), F-P5b-3 (controls
  displaying values they never store), F-P5b-5 (deleted-draft
  wedge), F-P5b-7 (vocabulary prototype-chain lookups), F-P5b-8
  (phantom unpublished-draft), F-P5b-9 (pack-manager prototype
  defects), F-P5b-10 (pack key in CSS selector).
- **F-P5a-4** publish-writes-into-submodule-with-no-commit-step →
  **NEW LEDGER ROW L15**; the mechanism (commit step or draft-store
  handoff) is a Block-5 design point.
- **F-P5b-6** the 545-line throwaway pack-manager prototype →
  **NEW LEDGER ROW L16**; retired by the pack-manager stage that
  replaces it.

### 2.4 → Block 6, the doc triage (registry 8.7) + ledger sweep
(WHEN: the era's close)
F-P6-2 (TokenData CLAUDE.md file inventory), F-P7-1 (validator dies
on a game.json-less pack — post-walk this is an unstamped-legacy
edge), F-P7-3 (two unreachable validators), F-P7-4 (parity fix on
dead code), F-P7-5 (scripts/README names the retired
scoring-config.json).

### 2.5 → Registry row 8.10, the bundle migration (WHEN: owner-paced,
clock starts at the capture block's emitter)
S2-5 (the negative-money rendering inconsistency the golden freezes),
F-P7-2 (non-scoring breakdown printed under "Scoring transactions")
— both are report-output changes; the report is byte-pinned until
8.10 by design.

### 2.6 → The final-cutover list, item 6 (WHEN: the walk/cutover —
the list already exists in PHASE3-STATUS "Final cutover")
LA-3/WE-3 (the PWA's pre-v2 nested pin — the cutover list already
owns it), WE-1 (stale pack identity displayable as current — moot
once the pin bumps; verify then), LA-4 (the false-green PWA identity
test — fix when the pin bump makes it testable for real).

### 2.7 → The Q12 secrets rotation (WHEN: before previewable —
already ratified)
LC-4 (the committed `backend/ssl/key.pem`): the green machine mints
its own key per the guide; add "regenerate + untrack the committed
key" to the rotation's checklist.

### 2.8 → The Block-1 home hardware pass task list (WHEN: before the
first ESP32 asset sync on green)
LA-5/F-P6-3: regenerate the ESP32 asset manifest FILTERED to
pack-referenced assets and carrying the pack identity (cuts ~20 MB
from the 38.8 MB first boot; the regeneration is part of running the
sync pipeline fresh on green).

---

## 3. New ledger rows (added to PHASE3-STATUS in this commit)

| # | Debt | Retirement trigger | Tripwire |
|---|---|---|---|
| L15 | Config-tool publish writes into the `ALN-TokenData` submodule working tree with no commit step and no operator warning (`config-tool/lib/publish.js:165-192`) — a publish can silently diverge the working tree from the recorded pin | Block 5 pack-manager stage designs the commit/handoff mechanism | This row; `git -C ALN-TokenData status --porcelain` non-empty after a publish |
| L16 | 545 lines of self-declared THROWAWAY pack-manager prototype ship on the train (`config-tool/public/js/sections/packs.js`) with prototype defects (F-P5b-9) | Block 5 pack-manager stage replaces it | This row; the file's own THROWAWAY header comment |

## 4. Completeness rule (checkable)

Every surviving finding id from the review appears EXACTLY ONCE in
§1 or §2 (merged duplicates counted under the kept id, per the
review's §5 merge table). The review's §2 cleared/refuted items and
§2.3 ruled-or-ledgered items required no disposition. Any id found
missing from this document is a triage defect — fix the document,
not the classification silently.

## 5. Estimate (for owner signature BEFORE build)

Two-repo vehicle (parent PR + new scanner PR + pin bump). Eight
MAJOR fixes with regression pins (~half the work — M7 and M8 carry
the most test weight: XSS pin + reset-parity on both sides),
~30 small riding fixes (§1.2–1.4, most one-liners with pins),
records + ledger rows + walk notes, then the full close gate (§1.6).

**≈ 2.5–3.5 work sessions.** Deviation rule per §12.3: if the build
uncovers scope beyond this triage, it stops and re-prices.

## 6. Build method — subagent/workflow policy (owner-set 2026-09-05)

**Build inline; orchestrate the verification, not the edits.**

1. **Single-context TDD build, no parallel build agents — and the
   single context is the MAIN SESSION (Fable), not a delegated
   build agent** (owner-clarified 2026-09-05). The fixes compose
   with ratified semantics (the D2s2 rebuild floor, the ruled reset,
   the gate's refusal wording, the established icon-slugify
   convention); a delegate works from a handoff that approximates
   that context and drifts at exactly the seams where these bugs got
   in. If continuity breaks mid-build, the fallback is the standing
   rule — resume from the green-stage record in a fresh session —
   never a mid-build handoff to a different context. The review did
   the discovery; what remains is surgical work in shared hot files
   with interacting fixes (M1+LA-2 one carve-out; M8+LB-5+the
   networked clear one reset story), and the parity fixes are only
   safe because one head holds both the backend and scanner sides. Per finding cluster: re-run the review's
   reproduction on this branch (prove red) → turn it into the
   regression pin → fix to green → commit.
2. **Subagents carry the bulk reads** (process rule): "every
   consumer of X" sweeps go to cheap reader agents (Explore/Sonnet,
   low effort); long suite runs go to background processes.
3. **The close runs the house mixed-model adversarial review as a
   workflow** (~12–18 agents): finders per fix cluster (Opus
   medium); an injection lens on the M7 fix (Fable) and a parity
   lens re-executing reset/scoring on both sides (Opus high);
   per-finding refuters, Fable high effort for MAJORs.
4. **Stage discipline** (the stage is the unit; each stage commits +
   pushes green): S1 parent MAJORs + engine smalls (§1.1 items
   1–6 + §1.2–1.3 backend) → S2 the scanner PR (M7, M8, parity
   trio, LA-9, dist rebuild) → S3 docs + records + pin bump
   (§1.4–1.5) → S4 close (§1.6 + the review workflow). Draft PRs
   open at build start as CI vehicles. The §5 scope brake stands.

Rationale: orchestration earned its keep in the finding phase, where
work was independent and read-only; in the fix phase the work is
coupled and write-heavy, so parallelism moves back to where
independence returns — verification and adversarial review.

## 7. Execution record (S1–S3, updated at each stage close)

**S1 — parent MAJORs + engine smalls (closed 2026-09-05, commits
`a6d9354`…`da741ea` on parent `claude/phase3-train-fixes`, PR #34).**
All six parent MAJORs landed reproduce-red-first: M1 display
session-room join (gmAuth + broadcasts, connect-before-AND-after-
session pins), M2 /health gm-registration lockout (400 + capacity
pin), M3 pack-gate parse refusals (read-problem plumbing + minVersion
shape + null-mode entry; EISDIR + array-tokens coverage), M4
preflight §13.3 exact-case (attribution corrected: the toLowerCase
predates the train — dabba87 — and broke at slice 2b's D2b flip,
not vehicle #33), M5 preset engine gate (staged writeScoring +
validate-pack subprocess; refusal surfaces `details`), M6 reset
voids adminAdjustments (rebuild replay stays current-epoch). Riders:
gameClock expectedDuration, session hydration mode default, cue
normalizer phantom-field removal (+cueEditor list), CORS `.local`,
sync trailing newline, test-server PACK_PATH restart plumbing,
scanner-init pack-derived modes, oneAuthProofs floor tripwire,
config-tool lint promoted to error (owner ruling: "pre-existing" is
an attribution, not a verdict). Backend 2845/2845 (144 suites),
ratchet 85/85 (grants/packNeeds/resolution enrolled), config-tool
182/182, scripts 28/28.

**S2 — scanner half (closed 2026-09-06, commit `d8b9483` on
ALNScanner `claude/phase3-train-fixes`, PR #16 draft stacked on
#15).** M7 CueRenderer icon slugified at the sink (hostile-icon XSS
pin); M8 standalone resetScores full restart + networked claim-Set
clear (in-place, TQ-7) + truthful dialog (07d-02 first sentence
preserved); LB-2 floor, LB-3 Object.hasOwn type lookup, LB-4
standalone unknown-token refusal (each red-first; two old-truth pins
in app.test.js rewritten to the new truth); LA-9 guide selector
(`.token-card`). Fresh ratchet enrolls theme.js 90/100/90 (S2-1);
GameOpsRenderer + uiManager floors rose; nothing lowered (66 files).
Scanner 1680/1680 (87 suites), vite build green.

**S3 — backend M7 half + pin bump + records (this commit).**
`validateCuesBlock` enforces the icon class-key pattern
(`ICON_PATTERN`, exported + drift-tripwired against
cues.schema.json `$defs/cue/properties/icon`) — closes F-P5b-2
end-to-end (gate refuses at activation; scanner sink slugifies as
defense in depth). Both packs (ALN + toy-heist) re-validated ok.
Parent ALNScanner submodule pin → `d8b9483`. Train table row 20
updated with PR numbers (#34 + #16).

**S4 — close (2026-09-06).** The §6 mixed-model adversarial review ran
as a workflow (15 agents: 6 Opus finders + Fable injection lens +
Opus-high parity lens; per-finding refuters, Fable-high for MAJORs;
~2.2M tokens). 7 findings, 6 survived refutation, 1 refuted (the
`__proto__` spread-vs-assign scoring divergence — real mechanism,
pre-existing, not fix-caused). Dispositions:

1. **MAJOR (fixed)** — the S1 scanner-init.js fix itself regressed the
   toy E2E leg: current mode became pack-derived while the callers'
   TARGET stayed the ALN literals, so the inequality was permanently
   true and the single blind toggle parked the scanner one mode PAST
   the pack default (fence → tipoff, non-scoring, while logging
   "blackmarket"). Fixed: the caller's literal resolves as a ROLE
   against declared modes (declared-id match wins; blackmarket → first
   standard-scoring mode, detective → the scoreboard-evidence surface
   mode), toggling cycles until the pill shows the target and THROWS
   if unreachable; the log reports the resolved id. The toy E2E leg is
   the red/green vehicle (refuter re-executed the failure end-to-end).
2. **MINOR ×2, same defect (fixed)** — the M8 standalone full restart
   deleted transactions but announced only scores:cleared, leaving the
   history badge / scan stats / admin Game Activity rendering deleted
   rows. resetScores now also emits data:cleared (pinned), and the
   main.js data:cleared handler refreshes stats/history/team-details.
3. **MINOR (fixed)** — P3-1 added expectedDuration to the gameclock
   service:state wire without updating asyncapi.yaml. Schema + summary
   line updated, field REQUIRED (sync:full parity); mutation-checked:
   deleting the producer line now fails the contract test.
4. **MINOR (fixed)** — the new icon gate refused `icon: null`, the
   config-tool editor's own "no icon" value (and the engine's
   normalized form). Three-layer agreement: gate treats null as absent
   (pinned), cueEditor deletes the key for a cleared field, and
   cues.schema.json is nullable (TokenData `a9a482f`, PR #7 stacked
   on #6 — the vehicle's TokenData leg).
5. **NOTE (deferred, documented)** — the M5 preset gate refuses the
   whole load when the live pack is gate-invalid for reasons the
   preset neither causes nor can fix, blocking the env/routing restore
   the preset does own (plus a temp-dir name leaking into the refusal
   for manifest-less packs). No fix invariant is broken and the pack
   is unbootable in that state regardless. HOME: the Block 5
   config-tool re-cut (§2's B5 row), as a differential gate — compare
   the staged verdict against a pre-write verdict of the untouched
   pack and refuse only NEWLY-introduced problems; preserve packId by
   seeding the staged manifest. WHEN: when B5 opens.

**Lint-backlog extension of the owner's ruling (2026-09-06,
"pre-existing is not a verdict", second application):** the scanner's
48-warning backlog was cleaned in the same window (scanner `bc81541`):
35 unused-vars fixed (two were latent test smells now made honest —
an unasserted listener flag and MusicRenderer's never-checked
same-node claim), 3 deliberate control-regex strips kept behind
line-level disables with reasons, 3 environment globals declared
(io/NDEFReader/Buffer), 2 dead initializers, 1 error-cause attach —
and the `noisyDowngrades` warn block DELETED: eslint:recommended now
runs at error so the backlog cannot regrow.

**Close gate:** backend 2849/2849 (144 suites) after the fold, ratchet
85/85, lint clean; scanner 1681/1681, lint 0 problems, ratchet 66/66,
dist rebuilt; config-tool 182/182.

**Dual-pack E2E + the environment-fault finding (2026-09-06).** The
folded-tree legs: ALN 116 passed / 6 failed / 60 skipped; toy 120
passed / 2 failed / 59 skipped (every toy scoring flow green — the
S4 MAJOR fix confirmed live: `tipoff game mode (asked: detective)`).
The 8 failures were then diagnosed to root cause — and the owner's
challenge corrected two wrong verdicts I had recorded on the way
("load flake", then "environmental"):

- The 21-player-scanner video-alert tests (4 of the 8) had NEVER
  actually executed: their `if (!videoToken) return` early-exit made
  them PASS VACUOUSLY at every prior close (the generated video
  fixture didn't exist). Once `kai001.mp4` appeared locally
  (2026-09-04) they ran for the first time and failed honestly —
  because the alert requires the orchestrator to actually queue the
  video (`canAcceptVideo()` → vlc_down → `status:'rejected'` →
  "video unavailable" toast), i.e. they are VLC primary-path tests.
- VLC being down here is a FAULT, not an environment trait
  (CONTEXT.md §5 endpoints-vs-stack; this container is a measured
  rung-1 host — `2026-09-04-rung1-capability-research.md`). The E2E
  suite's own `vlc-service.js` predates rung 1: it spawns cvlc as
  the CURRENT USER (root — VLC refuses, silently) against a session
  bus that does not exist. Every E2E run in this container has had
  VLC down for that reason alone.
- The 07d-03 held-item failures (2): run-gate accepted
  sound-OR-lighting down while the body fires only a SOUND-dependent
  cue; when pw-play's install flipped sound healthy, the test ran,
  fired nothing, and timed out. Its file was byte-identical to base.

Fixes (commit c7d11d3): capability wiring + `requireCapabilities
(['vlc'])` + loud `test.skip` replacing both silent early-returns
(the harness's own rule: never silently skip); held-item run-gate
now matches its fire-gate (`requireDegraded(['sound'])`).

**Rung-1 validation (the proper one, after an improper first
attempt that only re-confirmed the skips in the faulted env):** the
CS.1 harness arms (session bus + pipewire + Xvfb, verbatim
`tests/rung1/up.sh` blocks) + the research doc's proven cvlc
invocation came up first-try in this container — root pinging the
harness user's VLC over the shared bus (cross-uid proof reproduced).
With that environment exported, the two spec files ran with `VLC
started: real mode` for the first time: 39 passed / 0 failed /
4 loud skips / 1 flaky. The video-alert flow EXECUTED and PASSED on
both browsers (first genuine coverage of that user flow in E2E);
the held-item test skipped loudly (sound healthy — correct).
Flaky note (do not ignore): 21:346 "minimum 5 seconds" needed a
retry on chromium — a timing-sensitive visibility assertion.

**Open item needing an owner scope ruling:** E2E × rung-1
unification — teaching the E2E suite (or its CI job) to bring up /
reuse the rung-1 arms so real-VLC coverage is automatic instead of
hand-run, and re-baselining the dual-pack legs on that posture.
C-track-shaped work (the resolution/dormancy unification already in
flight); candidate homes: the C-track close, a dedicated unit after
this vehicle, or fold into this vehicle. Until ruled, the vehicle's
E2E posture equals every prior close's (capability-gated legs), now
with loud skips instead of silent vacuous passes.

## 8. S5 — the E2E suite learns the rung-1 environment (owner-ruled 2026-09-06: "a faulty E2E suite IS a bug")

The end-to-end suite's video support predates the environment ladder
and cannot start VLC where the suite runs as root or where no D-Bus
session bus exists — which silently disabled every video test in this
container and (via a missing fixture file) let them pass vacuously.
Ruled into this vehicle as a bug, not follow-on work. Design:

- **One new helper, `tests/e2e/setup/session-env.js`** —
  `ensureSessionEnv()`, idempotent: (a) if no live session bus,
  start a private dbus-daemon with the permissive cross-user config
  (verbatim from the measured recipe in
  `2026-09-04-rung1-capability-research.md` / `tests/rung1/up.sh`)
  and export its address; (b) if no live X display, start Xvfb (the
  rig's finding: without a real X server every VLC item lands
  `stopped` and completion events never fire).
- **`vlc-service.js` spawns VLC as a dedicated non-root user when
  the suite runs as root** (VLC refuses root — the research doc's
  measured fact), same user convention as the rig (`rung1vlc`), and
  adds `--control dbus` (the proven MPRIS flag). Non-root callers
  keep the current direct spawn.
- **Video fixtures become self-seeding**: before a run, every video
  file the pack's tokens name is seeded from the committed
  `test_10sec.mp4` sample when missing — mirroring the rig's
  `generate-fixtures.js` token-video block (cited; drift note).
  This kills the vacuous-pass mechanism at its root: the fixture
  can no longer be silently absent.
- **CI**: the end-to-end workflow gets the same packages the rig's
  workflow installs where missing; where the environment still
  can't run VLC, the S4 capability gates skip loudly.
- **Close evidence**: both full legs (production pack + toy pack)
  re-run with video genuinely live; the shaky "minimum 5 seconds"
  assertion examined in the same pass.
