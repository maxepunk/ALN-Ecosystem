/**
 * Unit tests: profileService (A3 slice 4 S3 — D-4.4)
 *
 * The installation profile is the venue document (C1): role → instrument
 * bindings and venue posture. profileService loads ONE profile at boot,
 * frozen (the packService template), through the PROFILE_PATH seam.
 * v1 reads kind/schemaVersion/profileId/forPack/bindings.lighting ONLY —
 * every other section passes through unread.
 *
 * The profile is VENUE config: a missing or malformed profile must
 * never kill the orchestrator (the degrade class, red-team G1/R2) — it
 * warns loudly and every role resolves as unbound.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

jest.mock('../../../src/utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

const logger = require('../../../src/utils/logger');
const profileService = require('../../../src/services/profileService');

// OQ1 (owner-answered 2026-08-29): the seven confirmed-live HA scene ids
// and their pack role names. The in-repo default profile must carry
// exactly these bindings — this test IS the drift pin.
const OQ1_TABLE = {
  gameplay: 'scene.game',
  'video-playback': 'scene.video',
  blackout: 'scene.off',
  'police-arrival-1': 'scene.police_1',
  'police-arrival-2': 'scene.police2',
  'police-arrival-3': 'scene.police3',
  'police-glitch': 'scene.policeglitch',
};

describe('profileService', () => {
  let tmpDir;
  const originalProfilePath = process.env.PROFILE_PATH;

  const writeProfile = (doc) => {
    const p = path.join(tmpDir, 'profile.json');
    fs.writeFileSync(p, typeof doc === 'string' ? doc : JSON.stringify(doc));
    return p;
  };

  const minimalProfile = (overrides = {}) => ({
    kind: 'installation-profile',
    schemaVersion: 1,
    profileId: 'unit-rig',
    bindings: { lighting: { gameplay: { ha: 'scene.unit_game' } } },
    ...overrides,
  });

  beforeEach(() => {
    profileService._resetForTesting();
    jest.clearAllMocks();
    delete process.env.PROFILE_PATH;
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aln-profsvc-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    if (originalProfilePath === undefined) {
      delete process.env.PROFILE_PATH;
    } else {
      process.env.PROFILE_PATH = originalProfilePath;
    }
    profileService._resetForTesting();
  });

  describe('getProfilePath', () => {
    it('defaults to the in-repo ALN full-kit profile (OQ6 home)', () => {
      expect(profileService.getProfilePath()).toBe(
        path.resolve(__dirname, '../../../config/profiles/aln-full-kit.json')
      );
    });

    it('PROFILE_PATH overrides the default and warns LOUDLY exactly once', () => {
      const p = writeProfile(minimalProfile());
      process.env.PROFILE_PATH = p;
      expect(profileService.getProfilePath()).toBe(path.resolve(p));
      expect(profileService.getProfilePath()).toBe(path.resolve(p));
      const overrideWarns = logger.warn.mock.calls.filter(([msg]) =>
        msg.includes('PROFILE_PATH override ACTIVE')
      );
      expect(overrideWarns).toHaveLength(1);
    });
  });

  describe('the in-repo default profile (the real venue document)', () => {
    it('binds ALL SEVEN OQ1 roles to the confirmed HA scene ids', () => {
      profileService.activateProfile();
      for (const [role, sceneId] of Object.entries(OQ1_TABLE)) {
        expect(profileService.getLightingBinding(role)).toBe(sceneId);
      }
    });

    it('reports its identity (profileId, forPack)', () => {
      profileService.activateProfile();
      const info = profileService.getProfileInfo();
      expect(info.profileId).toBe('aln-full-kit');
      expect(info.forPack).toBe('about-last-night');
    });
  });

  describe('activation freeze (packService template)', () => {
    it('a profile edited on disk after activation is ignored for the process lifetime', () => {
      const p = writeProfile(minimalProfile());
      process.env.PROFILE_PATH = p;
      profileService.activateProfile();
      expect(profileService.getLightingBinding('gameplay')).toBe('scene.unit_game');

      writeProfile(minimalProfile({
        bindings: { lighting: { gameplay: { ha: 'scene.EDITED' } } },
      }));
      expect(profileService.getLightingBinding('gameplay')).toBe('scene.unit_game');
    });

    it('before activation, reads fall through to live disk (selective-init harnesses)', () => {
      const p = writeProfile(minimalProfile());
      process.env.PROFILE_PATH = p;
      expect(profileService.getLightingBinding('gameplay')).toBe('scene.unit_game');
    });
  });

  describe('post-activation disk drift (packService parity)', () => {
    it('warns ONCE when the profile changes on disk after activation — never a silent no-op', () => {
      const p = writeProfile(minimalProfile());
      process.env.PROFILE_PATH = p;
      profileService.activateProfile();
      jest.clearAllMocks();

      fs.writeFileSync(p, JSON.stringify(minimalProfile({ label: 'edited' })));
      const bumped = Math.floor(Date.now() / 1000) + 120;
      fs.utimesSync(p, bumped, bumped);

      profileService.getProfile();
      profileService.getProfile();
      const driftWarns = logger.warn.mock.calls.filter(([msg]) =>
        msg.includes('changed on disk after activation')
      );
      expect(driftWarns).toHaveLength(1);
      // The frozen snapshot is still served
      expect(profileService.getProfile().label).not.toBe('edited');
    });
  });

  describe('getLightingBinding', () => {
    it('an unbound role resolves null; a prototype-chain name resolves null (C11 class)', () => {
      const p = writeProfile(minimalProfile());
      process.env.PROFILE_PATH = p;
      profileService.activateProfile();
      expect(profileService.getLightingBinding('disco-mode')).toBeNull();
      expect(profileService.getLightingBinding('constructor')).toBeNull();
    });

    it('a binding with a non-ha provider resolves null (v1 drives ha only — D-4.5 skip clause)', () => {
      const p = writeProfile(minimalProfile({
        bindings: { lighting: { gameplay: { wled: 'preset-3' } } },
      }));
      process.env.PROFILE_PATH = p;
      profileService.activateProfile();
      expect(profileService.getLightingBinding('gameplay')).toBeNull();
    });
  });

  describe('degrade class: a broken venue profile never kills the boot', () => {
    it('a missing profile file warns and activates with every role unbound', () => {
      process.env.PROFILE_PATH = path.join(tmpDir, 'nope.json');
      expect(() => profileService.activateProfile()).not.toThrow();
      expect(profileService.getProfile()).toBeNull();
      expect(profileService.getLightingBinding('gameplay')).toBeNull();
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Installation profile unreadable')
      );
    });

    it('malformed JSON warns and resolves as absent', () => {
      process.env.PROFILE_PATH = writeProfile('{nope');
      expect(() => profileService.activateProfile()).not.toThrow();
      expect(profileService.getProfile()).toBeNull();
    });

    it('a wrong kind or schemaVersion warns and resolves as absent (a typo must not silently half-bind)', () => {
      process.env.PROFILE_PATH = writeProfile(minimalProfile({ kind: 'preset' }));
      expect(() => profileService.activateProfile()).not.toThrow();
      expect(profileService.getProfile()).toBeNull();

      profileService._resetForTesting();
      jest.clearAllMocks();
      process.env.PROFILE_PATH = writeProfile(minimalProfile({ schemaVersion: 2 }));
      expect(() => profileService.activateProfile()).not.toThrow();
      expect(profileService.getProfile()).toBeNull();
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('schemaVersion')
      );
    });
  });
});
