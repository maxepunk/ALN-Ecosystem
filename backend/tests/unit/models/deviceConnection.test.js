const DeviceConnection = require('../../../src/models/deviceConnection');

describe('DeviceConnection', () => {
  describe('constructor and type checks', () => {
    test('creates with defaults', () => {
      const dc = new DeviceConnection({ id: 'dev1', type: 'gm' });
      expect(dc.id).toBe('dev1');
      expect(dc.type).toBe('gm');
      expect(dc.connectionStatus).toBe('connected');
    });

    test('isGM returns true for gm type', () => {
      const dc = new DeviceConnection({ id: 'dev1', type: 'gm' });
      expect(dc.isGM()).toBe(true);
      expect(dc.isPlayer()).toBe(false);
    });

    test('isPlayer returns true for player type', () => {
      const dc = new DeviceConnection({ id: 'dev1', type: 'player' });
      expect(dc.isPlayer()).toBe(true);
    });
  });

  describe('connection lifecycle', () => {
    let dc;
    beforeEach(() => { dc = new DeviceConnection({ id: 'dev1', type: 'player' }); });

    test('connect sets status and timestamps', () => {
      dc.disconnect();
      dc.connect();
      expect(dc.isConnected()).toBe(true);
      expect(dc.connectionTime).toBeTruthy();
    });

    test('disconnect sets status', () => {
      dc.disconnect();
      expect(dc.isDisconnected()).toBe(true);
    });

    test('reconnect sets reconnecting status', () => {
      dc.reconnect();
      expect(dc.isReconnecting()).toBe(true);
    });
  });

  describe('heartbeat and timeout', () => {
    test('updateHeartbeat refreshes timestamp', () => {
      const dc = new DeviceConnection({ id: 'dev1', type: 'player' });
      // Set heartbeat to old value, then verify updateHeartbeat changes it
      dc.lastHeartbeat = new Date(Date.now() - 5000).toISOString();
      const before = dc.lastHeartbeat;
      dc.updateHeartbeat();
      expect(dc.lastHeartbeat).not.toBe(before);
    });

    test('hasTimedOut returns true after timeout period', () => {
      const dc = new DeviceConnection({ id: 'dev1', type: 'player' });
      // Manually set old heartbeat
      dc.lastHeartbeat = new Date(Date.now() - 60000).toISOString();
      expect(dc.hasTimedOut(30000)).toBe(true);
    });

    test('hasTimedOut returns false when recent', () => {
      const dc = new DeviceConnection({ id: 'dev1', type: 'player' });
      dc.updateHeartbeat();
      expect(dc.hasTimedOut(30000)).toBe(false);
    });
  });

  describe('sync state', () => {
    let dc;
    beforeEach(() => { dc = new DeviceConnection({ id: 'dev1', type: 'gm' }); });

    test('syncSuccess resets errors and updates timestamp', () => {
      dc.syncError();
      dc.syncError();
      dc.syncSuccess();
      expect(dc.syncState.syncErrors).toBe(0);
    });

    test('addPendingUpdate increments and needsSync returns true', () => {
      dc.addPendingUpdate();
      expect(dc.needsSync()).toBe(true);
    });

    test('clearPendingUpdates resets count', () => {
      dc.addPendingUpdate();
      dc.addPendingUpdate();
      dc.clearPendingUpdates();
      expect(dc.needsSync()).toBe(false);
    });
  });

  describe('serialization', () => {
    test('toJSON round-trips via fromJSON', () => {
      const original = new DeviceConnection({ id: 'dev1', type: 'gm', name: 'GM Station' });
      const json = original.toJSON();
      const restored = DeviceConnection.fromJSON(json);
      expect(restored.id).toBe('dev1');
      expect(restored.name).toBe('GM Station');
    });

    test('fromIdentify creates from WebSocket identify data', () => {
      const dc = DeviceConnection.fromIdentify(
        { deviceId: 'gm-001', deviceType: 'gm', name: 'Main GM' },
        '192.168.1.100'
      );
      expect(dc.id).toBe('gm-001');
      expect(dc.type).toBe('gm');
      expect(dc.ipAddress).toBe('192.168.1.100');
    });
  });
});
