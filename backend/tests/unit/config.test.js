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
