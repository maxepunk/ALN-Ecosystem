'use strict';

/**
 * Block 2 T1a D1 — the ONE wording helper for a dormant service's door.
 * Every backend message that names why a service is dormant is built from
 * it, so the operator hears the same two sentences everywhere (executor
 * refusal, cue refusal, registry message, renderer summary).
 */

const { doorWording } = require('../../../src/services/dormancyWording');

describe('doorWording', () => {
  it('profile → "not installed tonight"', () => {
    expect(doorWording('profile')).toBe('not installed tonight');
  });

  it('operator → "out of service"', () => {
    expect(doorWording('operator')).toBe('out of service');
  });

  it('throws on anything else — there are exactly two doors', () => {
    expect(() => doorWording('cosmic-ray')).toThrow();
    expect(() => doorWording(undefined)).toThrow();
    expect(() => doorWording(null)).toThrow();
    expect(() => doorWording('')).toThrow();
  });
});
