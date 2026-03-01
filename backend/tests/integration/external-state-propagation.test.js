/**
 * External State Propagation Integration Tests
 *
 * Verifies the full event chain: service emits domain event →
 * broadcasts.js forwards via service:state → connected GM client receives event.
 *
 * These tests exercise Layers 2-4 of the event pipeline:
 *   Layer 2: Service EventEmitter emission
 *   Layer 3: broadcasts.js listener → service:state WebSocket broadcast
 *   Layer 4: Socket.IO delivery to GM client
 *
 * Layer 1 (external monitor parsing) is unit-tested per service.
 *
 * Pattern: emit directly on service singletons (simulating what monitors do),
 * verify the GM client receives service:state with the correct domain and state.
 */

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
const serviceHealthRegistry = require('../../src/services/serviceHealthRegistry');

/** Helper: wait for service:state with a specific domain */
function waitForServiceState(socket, domain) {
  return waitForEvent(socket, 'service:state', (data) => {
    const payload = data.data || data;
    return payload.domain === domain;
  });
}

describe('External State Propagation', () => {
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
    });

    // Mock BT to avoid shelling out to bluetoothctl
    jest.spyOn(bluetoothService, 'isAvailable').mockResolvedValue(false);
    jest.spyOn(bluetoothService, 'getPairedDevices').mockResolvedValue([]);
    jest.spyOn(bluetoothService, 'getConnectedDevices').mockResolvedValue([]);

    // Connect a GM client
    gm1 = await connectAndIdentify(testContext.socketUrl, 'gm', 'GM_PROP_001');
  });

  afterEach(() => {
    if (gm1?.connected) gm1.disconnect();
    jest.restoreAllMocks();
  });

  // ── Bluetooth ──

  describe('Bluetooth', () => {
    it('should push service:state bluetooth when speaker auto-connects', async () => {
      const eventPromise = waitForServiceState(gm1, 'bluetooth');

      bluetoothService.emit('device:connected', {
        address: 'AA:BB:CC:DD:EE:FF',
        name: 'JBL Flip 6',
      });

      const data = await eventPromise;
      const payload = data.data || data;
      expect(payload.domain).toBe('bluetooth');
      expect(payload.state).toBeDefined();
    });

    it('should push service:state bluetooth when speaker disconnects', async () => {
      const eventPromise = waitForServiceState(gm1, 'bluetooth');

      bluetoothService.emit('device:disconnected', {
        address: 'AA:BB:CC:DD:EE:FF',
        name: 'JBL Flip 6',
      });

      const data = await eventPromise;
      const payload = data.data || data;
      expect(payload.domain).toBe('bluetooth');
      expect(payload.state).toBeDefined();
    });
  });

  // ── Spotify ──

  describe('Spotify', () => {
    it('should push service:state spotify when playback state changes externally', async () => {
      const eventPromise = waitForServiceState(gm1, 'spotify');

      spotifyService.emit('playback:changed', { state: 'playing' });

      const data = await eventPromise;
      const payload = data.data || data;
      expect(payload.domain).toBe('spotify');
      expect(payload.state).toHaveProperty('state');
    });

    it('should push service:state spotify when track changes externally', async () => {
      const eventPromise = waitForServiceState(gm1, 'spotify');

      spotifyService.emit('track:changed', {
        title: 'New Song',
        artist: 'New Artist',
      });

      const data = await eventPromise;
      const payload = data.data || data;
      expect(payload.domain).toBe('spotify');
      expect(payload.state).toHaveProperty('connected');
    });
  });

  // ── VLC ──

  describe('VLC', () => {
    it('should push service:state video when VLC state changes externally', async () => {
      const eventPromise = waitForServiceState(gm1, 'video');

      vlcService.emit('state:changed', {
        previous: { state: 'stopped', filename: null },
        current: { state: 'playing', filename: 'intro.mp4' },
      });

      const data = await eventPromise;
      const payload = data.data || data;
      expect(payload.domain).toBe('video');
      expect(payload.state).toBeDefined();
    });
  });

  // ── Lighting ──

  describe('Lighting', () => {
    it('should push service:state lighting when scene activated externally', async () => {
      const eventPromise = waitForServiceState(gm1, 'lighting');

      lightingService.emit('scene:activated', {
        sceneId: 'scene.game_night',
        sceneName: 'Game Night',
      });

      const data = await eventPromise;
      const payload = data.data || data;
      expect(payload.domain).toBe('lighting');
      expect(payload.state).toBeDefined();
    });
  });

  // ── Audio ──

  describe('Audio', () => {
    it('should push service:state audio when PipeWire sink added', async () => {
      const eventPromise = waitForServiceState(gm1, 'audio');

      audioRoutingService.emit('sink:added', {
        name: 'bluez_sink.AA_BB',
        description: 'JBL Flip 6',
      });

      const data = await eventPromise;
      const payload = data.data || data;
      expect(payload.domain).toBe('audio');
      expect(payload.state).toBeDefined();
    });

    it('should push service:state audio when PipeWire sink removed', async () => {
      const eventPromise = waitForServiceState(gm1, 'audio');

      audioRoutingService.emit('sink:removed', {
        name: 'bluez_sink.AA_BB',
        description: 'JBL Flip 6',
      });

      const data = await eventPromise;
      const payload = data.data || data;
      expect(payload.domain).toBe('audio');
      expect(payload.state).toBeDefined();
    });
  });

  // ── Service Health ──

  describe('Service Health', () => {
    it('should push service:state health when service goes down', async () => {
      const eventPromise = waitForServiceState(gm1, 'health');

      serviceHealthRegistry.report('vlc', 'down', 'VLC process crashed');

      const data = await eventPromise;
      const payload = data.data || data;
      expect(payload.domain).toBe('health');
      expect(payload.state).toBeDefined();
    });

    it('should push service:state health when service recovers', async () => {
      // First mark it down
      serviceHealthRegistry.report('vlc', 'down', 'VLC crashed');

      const eventPromise = waitForServiceState(gm1, 'health');

      serviceHealthRegistry.report('vlc', 'healthy', 'VLC reconnected');

      const data = await eventPromise;
      const payload = data.data || data;
      expect(payload.domain).toBe('health');
      expect(payload.state).toBeDefined();
    });
  });
});
