# Decision Record: Tier C/D — UX Scope & Operational Modes

**Date:** 2026-06-09
**Decided by:** owner, via discovery-report triage (mobile chunk 4)

## C1 — Admin domains: FOUR domains (Show Control added) — **CONFIRMED by owner**

Owner leaned "show control" and asked how it differs from Environment.
Proposed taxonomy (see chat explanation):
- **Game Ops** — scanning, transactions, scores, logged memories, duplicate handling
- **Show Control** — things you FIRE or RUN during the performance: cues,
  video playback + queue, display surfaces, one-shot sounds, music transport
  (play/pause/track), game clock & phases, held items
- **Environment** — venue steady-state you SET and leave: audio routing,
  per-stream volume, Bluetooth speaker pairing, lighting role→instrument
  mapping, service health of venue hardware
- **Game Admin** — pregame setup, session lifecycle, teams, postgame
  report/bundle, system reset
Rule of thumb: Environment = state of the room; Show Control = events in time.
Music sits in both: transport = Show Control, routing/volume = Environment.

## C2 — GM sound controls: YES; sound vs music layering documented

Build play/stop sound UI (minimum: stop button on the now-playing sound).
Functional model to encode in the design (owner asked for clarity):
- **Music** = continuous soundtrack layer (MPD): playlists, crossfade, loop —
  the bed that plays for minutes/hours.
- **Sound** = one-shot effects layer (pw-play): stings, alarms — seconds-long,
  fired by cues or (now) GM, layered OVER music.
- **Layering** = ducking engine: sound/video events duck the music bed per
  venue ducking rules (B7: venue config), restore on completion. Streams are
  independently routed/volumed (video/music/sound vocabulary, matrix 2.13).

## C3 — Bluetooth pairing: IN-UI (complete the implementation)

Backend `bluetoothService.getState()` gains `discoveredDevices`; renderer
shows scan results; wire the existing dead pair/unpair handlers.
(F-GMCMD-05 → fix, not remove.)

## C4 — Seek + standard-playback QoL: YES

Add `video:seek` / `music:seek` (contract-first: new gm:command actions),
draggable progress bars, and audit both panels against a standard media-player
baseline (F-GMCMD-21 + general QoL pass during UX redesign).

## C5 — Video picker + queue reorder: BUILD BOTH

`GET /api/videos` (contract-first) + populated datalist/picker (F-GMCMD-12);
queue reorder UI wired to existing `video:queue:reorder` (F-GMCMD-11).

## C6 — Player memory log: WEB NICETY (not part of role)

ESP32 stays log-free (F-PARITY-08 → wontfix for role; keep web's revisited
badge as web-specific polish; strip or keep vestigial `viewCollection()` at
implementer's discretion). Role spec records the deviation as intentional.

## C7 — Standalone reload: SUPPORTED recovery path

F-GMS-01 (P0) gets the full fix: restore path must initialize the storage
strategy, registries, and body class identically to fresh selection. The
certifying-the-bug unit test gets rewritten to assert the working behavior.

## D1 — Game Activity updates after batch drains: YES

After `/api/scan/batch` processing, push the drained scans to GM stations
(per-entry `player:scan` with `replayed: true` flag, or a sync:full —
implementation choice in fix design). Resolves the stale-Game-Activity half
of F-SCAN-05.

## D2 — Backend "offline mode": DELETE — **CONFIRMED by owner**

Verified during triage: **no production code ever sets the flag** — only
tests call `setOfflineStatus(true)`. The 202 "queued for processing" path,
the broken drain (F-SCAN-04), and the `ENABLE_OFFLINE_MODE` env flag are an
unreachable half-built feature. Scanners already handle backend-unreachable
with their own client-side queues, which is the architecturally correct
place. Recommendation: delete the backend offline-acceptance path + flag +
drain; keep `offlineQueueService`'s GM-transaction queue ONLY if it serves
the WebSocket reconnect path (verify during fix design).
