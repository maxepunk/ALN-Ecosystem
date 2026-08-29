/**
 * Installation-Profile Schema Contract (Phase 3, A3 slice 4 S1)
 *
 * The installation profile is the venue document (C1, ratified
 * 2026-08-22): what is INSTALLED tonight and how the pack's abstract
 * names bind to physical things. It is ENGINE-side config, never pack
 * content — homed at backend/config/profiles/ (owner answer OQ6), loaded
 * by profileService (S3) through the PROFILE_PATH seam.
 *
 * Design docs: docs/plans/2026-07-09-phase3-1-installation-profile.md
 * (C1 §1 — the ratified shape this schema encodes),
 * docs/plans/2026-08-29-phase3-a3-slice4-showcontrol-pack.md (D-4.2).
 */

const fs = require('fs');
const path = require('path');
const Ajv2020 = require('ajv/dist/2020');

const SCHEMA_PATH = path.resolve(
  __dirname, '../../../config/profiles/installation-profile.schema.json'
);

// The C1 §1 annotated example (comments stripped) — the ratified shape
// is the green fixture, so the schema can never drift from the design
// doc without this suite noticing.
const c1Example = () => ({
  kind: 'installation-profile',
  schemaVersion: 1,
  profileId: 'vfw-hall-full-rig',
  label: 'VFW Hall — full kit',
  version: 3,
  forPack: 'about-last-night',
  network: {
    mode: 'kit-network',
    kitNetwork: {
      ssid: 'ALN-GAME',
      orchestratorIp: '10.11.0.2',
      orchestratorName: 'play.aboutlastnightgame.com',
      localDnsOverride: true,
    },
  },
  orchestrator: true,
  endpoints: {
    'display.main': { installed: true, output: 'hdmi-0' },
    'audio.sinks': [
      { id: 'hdmi', installed: true },
      { id: 'bt-mainhall', installed: true, btAddress: 'AA:BB:CC:DD:EE:FF', label: 'Main hall speaker' },
    ],
    'lighting.instruments': { installed: true, provider: 'home-assistant' },
    stations: { count: 3 },
    personal: { expected: true },
  },
  bindings: {
    lighting: {
      preshow: { ha: 'scene.preshow_warm' },
      reveal: { ha: 'scene.reveal_strobe' },
      blackout: { ha: 'scene.all_off' },
      finale: { ha: 'scene.finale_gold' },
    },
  },
  audio: {
    routes: { video: 'hdmi', music: 'bt-mainhall', sound: 'hdmi' },
    ducking: [
      { when: 'video', duck: 'music', to: 20 },
      { when: 'sound', duck: 'music', to: 40 },
    ],
  },
  env: {
    HOME_ASSISTANT_URL: 'http://localhost:8123',
    VIDEO_DIR: null,
  },
});

describe('installation-profile schema contract (C1 §1, slice 4 S1)', () => {
  let validate;

  beforeAll(() => {
    const ajv = new Ajv2020({ allErrors: true, strict: true });
    validate = ajv.compile(JSON.parse(fs.readFileSync(SCHEMA_PATH, 'utf8')));
  });

  const explain = () => (validate.errors || [])
    .map(e => `${e.instancePath || '(root)'}: ${e.message}`)
    .join('\n  ');

  it('the ratified C1 §1 example validates', () => {
    if (!validate(c1Example())) throw new Error(`violations:\n  ${explain()}`);
  });

  it('a minimal profile validates (kind + schemaVersion + profileId; the harness needs small test profiles)', () => {
    const minimal = {
      kind: 'installation-profile',
      schemaVersion: 1,
      profileId: 'toy-test-rig',
    };
    if (!validate(minimal)) throw new Error(`violations:\n  ${explain()}`);
  });

  describe('refusal twins', () => {
    const mutate = (fn) => {
      const doc = c1Example();
      fn(doc);
      return validate(doc);
    };

    it('wrong kind and wrong schemaVersion are refused', () => {
      expect(mutate(d => { d.kind = 'preset'; })).toBe(false);
      expect(mutate(d => { d.schemaVersion = 2; })).toBe(false);
    });

    it('a missing or malformed profileId is refused', () => {
      expect(mutate(d => { delete d.profileId; })).toBe(false);
      expect(mutate(d => { d.profileId = 'VFW Hall!'; })).toBe(false);
    });

    it('a lighting binding without an ha scene id is refused (v1 drives ha only; WLED is schema-evolution headroom)', () => {
      expect(mutate(d => { d.bindings.lighting.preshow = {}; })).toBe(false);
      expect(mutate(d => { d.bindings.lighting.preshow = { wled: 'preset-3' }; })).toBe(false);
    });

    it('a binding key outside the role-name convention is refused', () => {
      expect(mutate(d => { d.bindings.lighting['Pre Show'] = { ha: 'scene.x' }; })).toBe(false);
    });

    it('an unknown network mode is refused', () => {
      expect(mutate(d => { d.network.mode = 'hotel-wifi'; })).toBe(false);
    });

    it('a non-integer version is refused (bumped on every save, F-TOOL-12)', () => {
      expect(mutate(d => { d.version = '3'; })).toBe(false);
    });

    it('a ducking rule missing its target volume is refused', () => {
      expect(mutate(d => { d.audio.ducking[0] = { when: 'video', duck: 'music' }; })).toBe(false);
    });

    it('unknown top-level keys are refused (typo catch; the root key set is the ratified C1 shape)', () => {
      expect(mutate(d => { d.binding = d.bindings; })).toBe(false);
    });
  });
});
