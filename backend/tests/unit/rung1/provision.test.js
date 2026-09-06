/**
 * Pure decision seams of the shared rung-1 provisioning module
 * (fix-vehicle S5 revision, design: 2026-09-05-train-fix-vehicle.md
 * §8.1). The daemon arms are proven by the rig re-run and the E2E
 * legs; what is unit-tested here is every decision the module makes
 * WITHOUT touching the machine:
 *
 * - harnessProvides(profile): the provisioning GATE. The harness may
 *   manufacture fake physics only for a run whose profile assigns
 *   stand-ins to it (provider "rung1-harness"). A real venue profile
 *   — or a missing/broken one — provisions NOTHING.
 * - decideHaContainerAction(psText): the container-lifecycle fix.
 *   The first S5 build checked `docker ps` (running only), so a
 *   STOPPED rung1-ha was invisible and `docker run` died on the name
 *   conflict. The decision is now pure and covers all states.
 * - unionNeeds(lists): one witness Home Assistant serves BOTH
 *   dual-pack legs, so its config is generated from the union of the
 *   packs' needs.
 */

const fs = require('fs');
const path = require('path');
const {
  harnessProvides,
  decideHaContainerAction,
  unionNeeds,
} = require('../../rung1/provision');

const BACKEND = path.resolve(__dirname, '../../..');

describe('harnessProvides (the provisioning gate)', () => {
  const simulationShape = {
    kind: 'installation-profile',
    profileId: 'rung1-simulation',
    endpoints: { 'display.main': { provider: 'rung1-harness' } },
    bindings: { lighting: {}, surfaces: {} },
  };

  it('is true for a profile that assigns an endpoint to the harness', () => {
    expect(harnessProvides(simulationShape)).toBe(true);
  });

  it('is true for the profile the generator actually emits', () => {
    const { generateSimulationProfile } = require('../../../scripts/lib/simulationProfile');
    const needs = [
      { kind: 'lighting-role', id: 'gameplay' },
      { kind: 'endpoint', id: 'display.main' },
    ];
    expect(harnessProvides(generateSimulationProfile(needs, 'p'))).toBe(true);
  });

  it('is false for the real ALN full-kit profile (venue-machine safety)', () => {
    const real = JSON.parse(fs.readFileSync(path.join(BACKEND, 'config/profiles/aln-full-kit.json'), 'utf8'));
    expect(harnessProvides(real)).toBe(false);
  });

  it('is true for a profile whose BINDINGS point at harness stand-ins '
     + '(the ratified definition — the toy pack declares no endpoint '
     + 'needs, so its simulation profile has no provider entry)', () => {
    const { generateSimulationProfile } = require('../../../scripts/lib/simulationProfile');
    const toyShaped = generateSimulationProfile([{ kind: 'lighting-role', id: 'vault-alarm' }], 'midnight-heist');
    expect(toyShaped.endpoints).toEqual({}); // the trap
    expect(harnessProvides(toyShaped)).toBe(true); // the fix
    expect(harnessProvides({
      bindings: { surfaces: { 'toy-idle': { file: 'toy-idle-sim.mp4' } } },
    })).toBe(true);
  });

  it('is false — the safe default — for missing or broken profiles', () => {
    expect(harnessProvides(null)).toBe(false);
    expect(harnessProvides(undefined)).toBe(false);
    expect(harnessProvides('not an object')).toBe(false);
    expect(harnessProvides({})).toBe(false);
    expect(harnessProvides({ endpoints: null })).toBe(false);
    expect(harnessProvides({ endpoints: { a: { provider: 'real-vendor' } } }))
      .toBe(false);
  });
});

describe('decideHaContainerAction (container lifecycle, all states)', () => {
  const ps = rows => `${rows.map(r => r.join('\t')).join('\n')}\n`;

  it('creates when no rung1-ha container exists in any state', () => {
    expect(decideHaContainerAction('')).toBe('create');
    expect(decideHaContainerAction(ps([['other-app', 'running']])))
      .toBe('create');
  });

  it('adopts a running container', () => {
    expect(decideHaContainerAction(ps([['rung1-ha', 'running']])))
      .toBe('adopt');
  });

  it('starts a stopped container instead of recreating it (the S5 bug)', () => {
    expect(decideHaContainerAction(ps([['rung1-ha', 'exited']])))
      .toBe('start');
    expect(decideHaContainerAction(ps([['rung1-ha', 'created']])))
      .toBe('start');
  });

  it('matches the exact name only — a prefix cousin is not ours', () => {
    expect(decideHaContainerAction(ps([['rung1-ha-old', 'exited']])))
      .toBe('create');
  });
});

describe('unionNeeds (one witness HA for both dual-pack legs)', () => {
  it('merges needs lists, deduplicating by kind + id', () => {
    const aln = [
      { kind: 'lighting-role', id: 'gameplay' },
      { kind: 'lighting-role', id: 'blackout' },
      { kind: 'surface-channel', id: 'aln-idle' },
    ];
    const toy = [
      { kind: 'lighting-role', id: 'gameplay' }, // shared name
      { kind: 'lighting-role', id: 'heist-alarm' },
    ];
    const union = unionNeeds([aln, toy]);
    const roles = union.filter(n => n.kind === 'lighting-role')
      .map(n => n.id);
    expect(roles).toEqual(['gameplay', 'blackout', 'heist-alarm']);
    expect(union.filter(n => n.kind === 'surface-channel'))
      .toHaveLength(1);
  });

  it('keeps kinds apart — same id under different kinds is two needs', () => {
    const union = unionNeeds([
      [{ kind: 'lighting-role', id: 'main' }],
      [{ kind: 'surface-channel', id: 'main' }],
    ]);
    expect(union).toHaveLength(2);
  });
});
