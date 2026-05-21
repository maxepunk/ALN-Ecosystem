# Changelog

Notable changes are recorded here. Format roughly follows
[Keep a Changelog](https://keepachangelog.com/). Dates are ISO-8601.

## [2026-05-21]

### Fixed
- **Music: state and track never updated after `loadPlaylist`.** The
  simplification commit `ad7d49b1` replaced
  `Promise.all([sendCommand('status'), sendCommand('currentsong')])` with
  `sendCommands(['status', 'currentsong'])` in
  `musicService._handlePlayerEvent`. But `mpd2@1.0.7`'s `sendCommands`
  wraps the list in `command_list_begin` (no separators) and returns a
  single concatenated **string** — not an array of per-command responses.
  The destructure `const [statusRaw, songRaw] = result` therefore sliced
  the first two characters ("v" and "o" from "volume: …\nstate: …" /
  "OK\n…"), `status.state` came back `undefined`, `newState` fell back to
  `'stopped'` and matched `this.state='stopped'`, so `playback:changed`
  never fired. MPD itself was playing fine — the orchestrator just never
  saw the state change. Reverted to `Promise.all`; mpd2 serializes via
  its internal `_promiseQueue` so it's still two sequential round-trips,
  just correct ones. Three idle-event unit tests were mocking the
  phantom-array `sendCommands` return, which masked the bug — updated
  them to mock per-call `sendCommand` strings.

## [2026-05-20] Music subsystem: Spotify → MPD

**Summary:** Replaced Spotify-driven background music with a local
MPD-driven music player. All Spotify code, tests, contracts, env vars,
and system-level packages removed.

### Added
- New `musicService` controls MPD over Unix socket via the `mpd2` Node
  client. ProcessMonitor supervises the MPD daemon (PID file at
  `/tmp/aln-pm-mpd.pid`).
- 9 new `music:*` gm:command actions (play / pause / stop / next /
  previous / setVolume / setShuffle / setLoop / loadPlaylist).
- HTTP routes: `GET /api/music/tracks`, `GET /api/music/playlists`,
  `PUT /api/music/playlists`.
- AsyncAPI: `service:state` `music` domain with `track`, `playlist`,
  `playlists[]`, `pausedByGameClock`.
- Config Tool: new "Music & Playlists" section with drag-and-drop
  playlist editor.
- `MusicController` + `MusicRenderer` in GM Scanner with playlist
  picker, transport controls, shuffle/loop, volume, queue counter
  ("Track X of Y"), and a client-side-extrapolated track progress bar.
- Bootstrap "All Tracks" playlist seeded with all 66 production MP3s
  (`backend/scripts/seed-music-playlist.js`, runnable via
  `npm run music:seed`).
- `audioRoutingService` ducks the `music` stream when video / sound
  plays (per `backend/config/environment/routing.json` rules).
- Cue engine routes `music:*` actions like any other command;
  `music:track:changed` event is normalized for cue conditions.
- 14 new music-specific integration tests + 1 contract test suite +
  3 E2E flows (07d-03 gated execution, 07d-04 ducking + cascading
  pause, 07d-05 admin playlist control).

### Removed
- `spotifyService.js` and all spotify wiring (sessionService cascade,
  cueEngineService, cueEngineWiring, broadcasts, syncHelpers, app,
  server, gmAuth, stateRoutes, audioRoutingService STREAM_APP_NAMES,
  serviceHealthRegistry KNOWN_SERVICES).
- All `spotify:*` gm:command actions and `service:state.spotify`
  contracts (asyncapi + openapi).
- `SPOTIFY_*` env vars from `.env.example` and `.env`.
- `SpotifyController.js`, `SpotifyRenderer.js`, and related styles +
  tests + state-store entries from the GM Scanner submodule.
- spotify entries from config-tool cue editor, timeline view, command
  form, audio section, and CSS.
- System-level `spotifyd` from this Pi: binary (`/usr/local/bin/spotifyd`),
  config (`~/.config/spotifyd/`), cache (`~/.cache/spotifyd/`), and
  systemd user unit. (Plaintext Spotify Premium credentials in the
  now-deleted spotifyd.conf should be rotated if reused elsewhere.)

### Changed
- `audioRoutingService.VALID_STREAMS` now `['video', 'music', 'sound']`
  (was `['video', 'spotify', 'music', 'sound']`).
- `serviceHealthRegistry` tracks 8 services (was 9 with spotify):
  `vlc`, `music`, `sound`, `bluetooth`, `audio`, `lighting`, `gameclock`,
  `cueengine`.
- `service:state` carries 10 domains: `music`, `video`, `health`,
  `bluetooth`, `audio`, `lighting`, `sound`, `gameclock`, `cueengine`,
  `held`.
- `sync:full` payload includes `music: {connected, state, volume, track,
  playlist, playlists, pausedByGameClock}`.
- `routing.json` ducking rules retarget `music` (was `spotify`):
  `video → duck music to 20%`, `sound → duck music to 40%`.
- `backend/.gitignore`: `backend/public/music/*.mp3` (protects 66
  production MP3s from accidental commit).

### Deployment notes
- `sudo apt install -y mpd`
- `sudo systemctl stop mpd && sudo systemctl disable mpd` (orchestrator
  spawns its own MPD via ProcessMonitor)
- `cd backend && npm install` (picks up mpd2)
- `cd backend && npm run music:seed` (regenerates All Tracks playlist
  whenever MP3 directory contents change)

### Documentation
- Full implementation plan:
  [`docs/superpowers/plans/2026-05-20-replace-spotify-with-mpd.md`](docs/superpowers/plans/2026-05-20-replace-spotify-with-mpd.md)
- Review audit trail:
  [`docs/reviews/2026-05-20-music-cutover-review.md`](docs/reviews/2026-05-20-music-cutover-review.md)
