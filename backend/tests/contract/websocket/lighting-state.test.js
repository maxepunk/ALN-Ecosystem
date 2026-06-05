/**
 * Lighting service:state — contract guard (SR-1)
 * activeScene is a string entity_id (or null), NOT an object. Pins the wire
 * shape the GM Scanner EnvironmentRenderer must consume.
 */
const lightingService = require('../../../src/services/lightingService');

describe('lighting getState() activeScene shape (SR-1)', () => {
  it('returns activeScene as a string or null (never an object)', () => {
    const state = lightingService.getState();
    expect(state).toHaveProperty('activeScene');
    const t = typeof state.activeScene;
    expect(['string', 'object']).toContain(t); // object only when null
    if (state.activeScene !== null) {
      expect(typeof state.activeScene).toBe('string');
    }
  });

  it('reflects a set string entity_id', () => {
    lightingService._activeScene = 'scene.party';
    try {
      expect(lightingService.getState().activeScene).toBe('scene.party');
    } finally {
      lightingService._activeScene = null;
    }
  });
});
