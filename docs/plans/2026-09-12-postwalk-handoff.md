# Post-walk handoff — the fresh session's entry point

**Written 2026-09-12, immediately after the merge train was walked.**
This document is the bridge between the session that walked the train
and the fresh session that (1) helps the owner set up the green Pi
(Stage B), then (2) implements Block 2 (hardening) and Block 3 (the
truth sweep). Owner-ruled 2026-09-12: that fresh session starts
immediately; the show-ready gate stands AS WRITTEN — green runs a
show only after Blocks 2 and 3 land.

## 0. Read these first, in order

1. `docs/agents/process.md` — the six continuity rules bind you.
2. Root `CONTEXT.md` — the ubiquitous language. §5b (production
   lifecycle) and §7 (process vocabulary) matter most this week.
3. `docs/plans/CURRENT-STATE.md` — one-page truth of where we are.
4. `docs/plans/ROADMAP.md` §3 (readiness ladder), §4 (Block 2 and
   Block 3 charters — your build scope), §6 (blue/green method,
   Stage B checklist, borrow/restore protocol, machine-state-not-
   in-git list), §10 (committed order, calendar anchor).
5. `docs/plans/PHASE3-STATUS.md` — "Merge train" section: the walked
   table, the walk runbook, and the walk close record (mechanism +
   verification). "Final cutover" section: the standing cutover list.
6. This document's §3 (blue containment) — NON-NEGOTIABLE rules.

## 1. State at handoff

- **The merge train is WALKED (2026-09-12).** All 22 PRs across five
  repos merged to `main`; zero open PRs remain. Mains: parent
  `df95b7a`, ALNScanner `5653a3e`, ALN-TokenData `d9e37be`,
  ALNPlayerScan `e0bf299`, arduino `f81aba5`. Every merged tree was
  verified byte-identical to its green PR head BEFORE pushing;
  every submodule pin verified an ancestor of its submodule's main.
  Mechanism note (record integrity): the walk executed as
  owner-authorized local merge commits pushed once per repo — not
  API merges — because the GitHub integration exhibited an
  all-day anomaly: READ calls succeeded, WRITE calls failed with a
  rate-limit error. If that persists, do PR/label/comment
  operations through the owner's browser, not the API.
- **Tip CI**: the parent push fired `test.yml` (full suites + both
  Tier-L legs) and `rung1.yml` on `main` — the ratified
  coherent-on-main condition. Verdict recorded in PHASE3-STATUS
  next to the train table. The ALNScanner push fired its test run
  and the "Sync & Deploy GM Scanner" Pages deploy (verify it
  succeeded; a failed deploy leaves gh-pages stale — re-run via
  workflow_dispatch).
- **Frozen production (blue) is intact and anchored**: branch
  `production-2026-07` + tag `blue-2026-07` in all five repos point
  at the identical frozen tips (parent `a4ebacd`). The full pin
  chain was verified reconstructable by fresh clone. Blue has NOT
  been touched.
- **Block 1 remainder**: the deployment-docs repair CONTENT is on
  `main` (vehicle #33) but the unit (task: Appendix C scope) closes
  only through Stage B — every gap the owner hits following the
  guide is a doc defect you fix same-day.

## 2. The calendar this week (owner-stated, non-negotiable facts)

- New token content lands ~Thursday 2026-09-17.
- The ALN run opens Friday 2026-09-18 and occupies Fri–Sun weekly
  through 10-18. Mondays–Thursdays are engineering windows.
- The show-ready gate (ROADMAP §3, ratified Q5) is unchanged:
  hardware-proven + Blocks 2 AND 3 landed + one Stage C venue
  rehearsal + the owner's Appendix B review. Green runs a show only
  past that gate. If the gate is not met by 9/18, the run opens on
  blue — see §3 for the ONLY safe way to update blue's tokens.

## 3. BLUE CONTAINMENT (read before ANY blue Pi work)

Blue (the production Pi, `production-2026-07`) runs the July system:
old token format (`SF_Group: "Name (xN)"`), old sync pipeline, docs
that describe a world that no longer exists upstream. After the
walk, TokenData `main` is v2 (pure group names + `game.json`
`groups`). The two formats MUST NEVER MIX:

- v2 data pulled INTO blue → blue's GM scanner silently scores every
  group at 1x (no error — the parser finds no "(xN)" and defaults).
- v1 data pushed onto TokenData `main` → the v2 activation gate
  refuses the pack; green and every walked consumer break loudly.

**The rules:**
1. Blue never reads from or writes to TokenData `main`. Ever.
2. Blue's on-board CLAUDE.md/docs are STALE where they say "push
   origin main", "pull first", or "run sync.py --deploy". A session
   started on blue must be handed this section as its prompt.
3. If blue MUST take a token update (run opening on blue): run the
   sync from blue's own checkout (its v1 pipeline), commit the
   result to a NEW branch `blue-2026-07-tokens` (never `main`),
   push only that branch, apply it locally on blue. QR/asset
   regeneration stays local to blue.
4. Never run the ALNPlayerScan "Sync & Deploy" workflow until the
   final-cutover list item 6 executes (it bumps the PWA's nested
   data pin to latest — deferred to cutover by ratified decision).
5. Rollback anchors: tag `blue-2026-07` in all five repos. A blue
   rollback after a green cutover carries STALE token content —
   the owner accepted this caveat knowingly.

## 4. Green Pi setup (Stage B — you guide, the owner drives)

Follow `DEPLOYMENT_GUIDE.md` on `main` EXACTLY — finding its gaps
is part of the work (doc defects; fix and commit same-day; this
closes the docs-repair unit). Key knowledge that cost real effort:

- **Machine state not in git** (ROADMAP §6 list): OS, process
  supervisor, WirePlumber drop-in, SSL certs, `.env`, the Home
  Assistant Docker volume (scene definitions live ONLY there — the
  Q9 owner task), media files (videos, music, audio).
- **New env vars since July** (all have production-sane defaults;
  reconcile against `backend/.env.example`): `VLC_SELF_SPAWN`,
  `PACK_PATH`, `PROFILE_PATH`, `IDLE_LOOP_FILE`, `CHROMIUM_BIN`,
  `SCOREBOARD_WINDOW_MARKER`. `VLC_SELF_SPAWN` default (true) is
  the production posture — the false setting is for supervised
  harnesses like the rung-1 rig.
- **The Stage B pass list** (ROADMAP §6): real HEVC decode + video
  out, audio routing + ducking on a real BT speaker, HA scenes on a
  HOME-OWNED bulb (venue bulbs are RISKY per the borrow protocol),
  NFC over HTTPS on the tablet, full ESP32 asset sync, on-device
  pack activation, the hand-run preflight. Cert spike S2 during
  setup.
- **ESP32 firmware**: arduino PR #7 (merged) added pack-identity
  reporting — purely additive, safe against old AND new backends.
  Flashing is optional for function but REQUIRED for the
  "every consumer reports its pack identity" preflight check. No
  OTA exists: USB + arduino-cli per device. Flash during Stage B.
  First asset sync takes 5–15 min/device — never on a show day.
- **A practice v2 token sync** belongs in Stage B: dummy edit →
  `scripts/sync_notion_to_tokens.py` path → pack manifest rebuild →
  every consumer's reported packHash matches. This rehearses
  Thursday.

## 5. Blocks 2 and 3 (your build, immediately after Stage B starts)

Charters: ROADMAP §4 ("Block 2 — the hardening block", "Block 3 —
the truth sweep"). Binding mechanics:

- Block 2 remainder ≈3.5–5 sessions of the ratified whole-unit
  figure; RE-PRICE AT BLOCK OPEN (recorded requirement). Stages
  were CS.2–CS.5: dormancy; supervisor; preflight; close.
- Ordering (ratified Q2): Block 3 runs AFTER Block 2's health-
  vocabulary change so the sweep pins the final words.
- The preflight honesty rule (ratified Q13): paper-vs-live verdict
  labels on every check.
- Block 3 scope brake: store-fed path only; the three transaction-
  path renderers are OUT (dependency audit claim 4). Price on the
  5 reshaping adapters + 10 restore guards, not the domain count.
  The 5 recorded desync bugs: re-test, do not re-derive.
- House DoD applies: red-first tests, adversarial review with
  refuters, dual-pack Tier L legs, execution records, ledger rows
  for any temporary construct.
- Supervisor soak guidance (this session's analysis, owner-aware):
  landing new intervention logic days before a live show puts its
  first live hours inside the show. If Block 2 completes close to
  9/18, consider the host-config restart-strategy file as the
  off-by-default switch and flip it after real soak — the gate
  requires the block LANDED; how it's configured for night one is
  an operational call the owner makes at preflight.

## 6. Loose ends inherited by this handoff

1. **Tip CI verdict** — recorded in PHASE3-STATUS by the walking
   session if it completed; verify green before anything else.
2. **Branch cleanup** — the merged `claude/phase3-*` train branches
   (enumerated in the walk runbook) can be deleted; NEVER touch
   `production-2026-07` or the `blue-2026-07` tags. Deletion is
   deliberately deferred; nothing depends on it.
3. **Docs-repair unit close** (task #34) — closes via Stage B.
4. **GitHub API write anomaly** — see §1; diagnose or route around.
5. **The whole-train-review session** (`session_01ND6rEhUqjKfdXCmeKXJDpo`)
   sits BLOCKED awaiting a push go-ahead for its evidence bundle;
   its findings are already recorded in the fix-vehicle triage doc.
   Archive it when convenient.
6. **The stale top-level clones** `/home/user/ALNScanner` and
   `/home/user/ALN-TokenData` (this container only) mislead
   sessions — prefer the submodule paths under ALN-Ecosystem.

## 7. Container-only assets audit (2026-09-12, post-walk)

What a fresh clone does and does not inherit, checked file-by-file:

- **Everything process-critical is tracked**: all of `.claude/`
  (skills, agents, the session-start hook, settings INCLUDING
  settings.local.json), every `docs/plans/` document, the design
  system HTML. Plugin skills (mattpocock-skills, anthropic-skills)
  and the esp32-skill (tracked in the arduino repo) arrive via the
  owner's account/plugin config, independent of any clone. The
  global git hooks (`stop-hook-git-check.sh`,
  `session-start-git-identity.sh`) are CCR launcher-provisioned —
  fresh remote sessions get them automatically.
- **Deliberately gitignored, regenerable, documented**:
  `backend/.env` (env template + deployment guide), `ALNScanner/
  dist` (`npm run build`), logs, node_modules, the rung-1 runtime
  state under `/tmp/rung1` and the witness HA container
  (provisionForRun rebuilds all of it from nothing — that is what
  S5b proved).
- **Genuinely lost with this container, conclusions preserved**:
  the walking session's workflow journals and scratchpad (raw
  adversarial-review outputs — every surviving finding and verdict
  is in the execution records), the harness task list (state lives
  in CURRENT-STATE + this doc), and the whole-train-review
  session's unpushed evidence bundle (§6 item 5).
- **The three PS1 design mock PNGs**
  (`docs/design/pages/ps1/ps1-variant-{A,B,C}.png`) are gitignored
  by rule (`.gitignore:67`, `docs/design/pages/**/*.png`) while the
  tracked `candidates.html` references them — a fresh clone renders
  that page with broken images. They are regenerable by
  screenshotting the tracked HTML (webapp-testing skill); the
  Block-5 pages work should either commit its chosen-variant
  renders (small, stable artifacts — the iteration-bloat rationale
  for the ignore rule no longer applies to FINAL picks) or make
  candidates.html self-contained. Decision belongs to the pages
  unit; recorded here so it isn't rediscovered.
- **CONTEXT-MAP.md was a dead reference** (cited by CLAUDE.md and
  domain.md, never created) — a stub now exists at the repo root.
