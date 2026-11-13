'use strict';

/**
 * Block 2 T1a D7 — the ONE preflight evaluator (plan §3 pin P8), minimal
 * arm. Everything anyone asks about "will tonight work?" is one call: rows
 * quoting resolve()'s verdicts verbatim, a rollup, the `blocking` list the
 * session-start gate reads, and a `limits` block that says out loud what
 * this check does NOT verify. T1a builds the resolver rows, the service
 * arm, blocking, limits and getLast(); the resource/DNS/shell arms are T4's
 * and nothing here touches the network.
 */

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.join(__dirname, '..', '..', '..', '..');
const readJson = (...p) => JSON.parse(fs.readFileSync(path.join(...p), 'utf8'));

const packDir = (name) =>
  path.join(REPO_ROOT, 'backend', 'tests', 'e2e', 'fixtures', 'packs', name);
const profile = (name) => readJson(REPO_ROOT, 'backend', 'tests', 'e2e',
  'fixtures', 'profiles', name);

const ALN_DIR = path.join(REPO_ROOT, 'ALN-TokenData');
const ALN_FULL_KIT = readJson(REPO_ROOT, 'backend', 'config', 'profiles', 'aln-full-kit.json');

describe('preflightService.evaluate (T1a D7, pin P8)', () => {
  let preflightService, packService, profileService, registry;

  function pinPack(dir) {
    const read = (f) => readJson(dir, f);
    const manifest = read('pack-manifest.json');
    jest.spyOn(packService, 'getManifest').mockReturnValue(manifest);
    jest.spyOn(packService, 'getGameConfig').mockReturnValue(read('game.json'));
    jest.spyOn(packService, 'getCues').mockReturnValue(read('cues.json').cues);
    jest.spyOn(packService, 'getActivePackInfo').mockReturnValue({
      packId: manifest.packId, version: manifest.version, contentHash: manifest.contentHash,
    });
    return manifest;
  }

  function pinProfile(p) {
    jest.spyOn(profileService, 'getProfile').mockReturnValue(p);
    jest.spyOn(profileService, 'getProfileInfo').mockReturnValue(
      p ? { profileId: p.profileId, forPack: p.forPack } : null
    );
  }

  beforeEach(() => {
    jest.resetModules();
    packService = require('../../../src/services/packService');
    profileService = require('../../../src/services/profileService');
    registry = require('../../../src/services/serviceHealthRegistry');
    preflightService = require('../../../src/services/preflightService');
    preflightService._resetForTesting();
  });

  afterEach(() => jest.restoreAllMocks());

  describe('paper depth, toy pack, lighting not installed', () => {
    let ev;
    beforeEach(() => {
      pinPack(packDir('toy-heist'));
      pinProfile(profile('toy-dormant-lighting.json'));
      ev = preflightService.evaluate({ live: false });
    });

    it('carries the identity of what it evaluated', () => {
      expect(ev.profileId).toBe('toy-dormant-lighting');
      expect(ev.forPack).toBe('midnight-heist');
      expect(ev.packHash).toMatch(/^sha256:[0-9a-f]{64}$/);
      expect(ev.depth).toBe('paper');
      expect(typeof ev.computedAt).toBe('string');
      expect(new Date(ev.computedAt).toString()).not.toBe('Invalid Date');
    });

    it('rows quote resolve()\'s verdicts verbatim, keyed kind:id', () => {
      const lighting = ev.rows.find(r => r.id === 'endpoint:lighting.instruments');
      expect(lighting).toEqual({
        id: 'endpoint:lighting.instruments',
        kind: 'endpoint',
        verdict: 'dormant',
        depth: 'paper',
        reason: "'lighting.instruments' not installed tonight",
        severity: null,
        verbs: [],
      });
    });

    it('every lighting role row is dormant, none is a fault', () => {
      const roles = ev.rows.filter(r => r.kind.startsWith('lighting-role'));
      expect(roles.length).toBeGreaterThan(0);
      for (const r of roles) {
        expect({ id: r.id, verdict: r.verdict }).toEqual({ id: r.id, verdict: 'dormant' });
      }
      expect(ev.rows.some(r => r.verdict === 'fault')).toBe(false);
    });

    it('blocking is empty and mirrors the rollup', () => {
      expect(ev.blocking).toEqual([]);
      expect(ev.blocking).toEqual(ev.rollup.blocking);
      expect(ev.rollup.status).toBe('go-degraded');
      expect(ev.rollup.dormantNeeds).toContain('lighting.instruments');
    });

    it('limits is the fixed honesty block — what it checks and what it cannot', () => {
      expect(ev.limits).toEqual({
        verifies: [
          'pack needs against the profile (paper)',
          'service health (live)',
        ],
        cannotVerify: [
          'media files',
          'lighting scenes in Home Assistant',
          'audio sinks',
          'network',
          'host resources',
          'certificate',
        ],
        humanChecklist: [
          'speakers placed and powered',
          'TV on the right input',
          'tokens on set',
        ],
      });
      expect(Object.isFrozen(ev.limits)).toBe(true);
    });
  });

  describe('the require pack against the same profile', () => {
    it('rolls up no-go and blocking holds the one require reason', () => {
      pinPack(packDir('toy-heist-require'));
      pinProfile(profile('toy-dormant-lighting.json'));

      const ev = preflightService.evaluate({ live: false });

      expect(ev.rollup.status).toBe('no-go');
      expect(ev.blocking).toEqual([
        "required endpoint 'lighting.instruments' not installed at this venue",
      ]);
      const row = ev.rows.find(r => r.id === 'endpoint:lighting.instruments');
      expect(row.verdict).toBe('no-go');
      expect(row.severity).toBe('blocking');
    });
  });

  describe('live depth', () => {
    it('an operator-dormant service reads dormant with the operator wording', () => {
      pinPack(ALN_DIR);
      pinProfile(ALN_FULL_KIT);
      registry.markDormant('vlc', 'operator', 'vlc is out of service');

      const ev = preflightService.evaluate({ live: true });

      expect(ev.depth).toBe('live');
      const row = ev.rows.find(r => r.id === 'service:vlc');
      expect(row).toMatchObject({
        verdict: 'dormant', depth: 'live', reason: "'vlc' is out of service",
        severity: null,
      });
      registry.clearDormant('vlc');
    });

    it('a DOWN stack service is a fault whose severity is the pack\'s onAbsent', () => {
      pinPack(ALN_DIR);
      pinProfile(ALN_FULL_KIT);
      registry.report('music', 'down', 'MPD unreachable');

      const ev = preflightService.evaluate({ live: true });

      const row = ev.rows.find(r => r.id === 'service:music');
      expect(row).toMatchObject({ verdict: 'fault', depth: 'live', severity: 'degrade' });
      // a fault never blocks — only no-go does (P7)
      expect(ev.blocking).toEqual([]);
    });

    it('paper depth supplies no live facts at all', () => {
      pinPack(ALN_DIR);
      pinProfile(ALN_FULL_KIT);
      registry.report('music', 'down', 'MPD unreachable');

      const ev = preflightService.evaluate({ live: false });

      const row = ev.rows.find(r => r.id === 'service:music');
      expect(row).toMatchObject({ verdict: 'runs', depth: 'paper' });
    });
  });

  describe('getLast()', () => {
    it('is null before the first evaluation and the evaluation after it', () => {
      pinPack(packDir('toy-heist'));
      pinProfile(profile('toy-test-rig.json'));

      expect(preflightService.getLast()).toBeNull();
      const ev = preflightService.evaluate({ live: false });
      expect(preflightService.getLast()).toBe(ev);
    });
  });

  describe('degenerate inputs never throw', () => {
    it('no profile loaded still evaluates', () => {
      pinPack(packDir('toy-heist'));
      pinProfile(null);
      const ev = preflightService.evaluate({ live: false });
      expect(ev.profileId).toBeNull();
      expect(Array.isArray(ev.rows)).toBe(true);
    });
  });

  describe('PreflightNoGoError', () => {
    it('is a named Error carrying the blocking reasons', () => {
      const { PreflightNoGoError } = require('../../../src/services/preflightService');
      const err = new PreflightNoGoError(['a', 'b']);
      expect(err).toBeInstanceOf(Error);
      expect(err.name).toBe('PreflightNoGoError');
      expect(err.blocking).toEqual(['a', 'b']);
      expect(err.message).toContain('a; b');
    });
  });
});
