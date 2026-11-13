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
      const services = ['vlc', 'music', 'sound', 'bluetooth', 'audio', 'lighting', 'gameclock', 'cueengine', 'display'];

      for (const id of services) {
        expect(snapshot[id]).toBeDefined();
        expect(snapshot[id].status).toBe('down');
      }
    });

    it('should have 9 registered services (display is the ninth — P16)', () => {
      const snapshot = registry.getSnapshot();
      expect(Object.keys(snapshot)).toHaveLength(9);
      expect(snapshot.display).toBeDefined();
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
      registry.report('music', 'healthy');
      const handler = jest.fn();
      registry.on('health:changed', handler);

      registry.report('music', 'down', 'D-Bus unreachable');

      expect(handler).toHaveBeenCalledWith({
        serviceId: 'music',
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
      registry.report('music', 'healthy', 'D-Bus active');
      const status = registry.getStatus('music');
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

    it('should include all 9 services', () => {
      const snapshot = registry.getSnapshot();
      expect(Object.keys(snapshot)).toEqual(
        expect.arrayContaining(['vlc', 'music', 'sound', 'bluetooth', 'audio', 'lighting', 'gameclock', 'cueengine', 'display'])
      );
    });

    it('should reflect current health state', () => {
      registry.report('vlc', 'healthy', 'OK');
      registry.report('music', 'down', 'MPD unreachable');

      const snapshot = registry.getSnapshot();
      expect(snapshot.vlc.status).toBe('healthy');
      expect(snapshot.music.status).toBe('down');
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
      registry.report('music', 'healthy');

      registry.reset();

      expect(registry.isHealthy('vlc')).toBe(false);
      expect(registry.isHealthy('music')).toBe(false);
    });

    it('should emit health:changed for each service that was healthy', () => {
      registry.report('vlc', 'healthy');
      registry.report('music', 'healthy');

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

    it('should LOG each health transition (so a system:reset is never invisible)', () => {
      // 0523game: system:reset silently flipped music healthy→down with no log
      // line, which made the music outage invisible in the logs. reset() must
      // log its transitions the same way report() does.
      const logger = require('../../../src/utils/logger');
      const infoSpy = jest.spyOn(logger, 'info').mockImplementation(() => {});

      registry.report('music', 'healthy', 'MPD connected');
      infoSpy.mockClear(); // drop the report()'s own "healthy" log line

      registry.reset();

      expect(infoSpy).toHaveBeenCalledWith(
        expect.stringContaining('Service health changed: music'),
        expect.anything()
      );
      infoSpy.mockRestore();
    });
  });

  // ── Block 2 T1a D1: sticky dormant carries its door (plan pin P5) ──
  //
  // A service whose equipment family is not installed tonight (or that the
  // operator latched out) is DORMANT: latched, never red, with its door
  // named. Alarm integrity (CONTEXT.md §4) is the point — a red that is
  // always red trains GMs to ignore red.
  describe('dormancy (P5)', () => {
    it('exports the three-word vocabulary and the two doors, frozen', () => {
      const mod = require('../../../src/services/serviceHealthRegistry');
      expect(mod.HEALTH_STATUSES).toEqual(['healthy', 'down', 'dormant']);
      expect(Object.isFrozen(mod.HEALTH_STATUSES)).toBe(true);
      expect(mod.DOORS).toEqual(['profile', 'operator']);
      expect(Object.isFrozen(mod.DOORS)).toBe(true);
    });

    it('markDormant latches with the door and emits health:changed', () => {
      const handler = jest.fn();
      registry.on('health:changed', handler);

      registry.markDormant('lighting', 'profile', 'lighting is not installed tonight');

      expect(registry.getStatus('lighting')).toEqual({
        status: 'dormant',
        message: 'lighting is not installed tonight',
        lastChecked: expect.any(Date),
        door: 'profile',
      });
      expect(handler).toHaveBeenCalledWith(expect.objectContaining({
        serviceId: 'lighting',
        status: 'dormant',
        previousStatus: 'down',
      }));
    });

    it('emits when only the DOOR changes (profile → operator)', () => {
      registry.markDormant('lighting', 'profile', 'lighting is not installed tonight');
      const handler = jest.fn();
      registry.on('health:changed', handler);

      registry.markDormant('lighting', 'operator', 'lighting is out of service');

      expect(handler).toHaveBeenCalledTimes(1);
      expect(registry.getStatus('lighting').door).toBe('operator');
    });

    it('does NOT emit when the same door re-marks the same service', () => {
      registry.markDormant('lighting', 'profile', 'lighting is not installed tonight');
      const handler = jest.fn();
      registry.on('health:changed', handler);

      registry.markDormant('lighting', 'profile', 'lighting is not installed tonight');

      expect(handler).not.toHaveBeenCalled();
    });

    it('IGNORES report() while latched — status, message and door unchanged, no event', () => {
      registry.markDormant('lighting', 'profile', 'lighting is not installed tonight');
      const handler = jest.fn();
      registry.on('health:changed', handler);

      registry.report('lighting', 'down', 'Home Assistant unreachable');
      registry.report('lighting', 'healthy', 'Connected via WebSocket');

      expect(registry.getStatus('lighting')).toEqual({
        status: 'dormant',
        message: 'lighting is not installed tonight',
        lastChecked: expect.any(Date),
        door: 'profile',
      });
      expect(handler).not.toHaveBeenCalled();
    });

    it('debug-logs the ignored report with the id, the status and the door', () => {
      const logger = require('../../../src/utils/logger');
      const debugSpy = jest.spyOn(logger, 'debug').mockImplementation(() => {});
      registry.markDormant('lighting', 'operator', 'lighting is out of service');

      registry.report('lighting', 'healthy', 'Connected via WebSocket');

      const line = debugSpy.mock.calls.map(c => String(c[0])).join('\n');
      expect(line).toContain('lighting');
      expect(line).toContain('healthy');
      expect(line).toContain('operator');
      debugSpy.mockRestore();
    });

    it('isDormant is true and isHealthy is false while latched', () => {
      registry.report('lighting', 'healthy', 'up');
      registry.markDormant('lighting', 'profile', 'lighting is not installed tonight');

      expect(registry.isDormant('lighting')).toBe(true);
      expect(registry.isHealthy('lighting')).toBe(false);
      expect(registry.isDormant('vlc')).toBe(false);
      expect(registry.isDormant('nonexistent')).toBe(false);
    });

    it('clearDormant unlatches to down/"awaiting first check" and emits', () => {
      registry.markDormant('lighting', 'profile', 'lighting is not installed tonight');
      const handler = jest.fn();
      registry.on('health:changed', handler);

      registry.clearDormant('lighting');

      expect(registry.getStatus('lighting')).toEqual({
        status: 'down',
        message: 'awaiting first check',
        lastChecked: expect.any(Date),
      });
      expect(registry.getStatus('lighting').door).toBeUndefined();
      expect(registry.isDormant('lighting')).toBe(false);
      expect(handler).toHaveBeenCalledWith(expect.objectContaining({
        serviceId: 'lighting',
        status: 'down',
        previousStatus: 'dormant',
      }));
    });

    it('clearDormant on a non-dormant service does nothing', () => {
      registry.report('vlc', 'healthy', 'up');
      const handler = jest.fn();
      registry.on('health:changed', handler);

      registry.clearDormant('vlc');

      expect(registry.getStatus('vlc').status).toBe('healthy');
      expect(handler).not.toHaveBeenCalled();
    });

    it('getSnapshot carries door ONLY on dormant entries', () => {
      registry.markDormant('lighting', 'operator', 'lighting is out of service');
      registry.report('vlc', 'healthy', 'up');

      const snap = registry.getSnapshot();
      expect(snap.lighting.door).toBe('operator');
      expect(Object.prototype.hasOwnProperty.call(snap.vlc, 'door')).toBe(false);
    });

    it('reset() preserves dormant entries and still resets the others (Sm-4)', () => {
      registry.report('vlc', 'healthy', 'up');
      registry.markDormant('lighting', 'operator', 'lighting is out of service');

      registry.reset();

      expect(registry.getStatus('lighting')).toEqual({
        status: 'dormant',
        message: 'lighting is out of service',
        lastChecked: expect.any(Date),
        door: 'operator',
      });
      expect(registry.getStatus('vlc').status).toBe('down');
      expect(registry.getStatus('vlc').message).toBe('Reset');
    });

    it('markDormant refuses an unknown service id (warn, no state change)', () => {
      const logger = require('../../../src/utils/logger');
      const warnSpy = jest.spyOn(logger, 'warn').mockImplementation(() => {});
      const handler = jest.fn();
      registry.on('health:changed', handler);

      registry.markDormant('nonexistent', 'profile', 'nope');

      expect(warnSpy).toHaveBeenCalled();
      expect(handler).not.toHaveBeenCalled();
      expect(registry.getStatus('nonexistent')).toBeNull();
      warnSpy.mockRestore();
    });

    it('markDormant refuses an unknown door (warn, no state change)', () => {
      const logger = require('../../../src/utils/logger');
      const warnSpy = jest.spyOn(logger, 'warn').mockImplementation(() => {});
      const handler = jest.fn();
      registry.on('health:changed', handler);

      registry.markDormant('lighting', 'cosmic-ray', 'nope');

      expect(warnSpy).toHaveBeenCalled();
      expect(handler).not.toHaveBeenCalled();
      expect(registry.getStatus('lighting').status).toBe('down');
      expect(registry.isDormant('lighting')).toBe(false);
      warnSpy.mockRestore();
    });

    it('clearDormant refuses an unknown service id', () => {
      const logger = require('../../../src/utils/logger');
      const warnSpy = jest.spyOn(logger, 'warn').mockImplementation(() => {});
      registry.clearDormant('nonexistent');
      expect(warnSpy).toHaveBeenCalled();
      warnSpy.mockRestore();
    });

    it('report() still refuses `dormant` from a service (only markDormant latches)', () => {
      const handler = jest.fn();
      registry.on('health:changed', handler);

      registry.report('vlc', 'dormant', 'trying to latch itself');

      expect(handler).not.toHaveBeenCalled();
      expect(registry.getStatus('vlc').status).toBe('down');
    });
  });

  describe('display — the ninth service (P16)', () => {
    it('accepts a healthy report from the driver', () => {
      registry.report('display', 'healthy', 'kiosk launched');
      expect(registry.isHealthy('display')).toBe(true);
      expect(registry.getStatus('display').message).toBe('kiosk launched');
    });

    it('accepts a down report from the driver', () => {
      registry.report('display', 'down', 'kiosk launch failed');
      expect(registry.isHealthy('display')).toBe(false);
    });
  });

  describe('multiple services', () => {
    it('should track services independently', () => {
      registry.report('vlc', 'healthy');
      registry.report('music', 'down', 'No D-Bus');
      registry.report('lighting', 'healthy');
      registry.report('sound', 'healthy');

      expect(registry.isHealthy('vlc')).toBe(true);
      expect(registry.isHealthy('music')).toBe(false);
      expect(registry.isHealthy('lighting')).toBe(true);
      expect(registry.isHealthy('sound')).toBe(true);
      expect(registry.isHealthy('bluetooth')).toBe(false);
    });
  });
});
