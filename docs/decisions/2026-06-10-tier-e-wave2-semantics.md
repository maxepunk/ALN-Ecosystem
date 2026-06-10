# Decision Record: Tier E — Wave-2 Operational Semantics

**Date:** 2026-06-10
**Decided by:** owner (recommendations accepted except E3 override; E5 pending re-explanation)

| # | Decision | Notes |
|---|---|---|
| E1 | Cue restore after restart: **mark past clock cues as fired WITHOUT firing them** | Same policy will govern B11 phase transitions. Fixes F-SHOW-01/03 (persist `{firedClockCues, disabledCues, active}` beside `gameClock`) |
| E2 | 95% completion threshold is a **bug** → time-based margin (`duration − 1s`) | F-SHOW-04 |
| E3 | **OWNER OVERRIDE: restore to CAPTURED pre-duck volume**, not persisted setting. Rationale: GM adjusts volumes live during the game; the captured value is closest to current operator intent | Implementation requirement: capture must be robust — empty-array guard, and fallback to persisted user volume ONLY when capture is missing; the hardcoded-100 fallback dies either way (F-SHOW-05/27). If GM adjusts volume DURING a duck, define: adjustment updates the restore target (capture refreshed) |
| E4 | Cues **suspend at session:end**; GM can re-enable | F-SHOW-13 |
| E5 | **PENDING** — owner needs clearer explanation (see chat; gates only F-SHOW-12, a Phase-2 item) | |
| E6 | **Wire** `video:paused`/`video:resumed` into standing-cue evaluation | F-TOOL-09; also add the two missing music triggers to the editor (F-TOOL-32) |
| E7 | config-tool is **pre-show only** → bind localhost/document LAN posture; mask secrets in GET /api/config regardless | F-TOOL-02 |
| E8 | Sync failure posture: **abort-no-write-no-prune** on incomplete fetch; `--force` override; `--dry-run` default for prune | F-TOOL-01/07 |
| E9 | Game pack = **ALN-TokenData submodule, extended** | Phase 3 design doc elaborates; resolves Q-TOOL-4, F-TOOL-22 becomes a pack-commit flow |
| E10 | **Fix docs now** (restart required); reload-backend action lands with Phase 3 config-surface work | D1 doc drift |
| E11 | **Fold compare-tool checks into sync** as pre-write validation | F-TOOL-19 deleted/absorbed |
