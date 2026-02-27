'use strict';

describe('ServiceHealthRegistry', () => {
  let registry;

  beforeEach(() => {
    // Fresh instance for each test (bypass singleton)
    jest.resetModules();
    registry = require('../../../src/services/serviceHealthRegistry');
    registry.removeAllListeners();
    registry.reset();
  });

  describe('initialization', () => {
    it('should initialize all known services as down', () => {
      const snapshot = registry.getSnapshot();
      const services = ['vlc', 'spotify', 'sound', 'bluetooth', 'audio', 'lighting', 'gameclock', 'cueengine'];

      for (const id of services) {
        expect(snapshot[id]).toBeDefined();
        expect(snapshot[id].status).toBe('down');
      }
    });

    it('should have 8 registered services', () => {
      const snapshot = registry.getSnapshot();
      expect(Object.keys(snapshot)).toHaveLength(8);
    });
  });

  describe('report()', () => {
    it('should update service status to healthy', () => {
      registry.report('vlc', 'healthy', 'Connected to VLC HTTP');
      const status = registry.getStatus('vlc');
      expect(status.status).toBe('healthy');
      expect(status.message).toBe('Connected to VLC HTTP');
      expect(status.lastChecked).toBeInstanceOf(Date);
    });

    it('should update service status to down', () => {
      registry.report('vlc', 'healthy');
      registry.report('vlc', 'down', 'Connection refused');
      const status = registry.getStatus('vlc');
      expect(status.status).toBe('down');
      expect(status.message).toBe('Connection refused');
    });

    it('should emit health:changed when status changes', () => {
      const handler = jest.fn();
      registry.on('health:changed', handler);

      registry.report('vlc', 'healthy', 'Connected');

      expect(handler).toHaveBeenCalledWith({
        serviceId: 'vlc',
        status: 'healthy',
        message: 'Connected',
        previousStatus: 'down'
      });
    });

    it('should NOT emit health:changed when status is the same', () => {
      registry.report('vlc', 'healthy');
      const handler = jest.fn();
      registry.on('health:changed', handler);

      registry.report('vlc', 'healthy', 'Still connected');

      expect(handler).not.toHaveBeenCalled();
    });

    it('should emit on transition from healthy to down', () => {
      registry.report('spotify', 'healthy');
      const handler = jest.fn();
      registry.on('health:changed', handler);

      registry.report('spotify', 'down', 'D-Bus unreachable');

      expect(handler).toHaveBeenCalledWith({
        serviceId: 'spotify',
        status: 'down',
        message: 'D-Bus unreachable',
        previousStatus: 'healthy'
      });
    });

    it('should default message to empty string', () => {
      registry.report('vlc', 'healthy');
      const status = registry.getStatus('vlc');
      expect(status.message).toBe('');
    });

    it('should ignore unknown service IDs', () => {
      const handler = jest.fn();
      registry.on('health:changed', handler);

      registry.report('unknown-service', 'healthy');

      expect(handler).not.toHaveBeenCalled();
    });

    it('should ignore invalid status values', () => {
      const handler = jest.fn();
      registry.on('health:changed', handler);

      registry.report('vlc', 'degraded');

      expect(handler).not.toHaveBeenCalled();
      expect(registry.getStatus('vlc').status).toBe('down');
    });

    it('should update lastChecked timestamp on each report', () => {
      registry.report('vlc', 'healthy');
      const first = registry.getStatus('vlc').lastChecked;

      registry.report('vlc', 'healthy', 'updated');
      const second = registry.getStatus('vlc').lastChecked;

      expect(second.getTime()).toBeGreaterThanOrEqual(first.getTime());
    });
  });

  describe('isHealthy()', () => {
    it('should return false for services that have not reported', () => {
      expect(registry.isHealthy('vlc')).toBe(false);
    });

    it('should return true after healthy report', () => {
      registry.report('vlc', 'healthy');
      expect(registry.isHealthy('vlc')).toBe(true);
    });

    it('should return false after down report', () => {
      registry.report('vlc', 'healthy');
      registry.report('vlc', 'down');
      expect(registry.isHealthy('vlc')).toBe(false);
    });

    it('should return false for unknown service IDs', () => {
      expect(registry.isHealthy('nonexistent')).toBe(false);
    });
  });

  describe('getStatus()', () => {
    it('should return full status object', () => {
      registry.report('spotify', 'healthy', 'D-Bus active');
      const status = registry.getStatus('spotify');
      expect(status).toEqual({
        status: 'healthy',
        message: 'D-Bus active',
        lastChecked: expect.any(Date)
      });
    });

    it('should return null for unknown service IDs', () => {
      expect(registry.getStatus('nonexistent')).toBeNull();
    });
  });

  describe('getSnapshot()', () => {
    it('should return plain object (not Map)', () => {
      const snapshot = registry.getSnapshot();
      expect(typeof snapshot).toBe('object');
      expect(snapshot).not.toBeInstanceOf(Map);
    });

    it('should include all 8 services', () => {
      const snapshot = registry.getSnapshot();
      expect(Object.keys(snapshot)).toEqual(
        expect.arrayContaining(['vlc', 'spotify', 'sound', 'bluetooth', 'audio', 'lighting', 'gameclock', 'cueengine'])
      );
    });

    it('should reflect current health state', () => {
      registry.report('vlc', 'healthy', 'OK');
      registry.report('spotify', 'down', 'No D-Bus');

      const snapshot = registry.getSnapshot();
      expect(snapshot.vlc.status).toBe('healthy');
      expect(snapshot.spotify.status).toBe('down');
      expect(snapshot.sound.status).toBe('down');
    });

    it('should return independent copies (not references)', () => {
      registry.report('vlc', 'healthy');
      const snap1 = registry.getSnapshot();
      registry.report('vlc', 'down');
      const snap2 = registry.getSnapshot();

      expect(snap1.vlc.status).toBe('healthy');
      expect(snap2.vlc.status).toBe('down');
    });
  });

  describe('reset()', () => {
    it('should set all healthy services back to down', () => {
      registry.report('vlc', 'healthy');
      registry.report('spotify', 'healthy');

      registry.reset();

      expect(registry.isHealthy('vlc')).toBe(false);
      expect(registry.isHealthy('spotify')).toBe(false);
    });

    it('should emit health:changed for each service that was healthy', () => {
      registry.report('vlc', 'healthy');
      registry.report('spotify', 'healthy');

      const handler = jest.fn();
      registry.on('health:changed', handler);

      registry.reset();

      expect(handler).toHaveBeenCalledTimes(2);
      expect(handler).toHaveBeenCalledWith(expect.objectContaining({
        serviceId: 'vlc',
        status: 'down',
        previousStatus: 'healthy'
      }));
    });

    it('should NOT emit for services already down', () => {
      // All start as down, so reset should emit nothing
      const handler = jest.fn();
      registry.on('health:changed', handler);

      registry.reset();

      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('multiple services', () => {
    it('should track services independently', () => {
      registry.report('vlc', 'healthy');
      registry.report('spotify', 'down', 'No D-Bus');
      registry.report('lighting', 'healthy');
      registry.report('sound', 'healthy');

      expect(registry.isHealthy('vlc')).toBe(true);
      expect(registry.isHealthy('spotify')).toBe(false);
      expect(registry.isHealthy('lighting')).toBe(true);
      expect(registry.isHealthy('sound')).toBe(true);
      expect(registry.isHealthy('bluetooth')).toBe(false);
    });
  });
});
