# Current state — the living page

**What this is:** the owner's entry point. One short page, maintained
in place, updated whenever execution state changes: what's done,
what's next, and who each open item waits on. The full frame is
`ROADMAP.md` (r4); the deep archive is `PHASE3-STATUS.md`.

**Last updated: 2026-09-06** (fix-vehicle build S1–S3 landed: all 8
MAJORs fixed both repos; S4 close in progress).

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
| **Train fix vehicle** (all 8 MAJORs + ruled fix-now set; owner directive: no deferred MAJORs, every MINOR/NOTE intentionally dispositioned) | agent | estimate signed 2026-09-05; **S1–S3 BUILT** (execution record: `2026-09-05-train-fix-vehicle.md` §7): all 8 MAJORs fixed red-first — parent PR #34 (S1 commits + S3 icon gate/pin bump) + scanner PR #16 (S2, stacked on #15). S4 close remaining: full suites, fresh ratchets, dual-pack run, the §6 adversarial review workflow. Deferrals unchanged (named homes; ledger rows L15/L16) |
| Walk the merge train (20 vehicles, in order — fix vehicle last) | owner | waits on the fix vehicle; walk notes now beside the train table |
| **Deployment-docs repair** (Appendix C scope; includes boot-to-running posture) | agent | **AGENT HALF DONE 2026-09-05** (branch `claude/phase3-docs-repair`): env reference rebuilt from source (+2 template defects fixed), HA install procedure, installation-profile section, media-transfer procedure with runnable verification, machine prep + Pi-5 video settings, boot-to-running posture, cert-spike home, 4 wrong sections fixed (scoreboard auth ×3, spotifyd), Bluetooth contradiction removed |
| Capture the 7 lighting-scene definitions off the live machine (~20 min, read-only, borrow/restore rules) | owner | scheduled at the owner's pace — the guide's HA §3 carries the marked slot the captured YAML fills |
| Screen baselines from the pinned production release (Q8) | agent (priced at approval — no capture infra exists yet) | not started |
| Home hardware pass (Stage B) + certificate spike | owner + agent support | waits on the repaired docs and the green machine |

## Next blocks (in order)

1. **Block 2 — hardening** (dormant health word, supervisor, sticky
   dormancy, scanner self-heal, preflight in panel + CLI + human
   checklist with the honesty rule, host-config file). Re-priced at
   open.
2. **Block 3 — the truth sweep** (panel-drift audit + fixes on the
   rig; screen-capture tests join here). Priced after its census.
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
