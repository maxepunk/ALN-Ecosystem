jest.mock('../../../src/utils/logger');
jest.mock('../../../src/services/sessionService');
jest.mock('../../../src/websocket/deviceHelpers');

const heartbeatMonitorService = require('../../../src/services/heartbeatMonitorService');
const sessionService = require('../../../src/services/sessionService');
const { disconnectDevice } = require('../../../src/websocket/deviceHelpers');

describe('HeartbeatMonitorService', () => {
  let mockIo;

  beforeEach(() => {
    jest.useFakeTimers();
    mockIo = { to: jest.fn().mockReturnThis(), emit: jest.fn() };
    heartbeatMonitorService.reset();
    jest.clearAllMocks();
  });

  afterEach(() => {
    heartbeatMonitorService.reset();
    jest.useRealTimers();
  });

  describe('init', () => {
    test('stores io reference', () => {
      heartbeatMonitorService.init(mockIo);
      expect(heartbeatMonitorService.io).toBe(mockIo);
    });

    test('throws if io is null', () => {
      expect(() => heartbeatMonitorService.init(null)).toThrow();
    });
  });

  describe('start/stop', () => {
    beforeEach(() => {
      heartbeatMonitorService.init(mockIo);
    });

    test('start begins interval checking', () => {
      sessionService.getCurrentSession.mockReturnValue(null);
      heartbeatMonitorService.start();

      // Advance past check interval (15s)
      jest.advanceTimersByTime(15000);

      // Should have attempted to check (even if no session)
      expect(sessionService.getCurrentSession).toHaveBeenCalled();
    });

    test('stop clears interval', () => {
      heartbeatMonitorService.start();
      heartbeatMonitorService.stop();

      jest.clearAllMocks();
      jest.advanceTimersByTime(30000);

      // No checks after stop
      expect(sessionService.getCurrentSession).not.toHaveBeenCalled();
    });

    test('duplicate start is guarded', () => {
      heartbeatMonitorService.start();
      heartbeatMonitorService.start(); // Should not throw or double-start
    });
  });

  describe('checkDeviceHeartbeats', () => {
    beforeEach(() => {
      heartbeatMonitorService.init(mockIo);
    });

    test('skips when no session exists', async () => {
      sessionService.getCurrentSession.mockReturnValue(null);
      await heartbeatMonitorService.checkDeviceHeartbeats();
      expect(disconnectDevice).not.toHaveBeenCalled();
    });

    test('disconnects timed-out player devices', async () => {
      const oldHeartbeat = new Date(Date.now() - 60000).toISOString();
      const session = {
        connectedDevices: [{
          id: 'player-1',
          type: 'player',
          connectionStatus: 'connected',
          connectionTime: oldHeartbeat,
          lastHeartbeat: oldHeartbeat,
          syncState: { lastSyncTime: oldHeartbeat, pendingUpdates: 0, syncErrors: 0 }
        }]
      };
      sessionService.getCurrentSession.mockReturnValue(session);

      await heartbeatMonitorService.checkDeviceHeartbeats();

      expect(disconnectDevice).toHaveBeenCalled();
    });

    test('skips GM devices (WebSocket-based, not HTTP heartbeat)', async () => {
      const oldHeartbeat = new Date(Date.now() - 60000).toISOString();
      const session = {
        connectedDevices: [{
          id: 'gm-1',
          type: 'gm',
          connectionStatus: 'connected',
          connectionTime: oldHeartbeat,
          lastHeartbeat: oldHeartbeat,
          syncState: { lastSyncTime: oldHeartbeat, pendingUpdates: 0, syncErrors: 0 }
        }]
      };
      sessionService.getCurrentSession.mockReturnValue(session);

      await heartbeatMonitorService.checkDeviceHeartbeats();

      expect(disconnectDevice).not.toHaveBeenCalled();
    });

    test('skips already disconnected devices', async () => {
      const oldHeartbeat = new Date(Date.now() - 60000).toISOString();
      const session = {
        connectedDevices: [{
          id: 'player-1',
          type: 'player',
          connectionStatus: 'disconnected',
          connectionTime: oldHeartbeat,
          lastHeartbeat: oldHeartbeat,
          syncState: { lastSyncTime: oldHeartbeat, pendingUpdates: 0, syncErrors: 0 }
        }]
      };
      sessionService.getCurrentSession.mockReturnValue(session);

      await heartbeatMonitorService.checkDeviceHeartbeats();

      expect(disconnectDevice).not.toHaveBeenCalled();
    });
  });
});
