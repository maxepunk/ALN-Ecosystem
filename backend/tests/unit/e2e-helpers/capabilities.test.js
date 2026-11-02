'use strict';

/**
 * Block 2 T1a D12 — the E2E capability gates learn the third word.
 *
 * A capability that is DORMANT is absent BY DESIGN: the profile did not
 * install its equipment. Skipping is right; skipping with the message
 * "missing on this environment" is not — it reads as a broken test machine
 * and sends whoever reads the CI log hunting a fault that does not exist.
 * And a dormant key must NOT satisfy a designed-degradation test: those
 * tests exist to exercise the DOWN path, and a venue that never installed
 * the equipment cannot exercise it.
 */

const {
  CAPABILITY_KEYS,
  requireCapabilities,
  requireDegraded,
  requireDormant,
} = require('../../e2e/helpers/capabilities');

/** A stand-in for Playwright's `test` object: records skip(cond, reason). */
function fakeTest() {
  const calls = [];
  return { skip: (cond, reason) => calls.push({ cond, reason }), calls };
}

/** Build a caps object the way getCapabilities() does. */
function caps(statuses, doors = {}) {
  const out = { _health: {}, _status: {}, _door: {} };
  for (const key of CAPABILITY_KEYS) {
    const status = statuses[key] || 'healthy';
    out[key] = status === 'healthy';
    out._status[key] = status;
    out._door[key] = doors[key];
    out._health[key] = { status, ...(doors[key] ? { door: doors[key] } : {}) };
  }
  return out;
}

describe('CAPABILITY_KEYS', () => {
  it('includes display — the ninth service (P16)', () => {
    expect(CAPABILITY_KEYS).toContain('display');
  });
});

describe('requireCapabilities', () => {
  it('does not skip when everything asked for is healthy', () => {
    const t = fakeTest();
    requireCapabilities(t, caps({}), ['vlc', 'lighting']);
    expect(t.calls[0].cond).toBe(false);
  });

  it('skips with the DORMANT wording when every missing key is dormant', () => {
    const t = fakeTest();
    requireCapabilities(t, caps({ lighting: 'dormant' }, { lighting: 'profile' }), ['vlc', 'lighting']);
    expect(t.calls[0].cond).toBe(true);
    expect(t.calls[0].reason).toBe('dormant (not installed in this profile): [lighting]');
  });

  it('keeps the existing wording when any missing key is genuinely DOWN', () => {
    const t = fakeTest();
    requireCapabilities(t, caps({ lighting: 'dormant', vlc: 'down' }, { lighting: 'profile' }),
      ['vlc', 'lighting']);
    expect(t.calls[0].cond).toBe(true);
    expect(t.calls[0].reason).toMatch(/missing: \[vlc, lighting\]/);
    expect(t.calls[0].reason).not.toMatch(/dormant/);
  });
});

describe('requireDegraded', () => {
  it('skips when everything is healthy — there is no degradation to exercise', () => {
    const t = fakeTest();
    requireDegraded(t, caps({}), ['vlc']);
    expect(t.calls[0].cond).toBe(true);
  });

  it('runs when a key is DOWN', () => {
    const t = fakeTest();
    requireDegraded(t, caps({ vlc: 'down' }), ['vlc']);
    expect(t.calls[0].cond).toBe(false);
  });

  it('SKIPS when the only absent key is dormant — dormant is not degraded', () => {
    const t = fakeTest();
    requireDegraded(t, caps({ vlc: 'dormant' }, { vlc: 'profile' }), ['vlc']);
    expect(t.calls[0].cond).toBe(true);
    expect(t.calls[0].reason).toMatch(/dormant/);
  });
});

describe('requireDormant', () => {
  it('runs only when EVERY named key is dormant', () => {
    const t = fakeTest();
    requireDormant(t, caps({ lighting: 'dormant' }, { lighting: 'profile' }), ['lighting']);
    expect(t.calls[0].cond).toBe(false);
  });

  it('skips when a named key is healthy', () => {
    const t = fakeTest();
    requireDormant(t, caps({}), ['lighting']);
    expect(t.calls[0].cond).toBe(true);
    expect(t.calls[0].reason).toMatch(/lighting:healthy/);
  });

  it('skips when a named key is down rather than dormant', () => {
    const t = fakeTest();
    requireDormant(t, caps({ lighting: 'down' }), ['lighting']);
    expect(t.calls[0].cond).toBe(true);
    expect(t.calls[0].reason).toMatch(/lighting:down/);
  });
});
