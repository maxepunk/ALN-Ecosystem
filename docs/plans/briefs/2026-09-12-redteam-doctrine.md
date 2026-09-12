# Lens: doctrine faithfulness and cross-repo parity

Read /tmp/claude-0/-home-user/84692604-1422-5e48-a295-cc91e6bc4a0e/scratchpad/briefs/redteam-common.md first.

Attack the plan's faithfulness to what was ratified, and its two-sided parity:
1. Walk c2c3 §8 ruling by ruling (R-C2-1, R-C2-2, R-C3-1, R-C3-2, R-C3-3, the r3 additions, and
   the stage list CS.2–CS.5) and §5's adjudications (M1–M8, S1–S10). For each: is it implemented by
   a named task with a named test, deferred with a recorded reason, or silently missing? Table it.
2. Walk ROADMAP §4 "Block 2" deliverables (docs/plans/ROADMAP.md) the same way, including the
   honesty rule (Q13) and "a plain host-config file".
3. The plan's fifteen pins (§3): which are refinements the ratified text leaves open (allowed if
   argued), and which contradict it? Pay particular attention to P2 (dependent needs follow their
   family) against the CS.1 adjudication that an unbound role is FAULT, P3 (which cues are
   dormancy-disabled) against C1 §2 row 3 and the M5/S2 adjudications, P9 (a new service:state
   domain) against the C2 constraint "NO new discrete WS event", and P10 (display not a ninth
   service) against ROADMAP §5 "scoreboard liveness as a first-class check".
4. Parity surface: the health enum and the dormant semantics must read identically on the backend
   (registry, resolution.js, commandExecutor wording), the contracts, the GM scanner
   (HealthRenderer, capabilities.js), and the rung-1 audit (backend/tests/rung1/audit-flows.js).
   Name every consumer the plan misses (use the census §1 table as the checklist and grep to confirm).
5. Vocabulary: every term the plan uses that CONTEXT.md defines must match its definition; flag
   invented terms and any place the plan says "degraded", "expected", or "planning view" as if
   they were live states. Flag any plan text that should sharpen CONTEXT.md (a /domain-modeling
   candidate).
6. Estimate honesty (§7): compare the task list against the ratified 3.5–5 figure and the fix
   vehicle's §2.1/§2.2 additions (docs/plans/2026-09-05-train-fix-vehicle.md); is anything priced
   at zero?
7. DoD pins (§5): can each be executed on the rig or in CI as stated? Which need capabilities this
   container lacks (see /tmp/claude-0/-home-user/84692604-1422-5e48-a295-cc91e6bc4a0e/scratchpad/2026-09-12-container-baseline.md)?

Output file: /tmp/claude-0/-home-user/84692604-1422-5e48-a295-cc91e6bc4a0e/scratchpad/redteam-doctrine.md
