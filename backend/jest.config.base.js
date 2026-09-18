/**
 * Base Jest Configuration
 * Shared settings across all test types (unit, contract, integration)
 *
 * DO NOT run this directly - use jest.config.js or jest.integration.config.js
 */

const fsBase = require('fs');
const osBase = require('os');
const pathBase = require('path');

// Isolate ProcessMonitor PID files for this jest run.
//
// SAFETY-CRITICAL, not hygiene. Several suites (vlcMprisService,
// mprisPlayerBase, audioRouting, bluetooth) construct REAL ProcessMonitor
// instances, and ProcessMonitor.start() -> _killOrphan() reads the pidfile and
// SIGTERMs the pid inside it whenever /proc/<pid>/cmdline's argv[0] basename
// matches. With the default /tmp paths, that file belongs to whatever else is
// running on the box: on 2026-09-15 a unit run on the production Pi read
// /tmp/aln-pm-vlc.pid, killed the live show's VLC, and then overwrote the file
// with a mocked pid. Pointing the whole run at a private directory makes the
// unit suite structurally incapable of touching another process tree.
//
// Set here (not in a setup file) so it lands before ANY module loads and is
// inherited by every forked jest worker, matching how ENABLE_VIDEO_PLAYBACK and
// HOME_ASSISTANT_TOKEN are handled below. Removed in jest.globalTeardown.js.
// The scoreboard kiosk Chromium is a real browser on the real HDMI display.
// No unit, contract or integration assertion looks at it (the E2E flows 08 and
// 25 do, and the Playwright harness does not load this config), so keep the
// display driver inert under jest: no launch, no xdotool/wmctrl against the
// show display, ~5 s saved per file that re-inits display control.
if (!process.env.DISPLAY_DRIVER) {
  process.env.DISPLAY_DRIVER = 'off';
}

if (!process.env.ALN_PIDFILE_DIR) {
  process.env.ALN_PIDFILE_DIR = fsBase.mkdtempSync(pathBase.join(osBase.tmpdir(), 'aln-jest-'));
}

// Prevent unit/contract tests from spawning real VLC processes.
// Integration tests that need VLC should explicitly set ENABLE_VIDEO_PLAYBACK=true.
// config/index.js reads this at require time: videoPlayback = process.env.ENABLE_VIDEO_PLAYBACK !== 'false'
if (!process.env.ENABLE_VIDEO_PLAYBACK) {
  process.env.ENABLE_VIDEO_PLAYBACK = 'false';
}
// Prevent unit/contract tests from spawning real MPD processes.
// Integration tests that need MPD should explicitly set ENABLE_MUSIC_PLAYBACK=true.
if (!process.env.ENABLE_MUSIC_PLAYBACK) {
  process.env.ENABLE_MUSIC_PLAYBACK = 'false';
}
// Prevent jest-layer tests from opening real Home Assistant connections.
// backend/.env (a COMMITTED venue config) carries a live HA token, and
// dotenv.config() in src/config/index.js loads it in every test process. With
// a token present, performSystemReset's lightingService.init() attempts a
// doomed HA WebSocket in every integration beforeEach — and its ASYNC
// failure/reconnect events re-report lighting 'down', racing the test
// helper's post-reset healthy override (observed CI flake: lighting commands
// rejected by the SERVICE_DEPENDENCIES health gate on slow runners, while
// fast local runs win the race). Forcing the token empty makes init() and
// checkConnection() take their documented skip paths — no WS, no async
// reporters, the test override is authoritative. dotenv never overwrites
// existing env vars, so setting it here wins. Tier H E2E (real HA on the Pi)
// is Playwright-run and does not load this file.
process.env.HOME_ASSISTANT_TOKEN = '';
// Disable the audio-routing/ducking broadcast wires (src/websocket/broadcasts.js) in the
// jest layers. Those wires forward video/sound lifecycle events to
// audioRoutingService.handleDuckingEvent()/applyRouting(), which touch REAL pactl — unit/
// contract tests don't want the side effects, and integration tests that exercise ducking
// call audioRoutingService methods directly (see cue-engine, video-orchestration,
// service-state-push, audio-routing-phase3). E2E (the spawned real orchestrator) leaves
// this unset so the wiring runs end-to-end; production likewise. broadcasts.js reads
// `process.env.ENABLE_AUDIO_WIRES !== 'false'`. (Replaces a NODE_ENV=test gate that also
// wrongly disabled the wiring in E2E, since the E2E orchestrator runs NODE_ENV=test too.)
if (!process.env.ENABLE_AUDIO_WIRES) {
  process.env.ENABLE_AUDIO_WIRES = 'false';
}

module.exports = {
  // Test environment — node, plus a leaked-child check in its teardown().
  // Teardown runs after every hook a test file declared (including its own
  // root-level afterAll), which an afterAll in jest.setup.js cannot: circus runs
  // afterAll hooks in declaration order and setup files are declared first.
  // See tests/helpers/jest-environment-guarded.js.
  testEnvironment: '<rootDir>/tests/helpers/jest-environment-guarded.js',

  // Transformation
  transform: {
    '^.+\\.js$': 'babel-jest',
  },

  // Setup and teardown
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  globalTeardown: '<rootDir>/jest.globalTeardown.js',

  // Force exit after tests complete (required for Socket.IO and HTTP servers)
  forceExit: true,

  // Mock management
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,

  // Module management
  // CRITICAL: Do NOT reset modules - singleton services use explicit reset()/init()
  resetModules: false,

  // Ignore patterns
  // CRITICAL: Allow transformation of ALNScanner (which is outside root but imported)
  transformIgnorePatterns: [
    '/node_modules/(?!(@ALNScanner|ALNScanner)/)',
  ],

  // Coverage configuration
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/**/*.test.js',
    '!src/**/*.spec.js',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html', 'json'],
};
