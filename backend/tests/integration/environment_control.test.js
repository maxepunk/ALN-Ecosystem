/**
 * Environment Control Integration Tests (Phase 0)
 *
 * Tests the full WebSocket event flow for environment control services:
 *   gm:command -> adminEvents.js -> service method -> service event -> broadcasts.js -> WebSocket broadcast
 *
 * External dependencies (bluetoothctl, pactl, axios/HA) are mocked at the service level.
 * The test verifies the end-to-end WebSocket wiring, NOT the external tools.
 *
 * Covers:
 * 1. sync:full includes environment object on GM connection
 * 2. bluetooth:scan:start/stop -> bluetooth:scan broadcasts
 * 3. audio:route:set -> audio:routing broadcast
 * 4. lighting:scene:activate -> lighting:scene broadcast
 * 5. Graceful degradation when BT unavailable
 * 6. Graceful degradation when HA unreachable
 */

const { setupIntegrationTestServer, cleanupIntegrationTestServer } = require('../helpers/integration-test-server');
const { connectAndIdentify, waitForEvent, sendGmCommand } = require('../helpers/websocket-helpers');
const { resetAllServicesForTesting } = require('../helpers/service-reset');
const sessionService = require('../../src/services/sessionService');
const transactionService = require('../../src/services/transactionService');
const stateService = require('../../src/services/stateService');
const videoQueueService = require('../../src/services/videoQueueService');
const offlineQueueService = require('../../src/services/offlineQueueService');
const bluetoothService = require('../../src/services/bluetoothService');
const audioRoutingService = require('../../src/services/audioRoutingService');
const lightingService = require('../../src/services/lightingService');

describe('Environment Control Integration', () => {
  let testContext;
  let gm1;

  beforeAll(async () => {
    testContext = await setupIntegrationTestServer();
  });

  afterAll(async () => {
    await cleanupIntegrationTestServer(testContext);
  });

  beforeEach(async () => {
    // CRITICAL: Pass environment services so performSystemReset resets them
    // AND re-registers broadcast listeners on them. If omitted, the broadcast
    // listeners are not re-attached and service events won't reach WebSocket clients.
    await resetAllServicesForTesting(testContext.io, {
      sessionService,
      stateService,
      transactionService,
      videoQueueService,
      offlineQueueService,
      bluetoothService,
      audioRoutingService,
      lightingService,
    });
  });

  afterEach(() => {
    if (gm1?.connected) gm1.disconnect();
    jest.restoreAllMocks();
  });

  // ── 1. sync:full includes environment object ──

  describe('sync:full environment payload', () => {
    it('should include environment object with bluetooth, audio, lighting on GM connect', async () => {
      // Mock BT to avoid shelling out to bluetoothctl
      jest.spyOn(bluetoothService, 'isAvailable').mockResolvedValue(false);
      jest.spyOn(bluetoothService, 'getPairedDevices').mockResolvedValue([]);
      jest.spyOn(bluetoothService, 'getConnectedDevices').mockResolvedValue([]);

      gm1 = await connectAndIdentify(testContext.socketUrl, 'gm', 'GM_ENV_001');

      // sync:full is captured during connectAndIdentify
      const syncData = gm1.lastSyncFull;
      expect(syncData).toBeDefined();

      // Verify top-level environment key exists
      const env = syncData.data?.environment || syncData.environment;
      expect(env).toBeDefined();

      // bluetooth structure
      expect(env.bluetooth).toBeDefined();
      expect(typeof env.bluetooth.available).toBe('boolean');
      expect(typeof env.bluetooth.scanning).toBe('boolean');
      expect(Array.isArray(env.bluetooth.pairedDevices)).toBe(true);
      expect(Array.isArray(env.bluetooth.connectedDevices)).toBe(true);

      // audio structure
      expect(env.audio).toBeDefined();
      expect(env.audio.routes).toBeDefined();
      expect(env.audio.routes.video).toBeDefined();

      // lighting structure
      expect(env.lighting).toBeDefined();
      expect(typeof env.lighting.connected).toBe('boolean');
      expect(Array.isArray(env.lighting.scenes)).toBe(true);
    });

    it('should report bluetooth available:true when adapter is powered on', async () => {
      jest.spyOn(bluetoothService, 'isAvailable').mockResolvedValue(true);
      jest.spyOn(bluetoothService, 'getPairedDevices').mockResolvedValue([
        { address: 'AA:BB:CC:DD:EE:FF', name: 'Test Speaker', connected: false },
      ]);
      jest.spyOn(bluetoothService, 'getConnectedDevices').mockResolvedValue([]);

      gm1 = await connectAndIdentify(testContext.socketUrl, 'gm', 'GM_ENV_002');

      const syncData = gm1.lastSyncFull;
      const env = syncData.data?.environment || syncData.environment;

      expect(env.bluetooth.available).toBe(true);
      expect(env.bluetooth.pairedDevices).toHaveLength(1);
      expect(env.bluetooth.pairedDevices[0].address).toBe('AA:BB:CC:DD:EE:FF');
    });

    it('should show default audio routing (video -> hdmi)', async () => {
      jest.spyOn(bluetoothService, 'isAvailable').mockResolvedValue(false);
      jest.spyOn(bluetoothService, 'getPairedDevices').mockResolvedValue([]);
      jest.spyOn(bluetoothService, 'getConnectedDevices').mockResolvedValue([]);

      gm1 = await connectAndIdentify(testContext.socketUrl, 'gm', 'GM_ENV_003');

      const syncData = gm1.lastSyncFull;
      const env = syncData.data?.environment || syncData.environment;

      expect(env.audio.routes.video.sink).toBe('hdmi');
    });
  });

  // ── 2. bluetooth:scan:start -> bluetooth:scan broadcast ──

  describe('bluetooth:scan:start', () => {
    it('should broadcast bluetooth:scan with scanning:true when scan starts', async () => {
      // Mock startScan to NOT spawn a real process but still emit the event
      jest.spyOn(bluetoothService, 'startScan').mockImplementation((timeout) => {
        // Simulate what the real startScan does: emit scan:started
        bluetoothService.emit('scan:started', { timeout: timeout || 15 });
      });

      // Mock BT availability for connectAndIdentify
      jest.spyOn(bluetoothService, 'isAvailable').mockResolvedValue(false);
      jest.spyOn(bluetoothService, 'getPairedDevices').mockResolvedValue([]);
      jest.spyOn(bluetoothService, 'getConnectedDevices').mockResolvedValue([]);

      gm1 = await connectAndIdentify(testContext.socketUrl, 'gm', 'GM_ENV_010');

      // Listen for the broadcast
      const scanPromise = waitForEvent(gm1, 'bluetooth:scan');

      // Send gm:command to start scan
      sendGmCommand(gm1, 'bluetooth:scan:start', {});

      const scanData = await scanPromise;
      const payload = scanData.data || scanData;
      expect(payload.scanning).toBe(true);
    });
  });

  // ── 3. bluetooth:scan:stop -> bluetooth:scan broadcast ──

  describe('bluetooth:scan:stop', () => {
    it('should broadcast bluetooth:scan with scanning:false when scan stops', async () => {
      // Mock startScan to set up a fake scan state that stopScan can work with
      jest.spyOn(bluetoothService, 'startScan').mockImplementation(() => {
        bluetoothService._scanProc = { kill: jest.fn() };
        bluetoothService.emit('scan:started', { timeout: 15 });
      });

      // Mock stopScan to simulate the close handler emitting scan:stopped
      jest.spyOn(bluetoothService, 'stopScan').mockImplementation(() => {
        bluetoothService._scanProc = null;
        bluetoothService.emit('scan:stopped', { exitCode: 0 });
      });

      jest.spyOn(bluetoothService, 'isAvailable').mockResolvedValue(false);
      jest.spyOn(bluetoothService, 'getPairedDevices').mockResolvedValue([]);
      jest.spyOn(bluetoothService, 'getConnectedDevices').mockResolvedValue([]);

      gm1 = await connectAndIdentify(testContext.socketUrl, 'gm', 'GM_ENV_011');

      // Start scan first
      sendGmCommand(gm1, 'bluetooth:scan:start', {});
      await waitForEvent(gm1, 'bluetooth:scan');

      // Now listen for scan stop
      const stopPromise = waitForEvent(gm1, 'bluetooth:scan');
      sendGmCommand(gm1, 'bluetooth:scan:stop', {});

      const stopData = await stopPromise;
      const payload = stopData.data || stopData;
      expect(payload.scanning).toBe(false);
    });
  });

  // ── 4. audio:route:set -> audio:routing broadcast ──

  describe('audio:route:set', () => {
    it('should broadcast audio:routing when stream route is changed', async () => {
      // setStreamRoute is fine to call (internal state + emit), but it calls persistenceService.save()
      // which is OK in tests. Mock applyRouting since it calls pactl.
      jest.spyOn(audioRoutingService, 'applyRouting').mockImplementation(async (stream) => {
        // Simulate the routing:applied event
        audioRoutingService.emit('routing:applied', {
          stream,
          sink: 'bluetooth',
          sinkType: 'bluetooth',
        });
      });

      jest.spyOn(bluetoothService, 'isAvailable').mockResolvedValue(false);
      jest.spyOn(bluetoothService, 'getPairedDevices').mockResolvedValue([]);
      jest.spyOn(bluetoothService, 'getConnectedDevices').mockResolvedValue([]);

      gm1 = await connectAndIdentify(testContext.socketUrl, 'gm', 'GM_ENV_020');

      // We expect TWO audio:routing events: one from routing:changed (setStreamRoute),
      // one from routing:applied (applyRouting). We'll wait for the first one.
      const routingPromise = waitForEvent(gm1, 'audio:routing');

      sendGmCommand(gm1, 'audio:route:set', { stream: 'video', sink: 'bluetooth' });

      const routingData = await routingPromise;
      const payload = routingData.data || routingData;

      // The first broadcast comes from routing:changed (setStreamRoute)
      expect(payload.stream).toBe('video');
      expect(payload.sink).toBe('bluetooth');
    });

    it('should receive gm:command:ack after successful audio route change', async () => {
      jest.spyOn(audioRoutingService, 'applyRouting').mockResolvedValue();

      jest.spyOn(bluetoothService, 'isAvailable').mockResolvedValue(false);
      jest.spyOn(bluetoothService, 'getPairedDevices').mockResolvedValue([]);
      jest.spyOn(bluetoothService, 'getConnectedDevices').mockResolvedValue([]);

      gm1 = await connectAndIdentify(testContext.socketUrl, 'gm', 'GM_ENV_021');

      const ackPromise = waitForEvent(gm1, 'gm:command:ack');

      sendGmCommand(gm1, 'audio:route:set', { stream: 'video', sink: 'hdmi' });

      const ackData = await ackPromise;
      const ack = ackData.data || ackData;
      expect(ack.success).toBe(true);
      expect(ack.action).toBe('audio:route:set');
    });
  });

  // ── 5. lighting:scene:activate -> lighting:scene broadcast ──

  describe('lighting:scene:activate', () => {
    it('should broadcast lighting:scene when scene is activated', async () => {
      // Mock activateScene to skip axios POST to HA but still emit event
      jest.spyOn(lightingService, 'activateScene').mockImplementation(async (sceneId) => {
        lightingService._activeScene = sceneId;
        lightingService.emit('scene:activated', { sceneId, sceneName: sceneId });
      });

      jest.spyOn(bluetoothService, 'isAvailable').mockResolvedValue(false);
      jest.spyOn(bluetoothService, 'getPairedDevices').mockResolvedValue([]);
      jest.spyOn(bluetoothService, 'getConnectedDevices').mockResolvedValue([]);

      gm1 = await connectAndIdentify(testContext.socketUrl, 'gm', 'GM_ENV_030');

      const scenePromise = waitForEvent(gm1, 'lighting:scene');

      sendGmCommand(gm1, 'lighting:scene:activate', { sceneId: 'scene.game_start' });

      const sceneData = await scenePromise;
      const payload = sceneData.data || sceneData;
      expect(payload.sceneId).toBe('scene.game_start');
    });

    it('should receive gm:command:ack after successful scene activation', async () => {
      jest.spyOn(lightingService, 'activateScene').mockImplementation(async (sceneId) => {
        lightingService._activeScene = sceneId;
        lightingService.emit('scene:activated', { sceneId, sceneName: sceneId });
      });

      jest.spyOn(bluetoothService, 'isAvailable').mockResolvedValue(false);
      jest.spyOn(bluetoothService, 'getPairedDevices').mockResolvedValue([]);
      jest.spyOn(bluetoothService, 'getConnectedDevices').mockResolvedValue([]);

      gm1 = await connectAndIdentify(testContext.socketUrl, 'gm', 'GM_ENV_031');

      const ackPromise = waitForEvent(gm1, 'gm:command:ack');

      sendGmCommand(gm1, 'lighting:scene:activate', { sceneId: 'scene.intermission' });

      const ackData = await ackPromise;
      const ack = ackData.data || ackData;
      expect(ack.success).toBe(true);
      expect(ack.action).toBe('lighting:scene:activate');
    });
  });

  // ── 6. BT service unavailable -> graceful degradation ──

  describe('graceful degradation: bluetooth unavailable', () => {
    it('should report bluetooth.available:false in sync:full when adapter is absent', async () => {
      // isAvailable returns false -> adapter not present
      jest.spyOn(bluetoothService, 'isAvailable').mockResolvedValue(false);
      jest.spyOn(bluetoothService, 'getPairedDevices').mockResolvedValue([]);
      jest.spyOn(bluetoothService, 'getConnectedDevices').mockResolvedValue([]);

      gm1 = await connectAndIdentify(testContext.socketUrl, 'gm', 'GM_ENV_040');

      const syncData = gm1.lastSyncFull;
      const env = syncData.data?.environment || syncData.environment;

      expect(env.bluetooth.available).toBe(false);
      expect(env.bluetooth.scanning).toBe(false);
    });

    it('should not crash when bluetooth scan command is sent but BT unavailable', async () => {
      // Mock startScan to simulate the guard returning alreadyScanning: undefined
      // (BT service will attempt spawn but fail; we mock it to just emit nothing)
      jest.spyOn(bluetoothService, 'startScan').mockImplementation(() => {
        // Simulate: no scan process started, no events emitted, no crash
        return undefined;
      });

      jest.spyOn(bluetoothService, 'isAvailable').mockResolvedValue(false);
      jest.spyOn(bluetoothService, 'getPairedDevices').mockResolvedValue([]);
      jest.spyOn(bluetoothService, 'getConnectedDevices').mockResolvedValue([]);

      gm1 = await connectAndIdentify(testContext.socketUrl, 'gm', 'GM_ENV_041');

      // Send scan command — should get ack without crashing
      const ackPromise = waitForEvent(gm1, 'gm:command:ack');
      sendGmCommand(gm1, 'bluetooth:scan:start', {});

      const ackData = await ackPromise;
      const ack = ackData.data || ackData;
      expect(ack.success).toBe(true);
      expect(ack.action).toBe('bluetooth:scan:start');
    });
  });

  // ── 7. HA unreachable -> lighting shows disconnected ──

  describe('graceful degradation: Home Assistant unreachable', () => {
    it('should show lighting.connected:false when HA token not configured', async () => {
      // lightingService.isConnected() checks config.lighting.homeAssistantToken
      // In test environment, HA_TOKEN is empty -> isConnected returns false
      jest.spyOn(bluetoothService, 'isAvailable').mockResolvedValue(false);
      jest.spyOn(bluetoothService, 'getPairedDevices').mockResolvedValue([]);
      jest.spyOn(bluetoothService, 'getConnectedDevices').mockResolvedValue([]);

      gm1 = await connectAndIdentify(testContext.socketUrl, 'gm', 'GM_ENV_050');

      const syncData = gm1.lastSyncFull;
      const env = syncData.data?.environment || syncData.environment;

      expect(env.lighting.connected).toBe(false);
      expect(env.lighting.scenes).toEqual([]);
      expect(env.lighting.activeScene).toBeNull();
    });

    it('should return error ack when scene activation fails (HA unreachable)', async () => {
      // Don't mock activateScene — let it try the real axios call which will fail
      // (no HA server running in test environment)
      jest.spyOn(lightingService, 'activateScene').mockRejectedValue(
        new Error('connect ECONNREFUSED 127.0.0.1:8123')
      );

      jest.spyOn(bluetoothService, 'isAvailable').mockResolvedValue(false);
      jest.spyOn(bluetoothService, 'getPairedDevices').mockResolvedValue([]);
      jest.spyOn(bluetoothService, 'getConnectedDevices').mockResolvedValue([]);

      gm1 = await connectAndIdentify(testContext.socketUrl, 'gm', 'GM_ENV_051');

      const ackPromise = waitForEvent(gm1, 'gm:command:ack');
      sendGmCommand(gm1, 'lighting:scene:activate', { sceneId: 'scene.doesnt_exist' });

      const ackData = await ackPromise;
      const ack = ackData.data || ackData;
      expect(ack.success).toBe(false);
      expect(ack.action).toBe('lighting:scene:activate');
      expect(ack.message).toContain('ECONNREFUSED');
    });
  });

  // ── Additional edge case tests ──

  describe('bluetooth:device broadcasts', () => {
    it('should broadcast bluetooth:device when a device is discovered during scan', async () => {
      jest.spyOn(bluetoothService, 'startScan').mockImplementation(() => {
        bluetoothService.emit('scan:started', { timeout: 15 });
        // Simulate a device discovered after a short delay
        setTimeout(() => {
          bluetoothService.emit('device:discovered', {
            address: '11:22:33:44:55:66',
            name: 'JBL Flip 6',
          });
        }, 50);
      });

      jest.spyOn(bluetoothService, 'isAvailable').mockResolvedValue(false);
      jest.spyOn(bluetoothService, 'getPairedDevices').mockResolvedValue([]);
      jest.spyOn(bluetoothService, 'getConnectedDevices').mockResolvedValue([]);

      gm1 = await connectAndIdentify(testContext.socketUrl, 'gm', 'GM_ENV_060');

      const devicePromise = waitForEvent(gm1, 'bluetooth:device');

      sendGmCommand(gm1, 'bluetooth:scan:start', {});

      const deviceData = await devicePromise;
      const payload = deviceData.data || deviceData;
      expect(payload.type).toBe('discovered');
      expect(payload.device.address).toBe('11:22:33:44:55:66');
      expect(payload.device.name).toBe('JBL Flip 6');
    });
  });

  describe('audio:route:set validation', () => {
    it('should return error ack when sink is not provided', async () => {
      jest.spyOn(bluetoothService, 'isAvailable').mockResolvedValue(false);
      jest.spyOn(bluetoothService, 'getPairedDevices').mockResolvedValue([]);
      jest.spyOn(bluetoothService, 'getConnectedDevices').mockResolvedValue([]);

      gm1 = await connectAndIdentify(testContext.socketUrl, 'gm', 'GM_ENV_070');

      const ackPromise = waitForEvent(gm1, 'gm:command:ack');

      // Send without sink — adminEvents.js throws "sink is required"
      sendGmCommand(gm1, 'audio:route:set', { stream: 'video' });

      const ackData = await ackPromise;
      const ack = ackData.data || ackData;
      expect(ack.success).toBe(false);
      expect(ack.message).toContain('sink is required');
    });
  });

  describe('lighting:scene:activate validation', () => {
    it('should return error ack when sceneId is not provided', async () => {
      jest.spyOn(bluetoothService, 'isAvailable').mockResolvedValue(false);
      jest.spyOn(bluetoothService, 'getPairedDevices').mockResolvedValue([]);
      jest.spyOn(bluetoothService, 'getConnectedDevices').mockResolvedValue([]);

      gm1 = await connectAndIdentify(testContext.socketUrl, 'gm', 'GM_ENV_071');

      const ackPromise = waitForEvent(gm1, 'gm:command:ack');

      sendGmCommand(gm1, 'lighting:scene:activate', {});

      const ackData = await ackPromise;
      const ack = ackData.data || ackData;
      expect(ack.success).toBe(false);
      expect(ack.message).toContain('sceneId is required');
    });
  });
});
