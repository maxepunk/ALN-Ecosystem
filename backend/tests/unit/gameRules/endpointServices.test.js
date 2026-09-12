/**
 * gameRules/endpointServices.js — equipment families -> the services
 * that exist only to drive them (Block 2 T1b, plan §3 pin P1).
 *
 * Pure module; no I/O of its own. This suite loads the REAL manifests
 * and profiles by path (the dual-pack rule this repo builds under) so
 * expectations track actual pack/profile content, plus synthetic
 * fixtures for the family-shape edge cases the real files don't
 * exercise (e.g. a partially-installed audio.sinks array).
 */

const fs = require('fs');
const path = require('path');
const {
  ENDPOINT_FAMILIES,
  servicesForFamily,
  dormantServicesFor,
  familyInstalled,
} = require('../../../src/gameRules/endpointServices');

const REPO_ROOT = path.join(__dirname, '..', '..', '..', '..');
const readJson = (...parts) => JSON.parse(fs.readFileSync(path.join(...parts), 'utf8'));

const ALN_MANIFEST = readJson(REPO_ROOT, 'ALN-TokenData', 'pack-manifest.json');
const ALN_FULL_KIT = readJson(REPO_ROOT, 'backend', 'config', 'profiles', 'aln-full-kit.json');

const TOY_PACK_DIR = path.join(REPO_ROOT, 'backend', 'tests', 'e2e', 'fixtures', 'packs', 'toy-heist');
const TOY_MANIFEST = readJson(TOY_PACK_DIR, 'pack-manifest.json');

const PROFILE_DIR = path.join(REPO_ROOT, 'backend', 'tests', 'e2e', 'fixtures', 'profiles');
const TOY_TEST_RIG = readJson(PROFILE_DIR, 'toy-test-rig.json');
const TOY_DORMANT_LIGHTING = readJson(PROFILE_DIR, 'toy-dormant-lighting.json');

describe('ENDPOINT_FAMILIES (D6)', () => {
  it('is the frozen five-family C1 §1 list', () => {
    expect(ENDPOINT_FAMILIES).toEqual([
      'display.main', 'audio.sinks', 'lighting.instruments', 'stations', 'personal',
    ]);
    expect(Object.isFrozen(ENDPOINT_FAMILIES)).toBe(true);
  });
});

describe('servicesForFamily (D6)', () => {
  it('maps each physical family to the services that exist only to drive it', () => {
    expect(servicesForFamily('display.main')).toEqual(['vlc', 'display']);
    expect(servicesForFamily('lighting.instruments')).toEqual(['lighting']);
    expect(servicesForFamily('audio.sinks')).toEqual(['sound', 'music']);
    expect(servicesForFamily('stations')).toEqual([]);
    expect(servicesForFamily('personal')).toEqual([]);
  });

  it("throws on an unknown family id (the schema also refuses it; this keeps the map honest)", () => {
    expect(() => servicesForFamily('stage.fog')).toThrow(/unknown equipment family 'stage\.fog'/);
  });
});

describe('dormantServicesFor (D6)', () => {
  it('the real ALN pack against its full-kit profile: everything installed, nothing dormant', () => {
    expect(dormantServicesFor(ALN_MANIFEST, ALN_FULL_KIT)).toEqual({});
  });

  it('the real toy pack against its fully-equipped test rig: nothing dormant', () => {
    expect(dormantServicesFor(TOY_MANIFEST, TOY_TEST_RIG)).toEqual({});
  });

  it('the real toy pack against toy-dormant-lighting.json: exactly lighting dormant', () => {
    const result = dormantServicesFor(TOY_MANIFEST, TOY_DORMANT_LIGHTING);
    expect(Object.keys(result)).toEqual(['lighting']);
    expect(result.lighting.reason).toBe("'lighting.instruments' not installed tonight");
  });

  it('installed: false on lighting.instruments behaves the same as an absent declaration', () => {
    const manifest = { hardware: { endpoints: { 'lighting.instruments': { onAbsent: 'degrade' } } } };
    const profile = { endpoints: { 'lighting.instruments': { installed: false } } };
    expect(dormantServicesFor(manifest, profile)).toEqual({
      lighting: { reason: "'lighting.instruments' not installed tonight" },
    });
  });

  it('audio.sinks declared with none installed, but display.main IS installed: exactly sound and music', () => {
    const manifest = { hardware: { endpoints: { 'audio.sinks': { onAbsent: 'degrade' } } } };
    const profile = {
      endpoints: {
        'display.main': { installed: true, output: 'hdmi-0' },
        'audio.sinks': [{ id: 'hdmi', installed: false }],
      },
    };
    const result = dormantServicesFor(manifest, profile);
    expect(Object.keys(result).sort()).toEqual(['music', 'sound']);
    expect(result.sound.reason).toBe("'audio.sinks' not installed tonight");
    expect(result.music.reason).toBe("'audio.sinks' not installed tonight");
  });

  it('the same, but display.main is also absent: sound, music, AND audio (no display implies no HDMI sink)', () => {
    const manifest = { hardware: { endpoints: { 'audio.sinks': { onAbsent: 'degrade' } } } };
    const profile = { endpoints: { 'audio.sinks': [{ id: 'hdmi', installed: false }] } };
    const result = dormantServicesFor(manifest, profile);
    expect(Object.keys(result).sort()).toEqual(['audio', 'music', 'sound']);
    expect(result.audio.reason).toBe('no audio sink installed tonight and no display');
  });

  it('an audio.sinks family the profile omits entirely also counts as no sink installed', () => {
    const manifest = { hardware: { endpoints: { 'audio.sinks': { onAbsent: 'degrade' } } } };
    const profile = { endpoints: {} };
    const result = dormantServicesFor(manifest, profile);
    expect(Object.keys(result).sort()).toEqual(['audio', 'music', 'sound']);
  });

  it('bluetooth never appears, in any case — it is the adapter, a capability, never profile-dormant', () => {
    const manifest = {
      hardware: {
        endpoints: {
          'display.main': { onAbsent: 'degrade' },
          'audio.sinks': { onAbsent: 'degrade' },
          'lighting.instruments': { onAbsent: 'degrade' },
        },
      },
    };
    const profile = { endpoints: {} };
    const result = dormantServicesFor(manifest, profile);
    expect(result.bluetooth).toBeUndefined();
    expect(Object.keys(result).sort()).toEqual(['audio', 'display', 'lighting', 'music', 'sound', 'vlc']);
  });

  it('stations and personal uninstalled add nothing — they map to no service', () => {
    const manifest = {
      hardware: {
        endpoints: {
          stations: { onAbsent: 'degrade' },
          personal: { onAbsent: 'degrade' },
        },
      },
    };
    const profile = { endpoints: {} };
    expect(dormantServicesFor(manifest, profile)).toEqual({});
  });

  it('a manifest with no hardware.endpoints (or no hardware at all) resolves to {}', () => {
    expect(dormantServicesFor({}, { endpoints: {} })).toEqual({});
    expect(dormantServicesFor({ hardware: {} }, {})).toEqual({});
    expect(dormantServicesFor({ hardware: { endpoints: {} } }, {})).toEqual({});
  });

  it('a profile with no endpoints block at all treats every manifest-named family as uninstalled', () => {
    const manifest = { hardware: { endpoints: { 'lighting.instruments': { onAbsent: 'degrade' } } } };
    expect(dormantServicesFor(manifest, {})).toEqual({
      lighting: { reason: "'lighting.instruments' not installed tonight" },
    });
  });

  it('an equipment family the manifest names that is not one of the five throws (schema also refuses it)', () => {
    const manifest = { hardware: { endpoints: { 'stage.fog': { onAbsent: 'degrade' } } } };
    expect(() => dormantServicesFor(manifest, {})).toThrow(/unknown equipment family 'stage\.fog'/);
  });
});

// Block 2 T1a D3: the predicate dormantServicesFor already used privately,
// now exported so resolve() can ask the SAME question about a family
// instead of re-deriving "is this installed?" its own way (P2).
describe('familyInstalled(profile, familyId)', () => {
  it('an absent family is not installed', () => {
    expect(familyInstalled({ endpoints: {} }, 'lighting.instruments')).toBe(false);
  });

  it('an object family is installed only when installed === true', () => {
    expect(familyInstalled(
      { endpoints: { 'display.main': { installed: true } } }, 'display.main')).toBe(true);
    expect(familyInstalled(
      { endpoints: { 'display.main': { installed: false } } }, 'display.main')).toBe(false);
    expect(familyInstalled(
      { endpoints: { 'display.main': {} } }, 'display.main')).toBe(false);
  });

  it('audio.sinks is installed when SOME entry is installed', () => {
    const some = { endpoints: { 'audio.sinks': [
      { id: 'a', installed: false }, { id: 'b', installed: true },
    ] } };
    const none = { endpoints: { 'audio.sinks': [{ id: 'a', installed: false }] } };
    expect(familyInstalled(some, 'audio.sinks')).toBe(true);
    expect(familyInstalled(none, 'audio.sinks')).toBe(false);
    expect(familyInstalled({ endpoints: { 'audio.sinks': [] } }, 'audio.sinks')).toBe(false);
  });

  it('a profile with no endpoints block (or no profile) installs nothing', () => {
    expect(familyInstalled({}, 'lighting.instruments')).toBe(false);
    expect(familyInstalled(null, 'lighting.instruments')).toBe(false);
    expect(familyInstalled(undefined, 'display.main')).toBe(false);
  });

  it('agrees with the real toy profiles', () => {
    const rig = readJson(REPO_ROOT, 'backend', 'tests', 'e2e', 'fixtures',
      'profiles', 'toy-test-rig.json');
    const dormant = readJson(REPO_ROOT, 'backend', 'tests', 'e2e', 'fixtures',
      'profiles', 'toy-dormant-lighting.json');
    expect(familyInstalled(rig, 'lighting.instruments')).toBe(true);
    expect(familyInstalled(dormant, 'lighting.instruments')).toBe(false);
    expect(familyInstalled(dormant, 'audio.sinks')).toBe(true);
  });
});
