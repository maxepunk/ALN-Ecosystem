/**
 * External State Propagation Integration Tests
 *
 * Verifies the full event chain: service emits domain event →
 * broadcasts.js forwards to WebSocket → connected GM client receives event.
 *
 * These tests exercise Layers 2-4 of the event pipeline:
 *   Layer 2: Service EventEmitter emission
 *   Layer 3: broadcasts.js listener → WebSocket broadcast
 *   Layer 4: Socket.IO delivery to GM client
 *
 * Layer 1 (external monitor parsing) is unit-tested per service.
 *
 * Pattern: emit directly on service singletons (simulating what monitors do),
 * verify the GM client receives the correctly-shaped WebSocket event.
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
const vlcService = require('../../src/services/vlcService');
const spotifyService = require('../../src/services/spotifyService');
const serviceHealthRegistry = require('../../src/services/serviceHealthRegistry');

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
    it('should broadcast bluetooth:device when speaker auto-connects', async () => {
      const eventPromise = waitForEvent(gm1, 'bluetooth:device');

      // Simulate what the BT D-Bus monitor does when a speaker connects
      bluetoothService.emit('device:connected', {
        address: 'AA:BB:CC:DD:EE:FF',
        name: 'JBL Flip 6',
      });

      const data = await eventPromise;
      const payload = data.data || data;
      expect(payload.type).toBe('connected');
      expect(payload.device.address).toBe('AA:BB:CC:DD:EE:FF');
      expect(payload.device.name).toBe('JBL Flip 6');
    });

    it('should broadcast bluetooth:device when speaker disconnects', async () => {
      const eventPromise = waitForEvent(gm1, 'bluetooth:device');

      bluetoothService.emit('device:disconnected', {
        address: 'AA:BB:CC:DD:EE:FF',
        name: 'JBL Flip 6',
      });

      const data = await eventPromise;
      const payload = data.data || data;
      expect(payload.type).toBe('disconnected');
      expect(payload.device.address).toBe('AA:BB:CC:DD:EE:FF');
    });
  });

  // ── Spotify ──

  describe('Spotify', () => {
    it('should broadcast spotify:status when playback state changes externally', async () => {
      const eventPromise = waitForEvent(gm1, 'spotify:status');

      // Simulate what the Spotify D-Bus monitor does when playback starts externally
      spotifyService.emit('playback:changed', { state: 'playing' });

      const data = await eventPromise;
      const payload = data.data || data;
      // spotify:status broadcasts the full getState() result
      expect(payload).toHaveProperty('state');
    });

    it('should broadcast spotify:status when track changes externally', async () => {
      const eventPromise = waitForEvent(gm1, 'spotify:status');

      spotifyService.emit('track:changed', {
        title: 'New Song',
        artist: 'New Artist',
      });

      const data = await eventPromise;
      const payload = data.data || data;
      expect(payload).toHaveProperty('connected');
    });
  });

  // ── VLC ──

  describe('VLC', () => {
    it('should broadcast video:status when VLC state changes externally', async () => {
      const eventPromise = waitForEvent(gm1, 'video:status');

      // Simulate what VLC checkConnection() state delta does
      vlcService.emit('state:changed', {
        previous: { state: 'stopped', filename: null },
        current: { state: 'playing', filename: 'intro.mp4' },
      });

      const data = await eventPromise;
      const payload = data.data || data;
      expect(payload.status).toBe('playing');
      expect(payload.currentItem).toBe('intro.mp4');
      expect(payload.vlcDelta).toBe(true);
    });
  });

  // ── Lighting ──

  describe('Lighting', () => {
    it('should broadcast lighting:scene when scene activated externally', async () => {
      const eventPromise = waitForEvent(gm1, 'lighting:scene');

      // Simulate what HA WebSocket monitor does when scene activated
      lightingService.emit('scene:activated', {
        sceneId: 'scene.game_night',
        sceneName: 'Game Night',
      });

      const data = await eventPromise;
      const payload = data.data || data;
      expect(payload.sceneId).toBe('scene.game_night');
    });
  });

  // ── Audio ──

  describe('Audio', () => {
    it('should broadcast audio:sinks when PipeWire sink added', async () => {
      // Mock getRoutingStatus to return sink list (broadcasts.js reads this)
      jest.spyOn(audioRoutingService, 'getRoutingStatus').mockReturnValue({
        routes: { video: 'hdmi', spotify: 'hdmi', sound: 'hdmi' },
        availableSinks: [
          { name: 'alsa_output.hdmi', description: 'HDMI', type: 'hdmi' },
          { name: 'bluez_sink.AA_BB', description: 'JBL Flip 6', type: 'bluetooth' },
        ],
      });

      const eventPromise = waitForEvent(gm1, 'audio:sinks');

      audioRoutingService.emit('sink:added', {
        name: 'bluez_sink.AA_BB',
        description: 'JBL Flip 6',
      });

      const data = await eventPromise;
      const payload = data.data || data;
      expect(payload.availableSinks).toBeDefined();
      expect(payload.availableSinks.length).toBeGreaterThanOrEqual(1);
    });

    it('should broadcast audio:sinks when PipeWire sink removed', async () => {
      jest.spyOn(audioRoutingService, 'getRoutingStatus').mockReturnValue({
        routes: { video: 'hdmi', spotify: 'hdmi', sound: 'hdmi' },
        availableSinks: [
          { name: 'alsa_output.hdmi', description: 'HDMI', type: 'hdmi' },
        ],
      });

      const eventPromise = waitForEvent(gm1, 'audio:sinks');

      audioRoutingService.emit('sink:removed', {
        name: 'bluez_sink.AA_BB',
        description: 'JBL Flip 6',
      });

      const data = await eventPromise;
      const payload = data.data || data;
      expect(payload.availableSinks).toBeDefined();
    });
  });

  // ── Service Health ──

  describe('Service Health', () => {
    it('should broadcast service:health when service goes down', async () => {
      const isDown = (data) => {
        const p = data.data || data;
        return p.serviceId === 'vlc' && p.status === 'down';
      };
      const eventPromise = waitForEvent(gm1, 'service:health', isDown);

      // Simulate external detection of service failure
      serviceHealthRegistry.report('vlc', 'down', 'VLC process crashed');

      const data = await eventPromise;
      const payload = data.data || data;
      expect(payload.serviceId).toBe('vlc');
      expect(payload.status).toBe('down');
      expect(payload.message).toBe('VLC process crashed');
    });

    it('should broadcast service:health when service recovers', async () => {
      // First mark it down
      serviceHealthRegistry.report('vlc', 'down', 'VLC crashed');

      const isHealthy = (data) => {
        const p = data.data || data;
        return p.serviceId === 'vlc' && p.status === 'healthy';
      };
      const eventPromise = waitForEvent(gm1, 'service:health', isHealthy);

      // Simulate recovery
      serviceHealthRegistry.report('vlc', 'healthy', 'VLC reconnected');

      const data = await eventPromise;
      const payload = data.data || data;
      expect(payload.serviceId).toBe('vlc');
      expect(payload.status).toBe('healthy');
    });
  });
});
