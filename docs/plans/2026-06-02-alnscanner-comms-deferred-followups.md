# ALNScanner Comms-Fixes — Deferred Follow-ups

> Companion to `2026-05-28-alnscanner-comms-fixes-plan.md`. These are items
> surfaced by the per-sub-phase code reviews that were **deliberately deferred
> past plan completion**, judged item-by-item against the plan's intent AND the
> live-game functional impact (not just "does a later plan task own it").

**Triage rule applied:** an item is deferrable past the plan only if (a) no
remaining plan task owns it, AND (b) deferring it does not degrade the live-game
experience or undermine the plan's objectives (eliminate reconnect-churn,
lost-scan failure modes, contract/test drift, and surface operator errors).

## Resolved during execution (NOT deferred — listed for the record)
Items that a functional re-examination promoted from "defer" to "fix now":
- **B — `_scanningActive` not cleared on `finishTeam`** → FIXED (`a97c5b9`). Lost-scan-adjacent: NFC was left armed with no team selected → taps silently rejected. Not cosmetic.
- **R9 — SW served stale token data across deploys** → FIXED (`f755c6f`). R7 made the cache live; `tokenManager` fetches a same-origin non-hashed `tokens.json` that cache-first + a static cache name would serve stale forever. Switched the SW to network-first. **This also subsumes deferred item E** (a mid-session SW takeover can't serve stale content under network-first).
- **A — conformance test flat `readdirSync`** → FIXED (`77131a6`). Recursive scan so a future `src/admin/` subdir controller can't slip a non-contract action past the safety net. (Test hardening; no runtime impact.)

## Genuinely deferred past plan completion (none owned by a remaining task; zero live-game functional impact)

| ID | Item | Sev | File | Why safe to defer |
|----|------|-----|------|-------------------|
| C | `npm run test:build` runs two near-identical full Vite builds (`swArtifact.test.js` uses `build:backend`, `sw-artifact.test.js` uses `build`) | nit | `tests/build-artifacts/` | Test-infra speed only; no runtime path. Consolidate the two suites (or share one build) when convenient. |
| D | `vite.config.js` `emitServiceWorker()` reads `readFileSync('./sw.js')` (cwd-relative) | nit | `vite.config.js` | Works for all npm-script invocations (cwd is always `ALNScanner/`). Would only fail a build from a wrong cwd; harden with an `import.meta.url`-relative path. |
| F | SW offline-nav tertiary fallback `caches.match('./')` may not resolve for never-cached sub-paths | low | `sw.js` | The primary offline-nav path (`caches.match(request)`) works after R7/R9; the SPA only navigates to `/gm-scanner/`, so `./` is never the path that matters. |
| G | Lifecycle-test per-test-const-capture pattern is fragile if a future test in that describe reuses shared `let` mocks | low | `tests/unit/ui/connectionWizard.test.js` | Pattern works and is documented with an explanatory comment; risk is only to future test authors. |
| H | Reconnect `done()` tests use real ~1s timers (slow suite) instead of fake timers | low | `tests/unit/network/connectionManager.test.js` | Suite-speed only; deterministic (well within Jest's 5s). Convert to fake timers if suite time becomes a concern. |
| I | `NETWORKED_MODE_USER_FLOW.md` still documents the removed `lastStationNum` counter (P1c.3/RL-7 deleted it) | low | `ALNScanner/docs/NETWORKED_MODE_USER_FLOW.md:149,215` | Doc drift only; no runtime impact. Update to describe server-driven station assignment (query `/api/state` for the next gap) + the unreachable→block-with-error path. (Code fixed in `cd3df40`; the functional fix itself, R10/`56916d4`, also corrected the timeout message to match `TimeoutError`.) |

**Status:** revisit after the comms-fixes plan is fully implemented. None blocks any remaining phase (1c, 2, 3, 4a–4d).
