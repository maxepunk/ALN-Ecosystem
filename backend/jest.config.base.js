/**
 * Base Jest Configuration
 * Shared settings across all test types (unit, contract, integration)
 *
 * DO NOT run this directly - use jest.config.js or jest.integration.config.js
 */

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
  // Test environment
  testEnvironment: 'node',

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
