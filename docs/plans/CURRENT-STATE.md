# Current state — the living page

**What this is:** the owner's entry point. One short page, maintained
in place, updated whenever execution state changes: what's done,
what's next, and who each open item waits on. The full frame is
`ROADMAP.md` (r4); the deep archive is `PHASE3-STATUS.md`.

**THE GOAL THIS WEEK (owner, stated the night of 2026-09-11, recorded
2026-09-12 after it was lost at a compaction):** implement Blocks 2 and
3, set up the green Pi, and test it before Thursday 2026-09-17, so that
green, not blue, ideally runs the show on Friday 2026-09-18. Reason:
syncing new tokens onto blue as it stands carries more risk than
bringing green up. Either way, new tokens must be synced from Notion by
Thursday. Every plan and every priority call below serves this goal;
where a document says the run opens on blue unless the gate is met,
that is the fallback, not the plan.

**HOW THE VENUE RUNS TODAY (owner, 2026-09-12):** the GM tablets reach
the orchestrator at the fixed address 192.168.0.191 on the kit WiFi,
with the browser's certificate warning accepted once per tablet. Player
phones are not used; the only player scanners are the ESP32 devices.
There are no QR codes. The NFC tags carry a plain token id plus an IP
address, and the address is not used in the game as run so far. DNS,
removing the certificate warning, and non-Android player phones are
planned quality-of-life work, not a priority before this run.
The audio outputs are HDMI (the monitor's speakers) AND a W-KING X10
Bluetooth speaker. Two GM tablets, three ESP32 scanners; the scanners
WILL be flashed with the new firmware this week. The home setup starts
Saturday or Monday, at the owner's call, depending on where the
implementation stands. Thursday's token sync is run by a Claude session
ON the Pi (green if it is ready, else blue) with the repository's sync
script, which also generates the images; a session on blue works under
the containment rules, which is why staying on blue carries risk. A
venue rehearsal before Friday is the owner's call, not assumed either
way. The fact sheet of that sync workflow, from the code, is
`.superpowers/sdd/2026-09-12-block2-hardening-plan/token-sync-workflow.md`
when written.

**RESUME HERE (2026-09-12, Block 2 at checkpoint 2, "after the dormancy
core lands"; T1a's follow-ups closed).** T1b, T1a and T1a's three
follow-ups (CI kiosk launch, scanner review-bot fixes, display exit
semantics — plan §9, rulings 25–28) are reviewed, merged and pushed on
the designated branch `claude/nice-curie-hescfv` (parent `fb2c29c` plus
this records commit; ALNScanner `e83723c`; ALN-TokenData `6f9bc30`);
draft PRs: ALN-Ecosystem #35, ALN-TokenData #8, ALNScanner #17. What the
GM has now: the three health words with dormant grey and its door, the
display as the ninth service (a crashed kiosk reads red), cues silenced
by absent equipment, the session-start require gate with the typed
override, the preflight stamp, the profile identity in `sync:full` and
`/health`. CI: green on the designated branch — Test run 300 on `fb2c29c`
10/10 (all four Tier L legs, integration, unit + contract, scanners,
scripts, ESP32) and Rung-1 run 18; T1a's CI is closed. Run 299 had one
red Tier L leg from a pre-existing harness race (a parallel worker wipes
the shared `backend/data/` during a restart test — home T7a, plan §9);
it did not recur on run 300. Records: plan §9 (execution
record through the follow-ups), the ledger at
`.superpowers/sdd/2026-09-12-block2-hardening-plan/progress.md` (rulings
1–28, deferred minors), briefs under `docs/plans/briefs/`. **Owner
decision pending (checkpoint 2):** continue into round 3 (T3b → T3 ‖ T5
→ T4, per ruling 6), stop here as "Block 2a" and turn to the green
machine, or change the order; and whether T7a's rig hygiene (the data
directory and log directory per worker) moves ahead of round 3. No
agents are running. The rung-1 rig is provisioned in this container
(recipe in `2026-09-12-container-baseline.md` §7); a container restart
loses it. Blue containment rules (handoff §3) stand.

**Last updated: 2026-09-12 — THE MERGE TRAIN IS WALKED.** All 22
PRs merged across the five repos; `main` is the deployable truth
(parent `df95b7a`); zero open PRs; frozen production stays anchored
at `production-2026-07` / tag `blue-2026-07`. Coherent-on-main
pends only the tip CI verdict (recorded in PHASE3-STATUS beside the
train table). **A fresh session picks up from here** — its entry
point is `docs/plans/2026-09-12-postwalk-handoff.md` (owner-ruled
2026-09-12): guide the green Pi Stage B setup, then build Block 2
(hardening) and Block 3 (truth sweep); the show-ready gate stands
AS WRITTEN — green runs a show only after Blocks 2+3. Calendar:
token content ~Thu 9/17; the run opens Fri 9/18 (on blue unless the
gate is met; blue token updates ONLY via the containment rules in
the handoff §3).

## Where we stand

- **Roadmap r4 is ratified.** Five readiness states (coherent on main
  → hardware-proven → show-ready → previewable → adoptable), seven
  value-ordered blocks, the five show-night pains driving the order.
  The grill record: `2026-09-04-roadmap-r4-draft.md`.
- **`main` is still the July production release.** Everything built
  since lives on the chained branches, recorded as the merge train
  (18 vehicles, PR #32 last). Production is frozen until the owner's
  show-ready decision.
- **Built and closed so far** (the archive has the records): the
  whole pack spine — extraction slices 0–7 plus closers and theme —
  the tooling foundation (store, auth, shell), and the resolution
  core with its zero-mock hardware rig (CS.1).
- **The run:** weekly ALN shows 2026-09-18 → 10-18 on the pinned
  production system. Mondays–Thursdays are the only swap windows; any
  swap must meet the show-ready gate and is the owner's call.

## Block 1 — the unlock block (ACTIVE)

| Item | Who | State |
|---|---|---|
| Whole-train review (full combined diff, fresh-context session) | agent (separate session) | **DONE 2026-09-05** — verdict: walk-with-fixes. Report: `2026-09-05-whole-train-review.md` (branch `claude/whole-train-review`). 8 MAJORs survive; Appendix-B item 5 CLEARED; the "watch it" vehicle confirmed green |
| **Train fix vehicle** (all 8 MAJORs + ruled fix-now set; owner directive: no deferred MAJORs, every MINOR/NOTE intentionally dispositioned) | agent | estimate signed 2026-09-05; **S1–S4 BUILT + reviewed** (execution record: `2026-09-05-train-fix-vehicle.md` §7): all 8 MAJORs fixed red-first; §6 adversarial review ran (15 agents) — 6 survivors, 5 fixed, 1 deferred (B5); dual-pack E2E diagnosed to root cause — the video-alert tests had NEVER actually run (vacuous pass on a missing fixture) and VLC-down here is an E2E bring-up FAULT (this container is a rung-1 host); harness fixed (loud gates), and a hand-run rung-1 validation put real VLC under the video tests for the first time: they PASS. PRs: parent #34 + scanner #16 + TokenData #7. **S5b CLOSED 2026-09-06 — vehicle COMPLETE** (owner-ruled: "a faulty E2E suite IS a bug"): ONE shared provisioning module (`backend/tests/rung1/provision.js`) serves the rig and the E2E suite, gated by the run's PROFILE (a real venue profile provisions nothing — venue safety by construction); every worker gets a private session bus; the witness HA + Bluetooth mock + real VLC now stand under the full legs. First-ever-executing paths surfaced and fixed 3 engine defects (VLC supervision adopt-mode, MPRIS transition-merge swallow, order-dependent witness register) and 1 test defect (the toy lighting flow read a state key that never existed — its D-4.8 end-to-end proof now actually runs and passes). Final legs: ALN 126 passed/2 failed→fixed, toy 122/2→fixed; close review 17 findings all dispositioned (10 fixed, 1 refuted, 6 accepted/corrected). Execution record: `2026-09-05-train-fix-vehicle.md` §8.2 |
| Walk the merge train (20 vehicles, in order — fix vehicle last) | owner | **READY** — the fix vehicle is complete (parent PR #34, scanner #16, TokenData #7); walk notes beside the train table |
| **Deployment-docs repair** (Appendix C scope; includes boot-to-running posture) | agent | **AGENT HALF DONE 2026-09-05** (branch `claude/phase3-docs-repair`): env reference rebuilt from source (+2 template defects fixed), HA install procedure, installation-profile section, media-transfer procedure with runnable verification, machine prep + Pi-5 video settings, boot-to-running posture, cert-spike home, 4 wrong sections fixed (scoreboard auth ×3, spotifyd), Bluetooth contradiction removed |
| Capture the 7 lighting-scene definitions off the live machine (~20 min, read-only, borrow/restore rules) | owner | scheduled at the owner's pace — the guide's HA §3 carries the marked slot the captured YAML fills |
| Screen baselines from the pinned production release (Q8) | agent (priced at approval — no capture infra exists yet) | not started |
| Home hardware pass (Stage B) + certificate spike | owner + agent support | waits on the repaired docs and the green machine |

## Next blocks (in order)

1. **Block 2 — hardening** (dormant health word, supervisor, sticky
   dormancy, scanner self-heal, preflight in panel + CLI + human
   checklist with the honesty rule, host-config file). **OPEN
   2026-09-12:** plan red-teamed and ruled (see RESUME HERE above);
   no time pricing — the owner decides at the plan's §8 checkpoints.
2. **Block 3 — the truth sweep** (panel-drift audit + fixes on the
   rig; screen-capture tests join here). Census done 2026-09-12
   (`2026-09-12-block3-truth-sweep-census.md`); design and red team
   follow Block 2's checkpoint 2.
3. **Blocks 4/5 order decided after the capture block is wireframed
   and priced** (Q3). Capture wireframes can start any time.
4. **Block 5 — preview** also opens the GM-scanner redesign's design
   work; the UX foundation's remaining grill questions (nav words'
   second half, Rehearse's shape, Review v1, the new-pack threshold,
   three map rows) shape its final cut.

## Standing items

- **Secrets rotation** (HA token + admin password) — before
  previewable, at latest (Q12). Owner action, any time.
- **The second game's design track** — open now, owner-paced, no
  engine dependency.
- **Frozen production** — no live-machine deployments until the
  show-ready decision; merges only via the owner-walked train.
