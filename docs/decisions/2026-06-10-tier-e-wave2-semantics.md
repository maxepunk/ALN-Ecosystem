# Decision Record: Tier E — Wave-2 Operational Semantics

**Date:** 2026-06-10
**Decided by:** owner (recommendations accepted except E3 override; E5 pending re-explanation)

| # | Decision | Notes |
|---|---|---|
| E1 | Cue restore after restart: **mark past clock cues as fired WITHOUT firing them** | Same policy will govern B11 phase transitions. Fixes F-SHOW-01/03 (persist `{firedClockCues, disabledCues, active}` beside `gameClock`) |
| E2 | 95% completion threshold is a **bug** → time-based margin (`duration − 1s`) | F-SHOW-04 |
| E3 | **OWNER OVERRIDE: restore to CAPTURED pre-duck volume**, not persisted setting. Rationale: GM adjusts volumes live during the game; the captured value is closest to current operator intent | Implementation requirement: capture must be robust — empty-array guard, and fallback to persisted user volume ONLY when capture is missing; the hardcoded-100 fallback dies either way (F-SHOW-05/27). If GM adjusts volume DURING a duck, define: adjustment updates the restore target (capture refreshed) |
| E4 | Cues **suspend at session:end**; GM can re-enable | F-SHOW-13 |
| E5 | **DECIDED: continuous-elapsed, three-segment timeline model.** A compound cue's timeline is clock-driven, EXCEPT between "video actually starts" and "video ends," where it is video-driven — with elapsed time continuous across all three segments. Specifics: (1) cues with no video entry: pure clock-relative, unchanged; (2) entries before the video entry: clock-relative; (3) at the video boundary the timeline PAUSES until playback actually starts (load time never consumes timeline); (4) during video: entry `at` = video position; GM pause pauses pending entries; (5) after video completion (natural OR skip): clock-driven resumes seamlessly from the actual end — post-video entries fire relative to the real completion. Constraint (v1): one video entry per compound cue. Authoring aids: config-tool timeline renders the video block at true duration; optional `after: video, offset: N` anchor syntax deferred to the Phase 3 cue-authoring schema. "Do X when video ends" without choreography remains a standing cue on `video:completed`. | Fixes F-SHOW-12 (Phase 2); feeds matrix 2.22 cue-authoring contract |
| E6 | **Wire** `video:paused`/`video:resumed` into standing-cue evaluation | F-TOOL-09; also add the two missing music triggers to the editor (F-TOOL-32) |
| E7 | config-tool is **pre-show only** → bind localhost/document LAN posture; mask secrets in GET /api/config regardless | F-TOOL-02 |
| E8 | Sync failure posture: **abort-no-write-no-prune** on incomplete fetch; `--force` override; `--dry-run` default for prune | F-TOOL-01/07 |
| E9 | Game pack = **ALN-TokenData submodule, extended** | Phase 3 design doc elaborates; resolves Q-TOOL-4, F-TOOL-22 becomes a pack-commit flow |
| E10 | **Fix docs now** (restart required); reload-backend action lands with Phase 3 config-surface work | D1 doc drift |
| E11 | **Fold compare-tool checks into sync** as pre-write validation | F-TOOL-19 deleted/absorbed |
