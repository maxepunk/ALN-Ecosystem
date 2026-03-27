/**
 * service:state Push Integration Tests
 *
 * Verifies the unified service:state broadcast pattern:
 * Service event → broadcasts.js pushServiceState() → WebSocket 'service:state'
 * with { domain, state } envelope delivered to GM clients.
 */

require('../helpers/browser-mocks');

const { setupIntegrationTestServer, cleanupIntegrationTestServer } = require('../helpers/integration-test-server');
const { connectAndIdentify, waitForEvent } = require('../helpers/websocket-helpers');
const { resetAllServicesForTesting } = require('../helpers/service-reset');

// Service singletons
const sessionService = require('../../src/services/sessionService');
const stateService = require('../../src/services/stateService');
const transactionService = require('../../src/services/transactionService');
const videoQueueService = require('../../src/services/videoQueueService');
const offlineQueueService = require('../../src/services/offlineQueueService');
const bluetoothService = require('../../src/services/bluetoothService');
const audioRoutingService = require('../../src/services/audioRoutingService');
const lightingService = require('../../src/services/lightingService');
const vlcService = require('../../src/services/vlcMprisService');
const spotifyService = require('../../src/services/spotifyService');
const soundService = require('../../src/services/soundService');
const gameClockService = require('../../src/services/gameClockService');
const cueEngineService = require('../../src/services/cueEngineService');
const serviceHealthRegistry = require('../../src/services/serviceHealthRegistry');

describe('service:state Push Integration', () => {
  let testContext;
  let gm1;

  beforeAll(async () => {
    testContext = await setupIntegrationTestServer();
  });

  afterAll(async () => {
    await cleanupIntegrationTestServer(testContext);
  });

  beforeEach(async () => {
    await resetAllServicesForTesting(testContext.io, {
      sessionService,
      stateService,
      transactionService,
      videoQueueService,
      offlineQueueService,
      bluetoothService,
      audioRoutingService,
      lightingService,
      spotifyService,
      vlcService,
      gameClockService,
      soundService,
      cueEngineService,
    });

    // Mock BT to avoid shelling out
    jest.spyOn(bluetoothService, 'isAvailable').mockResolvedValue(false);
    jest.spyOn(bluetoothService, 'getPairedDevices').mockResolvedValue([]);
    jest.spyOn(bluetoothService, 'getConnectedDevices').mockResolvedValue([]);

    gm1 = await connectAndIdentify(testContext.socketUrl, 'gm', 'GM_STATE_001');
  });

  afterEach(() => {
    if (gm1?.connected) gm1.disconnect();
    gameClockService.reset();
    jest.restoreAllMocks();
  });

  describe('Spotify domain', () => {
    it('should emit service:state with domain spotify on playback:changed', async () => {
      const statePromise = waitForEvent(gm1, 'service:state',
        (data) => (data.data || data).domain === 'spotify');

      spotifyService.emit('playback:changed', { state: 'playing' });

      const event = await statePromise;
      const payload = event.data || event;
      expect(payload.domain).toBe('spotify');
      expect(payload.state).toHaveProperty('connected');
      expect(payload.state).toHaveProperty('state');
      expect(payload.state).toHaveProperty('volume');
      expect(payload.state).toHaveProperty('pausedByGameClock');
    });

    it('should emit service:state spotify on track:changed', async () => {
      const statePromise = waitForEvent(gm1, 'service:state',
        (data) => (data.data || data).domain === 'spotify');

      spotifyService.emit('track:changed', { title: 'Test', artist: 'Test' });

      const event = await statePromise;
      const payload = event.data || event;
      expect(payload.domain).toBe('spotify');
      expect(payload.state).toHaveProperty('connected');
      expect(payload.state).toHaveProperty('state');
    });
  });

  describe('Health domain', () => {
    it('should emit service:state with domain health on health:changed', async () => {
      const statePromise = waitForEvent(gm1, 'service:state',
        (data) => (data.data || data).domain === 'health');

      serviceHealthRegistry.report('vlc', 'down', 'Test disconnect');

      const event = await statePromise;
      const payload = event.data || event;
      expect(payload.domain).toBe('health');
      expect(payload.state).toHaveProperty('vlc');
      expect(payload.state.vlc.status).toBe('down');
    });
  });

  describe('Video domain', () => {
    it('should emit service:state with domain video on video lifecycle events', async () => {
      const statePromise = waitForEvent(gm1, 'service:state',
        (data) => (data.data || data).domain === 'video');

      videoQueueService.emit('video:loading', { tokenId: 'test-token' });

      const event = await statePromise;
      const payload = event.data || event;
      expect(payload.domain).toBe('video');
      expect(payload.state).toHaveProperty('status');
      expect(payload.state).toHaveProperty('queueLength');
      expect(payload.state).toHaveProperty('connected');
    });

    it('should emit service:state with domain video on queue events', async () => {
      const statePromise = waitForEvent(gm1, 'service:state',
        (data) => (data.data || data).domain === 'video');

      videoQueueService.emit('queue:added', { tokenId: 'test-token' });

      const event = await statePromise;
      const payload = event.data || event;
      expect(payload.domain).toBe('video');
      expect(payload.state).toHaveProperty('status');
    });
  });

  describe('Bluetooth domain', () => {
    it('should emit service:state with domain bluetooth on device:connected', async () => {
      const statePromise = waitForEvent(gm1, 'service:state',
        (data) => (data.data || data).domain === 'bluetooth');

      bluetoothService.emit('device:connected', {
        address: 'AA:BB:CC:DD:EE:FF', name: 'Speaker',
      });

      const event = await statePromise;
      const payload = event.data || event;
      expect(payload.domain).toBe('bluetooth');
      expect(payload.state).toHaveProperty('scanning');
      expect(payload.state).toHaveProperty('pairedDevices');
      expect(payload.state).toHaveProperty('connectedDevices');
    });
  });

  describe('Audio domain', () => {
    it('should emit service:state with domain audio on routing:changed', async () => {
      const statePromise = waitForEvent(gm1, 'service:state',
        (data) => (data.data || data).domain === 'audio');

      audioRoutingService.emit('routing:changed', { stream: 'video', sink: 'hdmi' });

      const event = await statePromise;
      const payload = event.data || event;
      expect(payload.domain).toBe('audio');
      expect(payload.state).toHaveProperty('routes');
      expect(payload.state).toHaveProperty('defaultSink');
    });
  });

  describe('Lighting domain', () => {
    it('should emit service:state with domain lighting on scene:activated', async () => {
      const statePromise = waitForEvent(gm1, 'service:state',
        (data) => (data.data || data).domain === 'lighting');

      lightingService.emit('scene:activated', { sceneId: 'scene.test' });

      const event = await statePromise;
      const payload = event.data || event;
      expect(payload.domain).toBe('lighting');
      expect(payload.state).toHaveProperty('connected');
      expect(payload.state).toHaveProperty('scenes');
    });
  });

  describe('Cue engine domain', () => {
    it('should emit service:state with domain cueengine on cue:fired', async () => {
      const statePromise = waitForEvent(gm1, 'service:state',
        (data) => (data.data || data).domain === 'cueengine');

      cueEngineService.emit('cue:fired', { cueId: 'test-cue' });

      const event = await statePromise;
      const payload = event.data || event;
      expect(payload.domain).toBe('cueengine');
      expect(payload.state).toHaveProperty('cues');
      expect(payload.state).toHaveProperty('activeCues');
    });
  });

  describe('Game clock domain', () => {
    it('should emit service:state with domain gameclock on gameclock:started', async () => {
      const statePromise = waitForEvent(gm1, 'service:state',
        (data) => (data.data || data).domain === 'gameclock');

      gameClockService.emit('gameclock:started', { elapsed: 0 });

      const event = await statePromise;
      const payload = event.data || event;
      expect(payload.domain).toBe('gameclock');
      expect(payload.state).toHaveProperty('status');
      expect(payload.state).toHaveProperty('elapsed');
    });
  });

  describe('Sound domain', () => {
    it('should emit service:state with domain sound on sound:started', async () => {
      const statePromise = waitForEvent(gm1, 'service:state',
        (data) => (data.data || data).domain === 'sound');

      soundService.emit('sound:started', { file: 'test.wav' });

      const event = await statePromise;
      const payload = event.data || event;
      expect(payload.domain).toBe('sound');
      expect(payload.state).toHaveProperty('playing');
    });
  });

  describe('Envelope shape', () => {
    it('should carry full state snapshot (not delta)', async () => {
      const statePromise = waitForEvent(gm1, 'service:state',
        (data) => (data.data || data).domain === 'health');

      // Report a status change (services are 'healthy' after reset, so report 'down')
      serviceHealthRegistry.report('vlc', 'down', 'Test disconnect');

      const event = await statePromise;
      const payload = event.data || event;

      // Full snapshot includes all 8 services, not just the one that changed
      expect(Object.keys(payload.state).length).toBeGreaterThanOrEqual(8);
      expect(payload.state).toHaveProperty('vlc');
      expect(payload.state).toHaveProperty('spotify');
    });

    it('should coalesce rapid changes into one push per domain (50ms debounce)', async () => {
      const events = [];
      gm1.on('service:state', (data) => {
        if ((data.data || data).domain === 'health') {
          events.push(data);
        }
      });

      // Fire 3 rapid health changes — all within the 50ms debounce window
      serviceHealthRegistry.report('vlc', 'down', 'Change 1');
      serviceHealthRegistry.report('spotify', 'down', 'Change 2');
      serviceHealthRegistry.report('sound', 'down', 'Change 3');

      // Wait for debounce to settle (50ms) + network round-trip
      await new Promise(resolve => setTimeout(resolve, 200));

      // Debounce coalesces bursts: exactly 1 push with the latest full snapshot
      expect(events.length).toBe(1);
      // The single push should contain full health snapshot with all 8 services
      const payload = (events[0].data || events[0]);
      expect(Object.keys(payload.state).length).toBeGreaterThanOrEqual(8);
    });
  });
});
