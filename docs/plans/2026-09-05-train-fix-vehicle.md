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

1. **Single-context TDD build, no parallel build agents.** The
   review did the discovery; what remains is surgical work in shared
   hot files with interacting fixes (M1+LA-2 one carve-out;
   M8+LB-5+the networked clear one reset story), and the parity
   fixes are only safe because one head holds both the backend and
   scanner sides. Per finding cluster: re-run the review's
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
