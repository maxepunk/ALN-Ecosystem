# Follow-up: system-reset-regression CI-only test-isolation bug

**Status:** Resolved (root-caused + un-quarantined 2026-06-04, commit `1cd13f95`; tests now run live in `system-reset-regression.test.js`)
**Owner:** unassigned
**Severity:** Low (test-harness only — NOT a production / system:reset bug)

## Symptom

On the **ubuntu** CI runner, `tests/integration/system-reset-regression.test.js ›
Reset State Verification › should fully reset all service state` fails with:

```
TypeError: targetService.on is not a function
    at ListenerRegistry.addTrackedListener (src/websocket/listenerRegistry.js:110)
    at SessionService.setupScoreListeners (src/services/sessionService.js:38)
    at setupScoreListeners (src/services/systemReset.js:166)
    at handleGmCommand (src/websocket/adminEvents.js)
```

i.e. during the post-reset re-wiring, the shared `transactionService` singleton
has lost its EventEmitter `.on` method.

## What we know

- **Pre-existing, not caused by the comms-fix branch.** It was masked on `main`
  for ~2 weeks behind the `navigator is not defined` integration crash. Fixing
  navigator (PR #16) let these suites run to completion and unmasked it.
- **The reset logic is sound.** The suite passes **in isolation** (4/4) and the
  three other tests in it always pass. This is a cross-suite contamination of the
  shared `transactionService` singleton, not a `system:reset` defect.
- **ubuntu-CI-specific.** It cannot be reproduced on the Pi — not even forcing the
  exact CI suite order via a custom Jest `testSequencer`. The most plausible cause:
  the Pi **has** `bluetoothctl` / `dbus` / `pactl`, while the ubuntu runner does
  **not**, so some earlier suite (a service that shells out to those tools) takes a
  different *error/teardown* code path on ubuntu and leaves shared state corrupted.
  The CI integration log is also flooded with leaked `serviceHealthRegistry.js:125`
  revalidation-timer-after-teardown warnings, a corroborating isolation smell.
- Only **1 of 337** integration tests fails on CI; everything else is green.

## Current mitigation

`should fully reset all service state` is skipped **on CI only**
(`process.env.CI ? it.skip : it`) so it still runs locally (where it is correct and
passes) and still guards against real reset regressions during development. See the
comment block on the test.

## How to get a real fix

1. **Reproduce in a toolless ubuntu container** (the Pi can't reproduce it):
   ```bash
   # Node 22 ubuntu WITHOUT bluetoothctl/dbus/pactl, mimicking the CI runner
   docker run --rm -v "$PWD":/app -w /app/backend node:22-bookworm-slim \
     bash -lc "npm ci && CI=true npm run test:integration"
   ```
   Expect the same failure. Then bisect the suite list (drop the second half,
   then the first half) to find the **contaminating** suite that runs before
   `system-reset-regression`.
2. **Find what strips `transactionService.on`.** Candidates: a suite whose
   `afterEach`/`afterAll` cleanup throws on ubuntu (missing CLI tool) and skips a
   service `reset()`/listener-restore; or a leaked revalidation/health timer firing
   mid-reset. Add the missing teardown / make it tool-absence-tolerant.
3. **Harden the harness** so a single suite's incomplete teardown can't corrupt the
   shared singletons for later suites (e.g. assert/repair EventEmitter-ness in
   `resetAllServicesForTesting`, or stop leaked timers between files).
4. Remove the CI quarantine once the above is in place.

## Related

- `tests/helpers/service-reset.js` (`resetAllServicesForTesting`, `stopRevalidation`)
- `src/services/systemReset.js`, `src/services/sessionService.js` (`setupScoreListeners`)
- `src/services/serviceHealthRegistry.js` (`startRevalidation`/`stopRevalidation`)

## RESOLVED (2026-06-11)

Root cause found — it was NOT cross-suite singleton corruption. Within
system-reset-regression.test.js itself, the "rapid consecutive resets"
test used a fixed 500ms sleep that is shorter than a real reset on
toolless environments (~1.2s, dominated by the displayDriver Chromium
respawn timeout). Its reset was still IN FLIGHT when the next test
("should fully reset all service state") fired its own reset — which the
adminEvents mutex correctly rejected with `{success: false}`. That test
never asserted its ack, so the failure surfaced downstream as "session
not cleared". On the Pi, resets complete inside 500ms, hence
"passes locally". The reset logic itself was always sound.

Fix: the rapid test now waits for the actual success ack (predicate on
`gm:command:ack`), and the state-verification test asserts its ack
succeeded. Quarantine removed; the file passes deterministically in
toolless environments at original timings.
