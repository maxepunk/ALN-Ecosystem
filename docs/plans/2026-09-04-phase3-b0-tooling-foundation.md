# Phase 3 · B0 — tooling foundation (design doc)

Opened 2026-09-04 on `claude/phase3-b0` (chained from the theme-unit
tip `8752d53`; draft PR #32 at open). Governed as a full unit: census
→ design rounds → red-team → staged build with per-stage two-axis
reviews → whole-unit adversarial review → dual-gate close.

## 1. Scope and inputs

B0 is the Track B foundation the Design-workspace pages stand on
(program Track B; §7 R1; §13.6; the 2026-06-11 config-tool pre-read;
the one-auth/O3 doc's v1 subset; the 2026-09-03 §14 rulings):

- **B0.1 — pack/profile store with draft→publish.** The tool stops
  editing live files. Drafts are tool-private; publish is the explicit
  step that lands content where the engine reads it.
- **B0.2 — app shell + shared store + model-module discipline +
  frontend test harness.** The five pages must not become five
  snowflakes; the musicModel exemplar becomes the norm; the DOM layer
  becomes testable.
- **B0.3 — operator-tier auth v1**, including its BACKEND substrate:
  token claims, issuance-time grant computation, the function check in
  commandExecutor/routes, and the scoreboard token with a PLAIN read
  scope. Players and scanners NEVER get user-facing logins (§13.6);
  `/api/scan` stays anonymous with its ledger row.

Boundary notes: E10 hot-apply belongs to the PAGES unit (§14.2 floor),
but B0's store must not preclude it — publish-time re-activation is the
named adjacency. The preset system is C1's replacement target, not
B0's; B0 must not extend it.

## 2. Census record (2026-09-04 — two independent legs, counts ×2-verified)

Both legs derived every count from the tree independently; all
load-bearing numbers AGREE. One grouping difference reconciled: six
write OPERATIONS over five live TARGET groups (upload + delete share
the asset-dir target).

**The tool today** (`config-tool/`): `server.js` (41L, loopback-only,
NO auth — a documented pre-show posture; `CONFIG_TOOL_HOST` opt-in
warns) + `lib/` ×5 (`configManager.js` 434L, `routes.js` 314L,
`envParser.js` 116L, `validators.js` 151L, `secrets.js` 33L) + one
SPA shell (`public/index.html`) with 6 lazy section modules + `tests/`
×8 files (node:test; supertest for routes).

**21 API endpoints** (routes.js; pre-read's "27" is drift): 9
read-only, 12 mutating. Every mutating route lands DIRECTLY on a
live-file writer — no draft layer exists anywhere.

**The six live write operations** (the sites B0.1 must absorb):
1. `writeEnvValues` → `backend/.env` (configManager.js:104-118)
2. `writeScoring` → `ALN-TokenData/game.json` + in-place manifest
   rebuild (:120-150, manifest :155-160)
3. `writeCues` → `ALN-TokenData/cues.json` + manifest rebuild +
   rollback (:162-234)
4. `writeRouting` → `backend/config/environment/routing.json`
   (:236-239)
5. Asset upload → LIVE `backend/public/{audio,videos}` (multer
   destination, routes.js:104-118)
6. `deleteAsset` → same live dirs (configManager.js:296-301)

Presets (configManager.js:318-431) are a flat snapshot/restore that
fans out to writers 1-4 — same targets, not a seventh; the system is
C1's replacement target. Shared atomic `_writeJson` (tmp+rename,
:244-253) and validate-before-write exist and carry forward.

**What fights draft→publish** (both legs, identical list):
`DEFAULT_PATHS` hardcoded live map (:21-39); direct submodule
working-tree writes; `_rebuildPackManifest` in place on every write
(no content-hash-as-draft-identity); presets snapshotting live files;
uploads landing in the live serving dirs.

**Test harness**: node:test only — no jsdom, no Playwright in
devDependencies. Covered: configManager, envParser, routes
(supertest), formatting, musicModel, one conditionBuilder pure
function. UNCOVERED: `lib/validators.js` + `lib/secrets.js` (no
dedicated file) and 14 of 17 `public/js` files (app shell, all six
components incl. the 382L timelineView, five of six sections, both
utils). Census oddity for the record: `cueTriggerEvents.test.js`
tests the BACKEND's standingEvaluator, not config-tool code.

**Backend auth surface today** (the B0.3 substrate touchpoints):
- `middleware/auth.js:93` `requireAdmin` — Bearer JWT, all-or-nothing
  `role:'admin'`; SINGLE consumer (`adminRoutes.js:58`, GET /logs).
  Issuance: `POST /api/admin/auth` (adminRoutes.js:17 →
  generateAdminToken, auth.js:17-41; claims today are only
  `{id, role, timestamp}`).
- WS handshake (`socketServer.js:45-104`): JWT + role check only for
  `deviceType==='gm'`; `gmAuth.js:30` re-checks; `adminEvents.js:31`
  gates gm:command by deviceType.
- `commandExecutor.js:117-123` — the cue-vs-gm FLOOR guard: the
  execution-time choke point where O3's FLOOR functions
  (session-lifecycle / show-control / score-intervention) re-check.
- Scoreboard: `resourceRoutes.js` injects `ADMIN_PASSWORD` into the
  served page — the mechanism the PLAIN read-scope token replaces.
- `/api/scan` (scanRoutes.js:19): anonymous by ruling (§13.6 ledger).
- One-auth v1 subset status: ENTIRELY unbuilt — no tier/class/function
  claims, no grant computation, no function-scoped middleware.

**Pre-read decision table vs today** (both legs agree): keep-items all
stand (server/routes/supertest, atomic writes, el()/CSS, timelineView
kept-not-upgraded, tokenBrowser, musicModel-as-exemplar, no-build
vanilla JS). NOT built: B0.1 store, B0.2 shared store + DOM harness
(pure-logic tests only), B0.3 auth AND the served-vocabulary
re-sourcing (`TRIGGER_EVENTS` cueEditor.js:10 / `ACTION_DEFS`
commandForm.js:8 still hand-mirrored), validators
schema-per-store-kind, preset→profile replacement (C1's, tracked
there). The pre-read's own gate — "Track B pages must not be built
before B0 lands" — is confirmed still unmet, which is why B0 is this
unit.

**E10 adjacency (context only, not scoped):**
`packService.activatePack()` is boot-only with exactly one call site
(`app.js:192`); the frozen-snapshot pattern plus the existing
`_cachedScoringRules` reset already anticipate re-activation. B0.1's
publish flow must leave a clean seam for a later post-boot
re-activation call, and must not add a second pack-state authority.

## 3. Design r1 (2026-09-04)

### D-B0.1 — the pack/profile store: drafts beside the truth, publish through the engine's own gate

A **draft** is a complete working copy of a pack (or an installation
profile), copied on first edit from the live source into a tool-private
directory (`config-tool/data/drafts/<store>/<draftId>/`), stamped with
`{draftId, base: {contentHash}, created, lastEdited}`. Editing ALWAYS
targets a draft — the six census writers stop touching live files for
PACK content. **Publish** is the one explicit landing step:

1. Re-validate the WHOLE draft with the ENGINE'S OWN activation gate —
   not a parallel validator. The `PACK_PATH` seam already lets
   `packService` evaluate an arbitrary pack directory (the harness
   precedent); publish runs that gate against the draft dir and
   REFUSES on any problem the engine would refuse at boot. One
   validation authority, zero drift by construction.
2. Rebuild the manifest INSIDE the draft (content-hash = the publish
   identity), then copy the validated tree onto the live target
   (`ALN-TokenData/` working tree — the same location today's writers
   hit; the frozen-production model is untouched: disk changes take
   effect at next boot, and later E10 hot-apply gets a clean seam, a
   single post-boot `activatePack()` re-entry, which this design must
   not preclude and does not implement).
3. Append a publish-log entry `{when, contentHash, base}` — the
   version trail the pages' diff feature later reads.

Git commit/push of the published submodule state ("commit & push
pack") stays a PAGES feature (pack-manager page, per the pre-read);
B0 publishes to the working tree only. The PROFILE store is the same
mechanism over installation-profile documents (C1 schema), so C4's
bindings page lands on a finished store.

**Scope cut (red-team this):** the env (`.env`) and `routing.json`
writers stay DIRECT (validated, atomic — as today). They are venue
config, not pack/profile content; draft semantics buy nothing a
pre-show tool needs, and absorbing them widens B0 without serving the
pages. Asset uploads stay on the live dirs — that is the §8.1 media
story, deferred by ruling. Presets stay untouched (C1 replaces them).

### D-B0.2 — app shell, shared store, harness

- **Two-workspace shell** (decided in the program): Design / Venue nav
  split in the existing no-build SPA; sections keep lazy loading.
- **Shared client store**: one plain observable store module
  (`public/js/store.js` — subscribe/update, no framework), holding
  draft identity + dirty state + auth session; sections read/write
  through it instead of ad-hoc module state. musicModel's
  pure-model-plus-thin-DOM split becomes the REQUIRED shape for new
  code (model modules unit-testable without DOM).
- **Harness**: add jsdom to devDeps; DOM-layer units run under
  node:test + jsdom (the census's 14 untested public/js files gain
  coverage as they are TOUCHED — B0 does not retrofit tests to code
  it does not change). A Playwright smoke tier for the tool is the
  PAGES era's concern.

### D-B0.3 — operator-tier auth v1 (the O3 subset, nothing more)

- **Claims**: `POST /api/admin/auth` mints
  `{tier:'operator', class:'staffed', functions:[...], aud, exp}`
  alongside today's fields (backward-compatible — existing consumers
  keep working). Functions are computed AT ISSUANCE (grant = operator
  ceiling; the pack-assignment ∩ ceiling algebra ships with its
  operator-only degenerate case — the full tiers are Phase-4 E4).
- **Enforcement**: a `requireFunction(fn)` middleware beside
  `requireAdmin`, and a function check in `commandExecutor` for
  operator-sourced commands at the SAME first-check position as the
  existing cue-floor guard (two floors, one choke point). v1 wires
  operator-credentialed surfaces ONLY (§13.6): config-tool requests
  and the admin HTTP routes; the GM scanner WS path keeps its current
  all-or-nothing check this phase (its function-scoping is E4).
- **Scoreboard**: the served page stops carrying `ADMIN_PASSWORD`.
  Serve-time injection mints a `{tier:'device', class:'display',
  functions:['observe']}` token instead — the PLAIN read scope. The
  WS handshake accepts it for read-only connections (no gm:command).
  This deletes a live credential from every venue TV's page source.
- **config-tool auth**: the tool gains a login (password →
  operator token, `aud: config-tool`), sent on every API call;
  `server.js` enforces it when bound beyond loopback and (decision)
  ALWAYS on mutating routes even on loopback — cheap, and the pages
  era inherits a closed door instead of an open one.

### D-B0.4 — stage plan

- **BS.1 backend auth substrate** (red-first at contract seams):
  claims + issuance, `requireFunction`, the commandExecutor operator
  floor, the scoreboard observe token + page de-passwording.
- **BS.2 store server-side**: draft CRUD + publish-through-the-gate +
  publish log; the two PACK writers (scoring, cues) re-pointed at
  drafts; strings/theme gain store coverage (no live writers exist
  for them today — the store is their FIRST writer, ready for the
  pages).
- **BS.3 tool client**: two-workspace shell, shared store, login
  flow, jsdom harness; sections re-wired to draft semantics.
- **BS.4 close**: whole-unit adversarial review, dual-pack Tier L
  (the store must leave engine behavior BYTE-IDENTICAL — publish of
  an unedited draft is a no-op by content-hash), records.

### D-B0.5 — estimate (honest, per the slice-7 lesson)

BS.1 ≈ 0.75–1 session; BS.2 ≈ 1–1.5 (the gate-reuse seam is the risk:
packService import isolation from config-tool); BS.3 ≈ 0.75–1;
BS.4 ≈ 0.5. Total ≈ 3–4 sessions — ABOVE the program's 1.5–2.5
re-pricing, driven by B0.3's backend substrate being entirely unbuilt
(census §2). Recorded rather than squeezed.

## 4. Design red-team record + adjudications (2026-09-04)

Panel per the subagent policy: 2 Opus refuters (security/auth,
architecture/state) + a Fable doctrine/parity leg. 18 objections, ALL
adjudicated ACCEPTED (several convergent). The r1 text stands as the
record; §5 below carries the superseding r2 decisions.

| # | Leg | Sev | Objection (condensed) | Disposition → r2 |
|---|---|---|---|---|
| S1 | sec | CRIT | Observe token passes requireAdmin (decode-only check) via the unauthenticated /scoreboard issuance oracle | D-B0.3r2: verification takes required tier+functions; requireAdmin retired into requireFunction; observe tokens in an independent short-TTL store, never adminTokens |
| S2 | sec | CRIT | "WS accepts it read-only" names no enforcement point; deviceType is client-asserted | D-B0.3r2: handshake resolves token→socket.functions; gm:command gates on functions, never deviceType |
| S3 | sec | MAJ | v1 near-vacuous; restricted operator token unrestricted over WS (the kept all-or-nothing carve-out) | CARVE-OUT DELETED (convergent with D2): the function check runs at the commandExecutor choke point for ALL operator-token actors incl. WS; v1 operator grants are full, so live behavior is unchanged while the plumbing is real |
| S4 | sec | MAJ | aud decorative (jwt.verify lacks audience); the tool's proxy presents tokens cross-audience | D-B0.3r2: audience enforced per verify site; login mints a token PAIR (aud config-tool for the tool API; aud orchestrator for proxied calls) |
| S5 | sec | MAJ | Publish TOCTOU; no per-file sha1 re-verify; symlink smuggling via tree copy | D-B0.1r2 publish pipeline (merged with A3): freeze→rebuild manifest→gate→copy ONLY manifest-inventoried REGULAR files→recompute contentHash at target, refuse mismatch→one publish mutex |
| S6 | sec | MAJ | _readDiskManifest cache keyed mtime-only — "one authority" false under the seam | Fixed with A1's explicit-dir gate; the path-blind cache itself gets a red-first fix in BS.2 (pre-existing defect class) |
| S7 | sec | MAJ | Operator floor inherits fail-open via defaulted source param | D-B0.3r2: explicit actor argument, deny-by-default — no defaulted identity |
| S8 | sec | MIN | Reads open on loopback; rotation unowned | D-B0.3r2: enforce on ALL tool routes; header-only tokens; per-load short-TTL observe mint |
| A1 | arch | CRIT | Gate-reuse unspecified; in-process packService import drags logger/dotenv/winston into the tool (violates configManager.js:15-17) and _gateCheck lives in a stateful module | D-B0.1r2: EXTRACT the gate into a dependency-free module (`backend/src/services/pack/packGate.js` — fs/path/crypto only, the cueValidation/build-pack-manifest precedent); packService.activatePack becomes its stateful caller; config-tool imports the pure module with an explicit dir. Child-process runner named as fallback if extraction entangles |
| A1b | arch | CRIT | Path-blind manifest cache validates draft B against draft A's manifest | Folded into A1 (explicit dir; no shared cache in the pure gate) + the BS.2 cache fix |
| A2 | arch | CRIT | No conflict behavior: whole-tree copy silently reverts a Notion sync / other draft | D-B0.1r2: publish REFUSES when live contentHash ≠ draft base.contentHash (conflict = refuse; rebase/diff is the pages' job). Residual external-writer window narrowed by the mutex + hash check; noted honestly |
| A3 | arch | HIGH | Tree copy non-atomic; torn state = boot REFUSAL; drops writeScoring's rollback safeguard | D-B0.1r2: stage files as siblings, rename() in order with pack-manifest.json LAST — torn = stale-hash drift warn, never a refused boot |
| A4 | arch | HIGH | "Single activatePack() re-entry" is a false E10 promise — token values bake at load (tokenService) | Seam note corrected: E10 = re-activation + token re-bake; recorded for the pages unit |
| A5 | arch | MED | Hardcoded publish target vs ROADMAP §2.2 (engine resolves via PACK_PATH) | D-B0.1r2 (with D4): draft stamps {packId, sourcePath, contentHash}; publish targets the recorded source through the engine's resolver |
| A6 | arch | MED | env/routing cut points at nothing (§14.1) | Named home added (with D7): program C1 assigns network/env to the installation profile — absorption lands with C1/§13.7's profile-manager page |
| A7 | arch | MED | BS.1 enforcement 401s the tool's unauthenticated music proxy before BS.3's login exists | Stage plan r2: BS.1 builds substrate + gates tool-UNconsumed surfaces (admin routes, scoreboard token); the enforcement FLIP on tool-consumed routes lands WITH BS.3's login |
| D1 | doc | CRIT | Backend-served trigger/action vocabulary is B0 scope by program text — silently dropped | RESTORED: a contracted vocabulary endpoint (BS.1, backend) + the tool's editors re-sourced (BS.3); estimate grows accordingly |
| D2 | doc | MAJ | GM WS carve-out exceeds §13.6 without a ruling | Resolved by S3's fold — carve-out deleted, no ruling needed |
| D3 | doc | MAJ | Claims shape missing deviceId + packHash; grant formula risked skipping the O3 algebra | D-B0.3r2: full O3 shape {tier, class, deviceId, functions, packHash, aud, exp}; grants via packAssignment(class) ∩ tierCeiling(tier) (operator/staffed degenerate table); packHash pins stale-grant detection |
| D4 | doc | MAJ | §2.2 one-pack corner | Folded with A5 |
| D5 | doc | MAJ | Playwright deferral is a vague-phrase cut | Two Playwright smokes IN BS.3 (the pre-read's own enumeration) — cut withdrawn |
| D6 | doc | MAJ | HTTPS absent from the tool-auth design (decided Q2 posture) | D-B0.2r2: the tool serves HTTPS (self-signed, backend pattern) in BS.3 |
| D7 | doc | MIN | env/routing forward home | Folded with A6 (C1) |
| D8 | doc | MIN | Close gate under-enumerated | BS.4r2 enumerates: one-auth §5 proofs (suites-unchanged, floor-rejection + pack-switch contract tests), backend ratchet+lint, config-tool suite, scanner untouched-confirm, dual-pack Tier L |
| D9 | doc | MIN | Estimate divergence needs owner visibility | Carried in the owner batch below + STATUS note at ratification |
| D10 | doc | MIN | Unrecorded pre-read divergences (active-pack pointer; bundle export/import) | Recorded: the pointer died with A2 activation semantics; export/import = pack-manager page feature |

## 5. Design r2 — superseding decisions

**D-B0.1r2 (store/publish).** Draft stamp `{draftId, packId, sourcePath,
base: {contentHash}, created, lastEdited}` — publish resolves its
target from the recorded source through the engine's own path
resolution, never a hardcoded submodule path (§2.2). Publish pipeline,
under ONE tool-side mutex: (1) freeze the draft to a staging snapshot;
(2) rebuild the manifest in staging; (3) run the EXTRACTED
dependency-free gate (`packGate.validatePackDir(dir) → problems[]`)
against staging — refuse on any problem; (4) copy ONLY
manifest-inventoried regular files (symlinks and strays never travel)
by staging-as-siblings + ordered rename with `pack-manifest.json`
LAST; (5) re-read the landed tree and refuse/alarm on contentHash
mismatch; (6) append the publish log. Publish REFUSES when the live
target's contentHash no longer equals the draft's base (conflict =
refuse loudly; rebasing a draft is a pages-era feature). E10 seam note
(corrected per A4): a future hot-apply is re-activation PLUS token
re-bake — two named steps, recorded for the pages unit.

**D-B0.3r2 (auth).** Full O3 claim shape
`{tier, class, deviceId, functions, packHash, aud, exp}`; grants
computed at issuance via `packAssignment(class) ∩ tierCeiling(tier)`
(v1 table: operator/staffed = full ceiling; device/display = observe).
Verification REQUIRES tier + function + audience (jwt.verify with
`{audience}` per site); `requireAdmin` is absorbed into
`requireFunction` (legacy tokens without claims fail CLOSED). The
commandExecutor floor takes an EXPLICIT actor argument, deny-by-default,
and runs for ALL operator-token actors including the GM WS path (the
handshake resolves token→`socket.functions`; `gm:command` authorizes on
functions, never deviceType) — v1 operator grants are full-ceiling so
live behavior is unchanged while enforcement is real. The scoreboard
observe token: independent short-TTL store, minted per page load,
usable ONLY for the read-only WS handshake class — it passes no
requireFunction gate and never enters adminTokens. Tool login mints the
aud pair (config-tool / orchestrator-proxy). The backend-served
trigger/action VOCABULARY endpoint ships in BS.1 and the editors
re-source from it in BS.3 (D1 restored).

**D-B0.2r2 (shell/harness).** As r1 PLUS: the tool serves HTTPS
(self-signed, the backend pattern) and enforces auth on ALL routes
(header-borne tokens only); two Playwright smokes land in BS.3.

**Stage plan r2.** BS.1 backend substrate (claims+issuance, the pure
`packGate` extraction, requireFunction absorption, commandExecutor
actor floor, WS functions resolution, scoreboard observe token,
vocabulary endpoint) — gates only tool-unconsumed surfaces; BS.2 store
server-side (drafts, the publish pipeline, publish log, the two pack
writers re-pointed, the mtime-cache fix); BS.3 tool client (shell,
shared store, login+HTTPS, editors re-sourced to the vocabulary
endpoint, jsdom harness + 2 Playwright smokes, enforcement flip on
tool-consumed routes); BS.4 close (one-auth §5 proofs, ratchets, lint,
config-tool + scanner suites, dual-pack Tier L, adversarial review,
records).

**Estimate r2 (honest):** 3.5–5 sessions — above r1's 3–4 (D1
restoration + the S/A hardening), and well above the program's
1.5–2.5. Carried to the owner for sign-off, not squeezed.

## 6. Owner questions (grill batch — pending)
