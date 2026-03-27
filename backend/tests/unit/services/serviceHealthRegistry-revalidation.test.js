'use strict';

// Mock services with checkHealth/checkConnection
const mockServices = {
  vlc: { checkConnection: jest.fn().mockResolvedValue(true) },
  spotify: { checkConnection: jest.fn().mockResolvedValue(true) },
  sound: { checkHealth: jest.fn().mockResolvedValue(true) },
  bluetooth: { checkHealth: jest.fn().mockResolvedValue(true) },
  audio: { checkHealth: jest.fn().mockResolvedValue(true) },
  lighting: { checkConnection: jest.fn().mockResolvedValue(true) },
};

describe('ServiceHealthRegistry - Proactive Revalidation', () => {
  let registry;

  beforeEach(() => {
    jest.useFakeTimers();
    // Clear all mock call counts before each test
    for (const svc of Object.values(mockServices)) {
      for (const fn of Object.values(svc)) {
        fn.mockClear();
      }
    }
    // Fresh registry for each test (bypass singleton)
    jest.isolateModules(() => {
      registry = require('../../../src/services/serviceHealthRegistry');
    });
  });

  afterEach(() => {
    registry.stopRevalidation();
    jest.useRealTimers();
  });

  it('should call health checks for all registered services', async () => {
    registry.startRevalidation(mockServices, 15000);
    // advanceTimersByTimeAsync advances time AND flushes async callbacks (one interval tick)
    await jest.advanceTimersByTimeAsync(15000);

    expect(mockServices.vlc.checkConnection).toHaveBeenCalled();
    expect(mockServices.spotify.checkConnection).toHaveBeenCalled();
    expect(mockServices.sound.checkHealth).toHaveBeenCalled();
    expect(mockServices.bluetooth.checkHealth).toHaveBeenCalled();
    expect(mockServices.audio.checkHealth).toHaveBeenCalled();
    expect(mockServices.lighting.checkConnection).toHaveBeenCalled();
  });

  it('should not crash when a health check throws', async () => {
    mockServices.audio.checkHealth.mockRejectedValueOnce(new Error('pactl timeout'));
    registry.startRevalidation(mockServices, 15000);
    // Should not throw — errors are caught per-service
    await jest.advanceTimersByTimeAsync(15000);
  });

  it('should stop revalidation', () => {
    registry.startRevalidation(mockServices, 15000);
    registry.stopRevalidation();
    jest.advanceTimersByTime(30000);
    // No calls after stop
    expect(mockServices.vlc.checkConnection).not.toHaveBeenCalled();
  });

  it('should stop previous timer when startRevalidation is called again', async () => {
    registry.startRevalidation(mockServices, 15000);
    registry.startRevalidation(mockServices, 15000); // Should stop previous and start fresh
    jest.advanceTimersByTime(15000);
    await Promise.resolve();
    // Each service should only be called once (not twice)
    expect(mockServices.vlc.checkConnection).toHaveBeenCalledTimes(1);
  });

  it('should stop revalidation when reset() is called', () => {
    registry.startRevalidation(mockServices, 15000);
    registry.reset();
    jest.advanceTimersByTime(30000);
    expect(mockServices.vlc.checkConnection).not.toHaveBeenCalled();
  });
});
