/**
 * Tests for environment control config sections
 * (bluetooth, audio, lighting)
 */

describe('Environment Control Config', () => {
  it('should have bluetooth config with defaults', () => {
    const config = require('../../src/config');
    expect(config.bluetooth).toBeDefined();
    expect(config.bluetooth.scanTimeout).toBe(15);
    expect(config.bluetooth.connectTimeout).toBe(10);
  });

  it('should have audio config with defaults', () => {
    const config = require('../../src/config');
    expect(config.audio).toBeDefined();
    expect(config.audio.defaultOutput).toBe('hdmi');
  });

  it('should have lighting config with defaults', () => {
    const config = require('../../src/config');
    expect(config.lighting).toBeDefined();
    expect(config.lighting.enabled).toBe(true);
    expect(config.lighting.homeAssistantUrl).toBe('http://localhost:8123');
    expect(config.lighting).toHaveProperty('homeAssistantToken');
  });
});

describe('validateConfig error branches (A3 slice 2 coverage — config shrank when scoring moved to the pack)', () => {
  const reload = () => {
    jest.resetModules();
    return () => require('../../src/config');
  };
  const withEnv = (key, value, fn) => {
    const orig = process.env[key];
    process.env[key] = value;
    try { fn(); } finally {
      if (orig !== undefined) process.env[key] = orig; else delete process.env[key];
      jest.resetModules();
    }
  };

  it('rejects an invalid server port', () => {
    withEnv('PORT', '99999', () => {
      expect(reload()).toThrow(/Invalid server port/);
    });
  });

  it('rejects maxPlayers < 1', () => {
    withEnv('MAX_PLAYERS', '0', () => {
      expect(reload()).toThrow(/maxPlayers must be at least 1/);
    });
  });

  it('rejects maxGmStations < 1', () => {
    withEnv('MAX_GM_STATIONS', '0', () => {
      expect(reload()).toThrow(/maxGmStations must be at least 1/);
    });
  });

  it('rejects duplicateWindow < 1', () => {
    withEnv('DUPLICATE_WINDOW', '0', () => {
      expect(reload()).toThrow(/duplicateWindow must be at least 1 second/);
    });
  });
});
