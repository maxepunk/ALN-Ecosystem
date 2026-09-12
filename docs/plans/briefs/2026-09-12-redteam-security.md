# Lens: security, authorization, and host boundaries

Read /tmp/claude-0/-home-user/84692604-1422-5e48-a295-cc91e6bc4a0e/scratchpad/briefs/redteam-common.md first.

Attack these mechanisms in the plan (§3 pins P7, P11, P12, P14, P15 and tasks T1a, T3, T3b, T4, T5):
1. The verbs as commands (P12): `service:restart`, `service:out-of-service`, `service:in-service`,
   `preflight:run` against the operator floor in backend/src/services/commandExecutor.js
   (requiredFloorFunction, CUE_ACTIONS guard at dispatch) and backend/src/gameRules/grants.js.
   Which floor function should each carry? Can a cue (pack content) reach any of them? Can an
   observe-token socket? Trace backend/src/websocket/adminEvents.js handleGmCommand.
2. The typed override (P7): what stops a cue or a non-operator from starting a NO-GO session?
   Is the override logged with actor identity? Is `reason` sanitized before it reaches
   session.metadata (the slice-7 sanitizer class: pipes, control characters)?
3. Host config (P11): the HOST_CONFIG_PATH seam vs PACK_PATH/PROFILE_PATH precedents
   (backend/src/services/profileService.js, packService getPackDir); what a hostile or malformed
   host.json can do (numbers out of range, negative delays, huge maxFailures); whether the
   config-tool's Venue side (config-tool/lib/configManager.js) would need to know about it.
4. Self-heal (P14): a mismatched server could push ANY pack — the scanner re-applies scoring and
   strings from it. Is the server already trusted for this (packLoader network tier)? Does the heal
   introduce a new trust edge (e.g., a rogue orchestrator on the same LAN)? What about the
   sha1-verified staging: does `refresh()` keep it?
5. The read-plane gate (P15): the Q5 fact check found every client already presents a credential.
   Confirm from backend/src/websocket/socketServer.js and server.js `sync:request`; state precisely
   what the gate must and must not change for the scoreboard's observe socket and the E2E/rung-1
   clients. Any deviceId collision or `deviceTracking` side effect?
6. The preflight arms (P8, T4): host arm (disk, temperature, load, ports, PID files) and network arm
   (DNS lookup, gateway reachability) — what shells out, what could hang the event loop, what leaks
   (the CLI prints host facts; does the service:state push expose anything a display-class socket
   should not see?).
7. Contract-first (P9, T1a): the new `DomainStatePreflight`, `sync:full.preflight`/`.profile`, the
   `door` field, the enum change — check each against backend/contracts/asyncapi.yaml and
   openapi.yaml conventions and the sync-full-completeness contract test
   (backend/tests/contract/websocket/sync-full-completeness.test.js): what must change for it to
   stay honest?

Output file: /tmp/claude-0/-home-user/84692604-1422-5e48-a295-cc91e6bc4a0e/scratchpad/redteam-security.md
