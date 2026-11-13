/**
 * CS.1 — the simulation-profile generator. The rung-1 environment's
 * installation profile, GENERATED from the pack needs list: every
 * declared lighting role binds to its witness scene
 * (scene.witness_<role>), and the endpoints the harness actually
 * provides are declared (display.main via VLC's dummy output).
 * CONTEXT.md: "Environment ladder / rung", "Witness lights".
 *
 * Block 2 T1b (D7): the pinned C1 §1 endpoints interior means the
 * generator must emit STAND-IN VALUES, not a `provider` field
 * (schema-illegal under D1) — `display.main.output: 'rung1-xvfb'`,
 * sinks `rung1_hdmi`/`rung1_bt`, `lighting.instruments.provider:
 * 'home-assistant'`, and a `stations`/`personal` shape taken from the
 * manifest's `hardware` (3rd argument) when the pack names those
 * families. Two checks added here: the generated profile for BOTH
 * packs validates against the D1 schema, and `dormantServicesFor`
 * (D6) finds nothing dormant for either.
 */

const fs = require('fs');
const path = require('path');
const Ajv2020 = require('ajv/dist/2020');
const { collectPackNeeds } = require('../../../src/gameRules/packNeeds');
const { resolve } = require('../../../src/gameRules/resolution');
const { dormantServicesFor } = require('../../../src/gameRules/endpointServices');
const {
  generateSimulationProfile,
} = require('../../../scripts/lib/simulationProfile');

const REPO_ROOT = path.join(__dirname, '..', '..', '..', '..');
const SCHEMA_PATH = path.join(
  REPO_ROOT, 'backend', 'config', 'profiles', 'installation-profile.schema.json'
);

function loadPack(dir) {
  const read = (f) =>
    JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
  return {
    game: read('game.json'),
    cues: read('cues.json'),
    manifest: read('pack-manifest.json'),
  };
}

describe('generateSimulationProfile', () => {
  const alnNeeds = collectPackNeeds(
    loadPack(path.join(REPO_ROOT, 'ALN-TokenData'))
  );
  const profile = generateSimulationProfile(alnNeeds, 'about-last-night');

  it('binds every declared lighting role to its witness scene', () => {
    const lighting = profile.bindings.lighting;
    expect(Object.keys(lighting).sort()).toEqual([
      'blackout', 'gameplay', 'police-arrival-1', 'police-arrival-2',
      'police-arrival-3', 'police-glitch', 'video-playback',
    ]);
    expect(lighting['police-arrival-2'].ha)
      .toBe('scene.witness_police_arrival_2');
  });

  it('declares the endpoints the harness provides', () => {
    expect(profile.endpoints['display.main']).toBeDefined();
  });

  it('the generated profile resolves the ALN pack with NO no-go and NO dormant', () => {
    // The whole point of the simulation profile: on rung 1 the full
    // show logic runs — nothing the pack needs is missing.
    const { verdicts, rollup } = resolve(alnNeeds, profile);
    expect(rollup.status).not.toBe('no-go');
    const dormant = verdicts.filter((v) => v.verdict === 'dormant');
    expect(dormant).toEqual([]);
  });

  it('declares the display.main stand-in as a VALUE, never a provider field (D1 forbids it)', () => {
    expect(profile.endpoints['display.main']).toEqual({
      installed: true, output: 'rung1-xvfb',
    });
  });

  it('declares both rung1 sinks installed', () => {
    expect(profile.endpoints['audio.sinks']).toEqual([
      { id: 'rung1_hdmi', installed: true },
      { id: 'rung1_bt', installed: true },
    ]);
  });
});

describe('generateSimulationProfile — D1 schema + D6 dormancy, both packs (D7)', () => {
  let validate;

  beforeAll(() => {
    const ajv = new Ajv2020({ allErrors: true, strict: true });
    validate = ajv.compile(JSON.parse(fs.readFileSync(SCHEMA_PATH, 'utf8')));
  });

  const packDescriptors = [
    { name: 'about-last-night', dir: path.join(REPO_ROOT, 'ALN-TokenData') },
    {
      name: 'midnight-heist',
      dir: path.join(REPO_ROOT, 'backend', 'tests', 'e2e', 'fixtures', 'packs', 'toy-heist'),
    },
  ];

  // Precomputed once per pack (a plain .map, not a loop-declared test
  // function) so it.each names each pack's own test without tripping
  // no-loop-func.
  const cases = packDescriptors.map(({ name, dir }) => {
    const pack = loadPack(dir);
    const needs = collectPackNeeds(pack);
    const generated = generateSimulationProfile(needs, pack.manifest.packId, pack.manifest.hardware);
    return [name, pack.manifest, generated];
  });

  it.each(cases)('%s: the generated profile validates against the D1 pinned schema', (name, manifest, generated) => {
    const ok = validate(generated);
    if (!ok) {
      throw new Error(`violations:\n  ${(validate.errors || [])
        .map((e) => `${e.instancePath || '(root)'}: ${e.message}`).join('\n  ')}`);
    }
  });

  it.each(cases)('%s: dormantServicesFor(manifest, generated) is {} — rung 1 is never dormant', (name, manifest, generated) => {
    expect(dormantServicesFor(manifest, generated)).toEqual({});
  });
});

describe('generateSimulationProfile — stations/personal stand-ins from the manifest hardware arg (D7)', () => {
  it('declares stations.count from the manifest station deviceClass recommended value', () => {
    const needs = [{ kind: 'endpoint', id: 'stations' }];
    const hardware = { deviceClasses: [{ class: 'station', min: 0, recommended: 5 }] };
    const profile = generateSimulationProfile(needs, 'p', hardware);
    expect(profile.endpoints.stations).toEqual({ count: 5 });
  });

  it('falls back to min, then to 0, when recommended is absent', () => {
    const needs = [{ kind: 'endpoint', id: 'stations' }];
    expect(generateSimulationProfile(needs, 'p', {
      deviceClasses: [{ class: 'station', min: 2 }],
    }).endpoints.stations).toEqual({ count: 2 });
    expect(generateSimulationProfile(needs, 'p', {}).endpoints.stations)
      .toEqual({ count: 0 });
    expect(generateSimulationProfile(needs, 'p').endpoints.stations)
      .toEqual({ count: 0 });
  });

  it('declares personal.expected: false', () => {
    const needs = [{ kind: 'endpoint', id: 'personal' }];
    expect(generateSimulationProfile(needs, 'p').endpoints.personal)
      .toEqual({ expected: false });
  });

  it('throws on an unknown endpoint family need', () => {
    const needs = [{ kind: 'endpoint', id: 'stage.fog' }];
    expect(() => generateSimulationProfile(needs, 'p'))
      .toThrow(/unknown equipment family 'stage\.fog'/);
  });
});
