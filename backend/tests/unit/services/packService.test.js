/**
 * Unit tests: packService (Phase 3 A2 — the active game pack directory)
 *
 * Covers: PACK_PATH override + loud warn-once, manifest mtime cache,
 * activation snapshot semantics (identity frozen at boot; disk drift
 * loud-warned; pre-pack null stays null), and resolvePackFile whitelist
 * + traversal containment.
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
const packService = require('../../../src/services/packService');

const TOY_PACK = path.resolve(__dirname, '../../e2e/fixtures/packs/toy-heist');

// Distinct 64-hex hashes for drift tests
const HASH_A = `sha256:${'a'.repeat(64)}`;
const HASH_B = `sha256:${'b'.repeat(64)}`;

/** Write a minimal manifest and force a DISTINCT mtime (1s granularity on
 * some filesystems would otherwise let the mtime cache serve stale data). */
let mtimeBump = 0;
function writeManifest(dir, manifest) {
  const p = path.join(dir, 'pack-manifest.json');
  fs.writeFileSync(p, JSON.stringify(manifest));
  mtimeBump += 10;
  const t = Math.floor(Date.now() / 1000) + mtimeBump;
  fs.utimesSync(p, t, t);
}

function minimalManifest(overrides = {}) {
  return {
    kind: 'pack-manifest',
    schemaVersion: 1,
    packId: 'unit-pack',
    version: '0.0.1',
    contentHash: HASH_A,
    engine: { minVersion: '3.0.0' },
    files: [{ path: 'tokens.json', role: 'tokens', sha1: '0'.repeat(40), size: 2 }],
    ...overrides,
  };
}

describe('packService', () => {
  let tmpDir;
  const originalPackPath = process.env.PACK_PATH;

  beforeEach(() => {
    packService._resetForTesting();
    jest.clearAllMocks();
    delete process.env.PACK_PATH;
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aln-packsvc-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    if (originalPackPath === undefined) {
      delete process.env.PACK_PATH;
    } else {
      process.env.PACK_PATH = originalPackPath;
    }
    packService._resetForTesting();
  });

  describe('getPackDir', () => {
    it('defaults to the ALN-TokenData submodule', () => {
      expect(packService.getPackDir()).toBe(
        path.resolve(__dirname, '../../../../ALN-TokenData')
      );
    });

    it('PACK_PATH overrides the default and warns LOUDLY exactly once', () => {
      process.env.PACK_PATH = tmpDir;
      expect(packService.getPackDir()).toBe(path.resolve(tmpDir));
      expect(packService.getPackDir()).toBe(path.resolve(tmpDir));
      const overrideWarns = logger.warn.mock.calls.filter(([msg]) =>
        msg.includes('PACK_PATH override ACTIVE')
      );
      expect(overrideWarns).toHaveLength(1);
    });
  });

  describe('getManifest (pre-activation: live disk reads)', () => {
    it('parses the toy pack manifest', () => {
      process.env.PACK_PATH = TOY_PACK;
      expect(packService.getManifest().packId).toBe('midnight-heist');
    });

    it('returns null when the directory has no manifest', () => {
      process.env.PACK_PATH = tmpDir;
      expect(packService.getManifest()).toBeNull();
    });

    it('returns null and warns on unparseable JSON', () => {
      process.env.PACK_PATH = tmpDir;
      fs.writeFileSync(path.join(tmpDir, 'pack-manifest.json'), '{nope');
      expect(packService.getManifest()).toBeNull();
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Pack manifest unreadable')
      );
    });

    it('serves the mtime cache on unchanged files and re-reads on change', () => {
      process.env.PACK_PATH = tmpDir;
      writeManifest(tmpDir, minimalManifest({ version: '1.0.0' }));
      const first = packService.getManifest();
      expect(packService.getManifest()).toBe(first); // same object: cached

      writeManifest(tmpDir, minimalManifest({ version: '2.0.0', contentHash: HASH_B }));
      expect(packService.getManifest().version).toBe('2.0.0');
    });
  });

  describe('activatePack (boot-time snapshot semantics)', () => {
    it('freezes identity at activation; later disk edits are not advertised', () => {
      process.env.PACK_PATH = tmpDir;
      writeManifest(tmpDir, minimalManifest());
      const info = packService.activatePack();
      expect(info).toEqual({ packId: 'unit-pack', version: '0.0.1', contentHash: HASH_A });

      writeManifest(tmpDir, minimalManifest({ version: '9.9.9', contentHash: HASH_B }));
      expect(packService.getActivePackInfo()).toEqual(info);
      expect(packService.getManifest().contentHash).toBe(HASH_A);
    });

    it('loud-warns drift exactly once per distinct disk state', () => {
      process.env.PACK_PATH = tmpDir;
      writeManifest(tmpDir, minimalManifest());
      packService.activatePack();

      writeManifest(tmpDir, minimalManifest({ contentHash: HASH_B }));
      packService.getManifest();
      packService.getManifest();
      const driftWarns = logger.warn.mock.calls.filter(([msg]) =>
        msg.includes('differs from the ACTIVE pack')
      );
      expect(driftWarns).toHaveLength(1);
      expect(driftWarns[0][0]).toContain(HASH_B);
      expect(driftWarns[0][0]).toContain(HASH_A);
    });

    it('a pre-pack checkout stays identity-null even if a manifest appears later', () => {
      process.env.PACK_PATH = tmpDir;
      expect(packService.activatePack()).toBeNull();
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('pack identity is null')
      );

      writeManifest(tmpDir, minimalManifest());
      expect(packService.getActivePackInfo()).toBeNull();
      const driftWarns = logger.warn.mock.calls.filter(([msg]) =>
        msg.includes('differs from the ACTIVE pack')
      );
      expect(driftWarns).toHaveLength(1);
    });
  });

  describe('getActivePackInfo', () => {
    it('reports the toy pack identity fields', () => {
      process.env.PACK_PATH = TOY_PACK;
      const info = packService.getActivePackInfo();
      expect(info.packId).toBe('midnight-heist');
      expect(info.contentHash).toMatch(/^sha256:[0-9a-f]{64}$/);
      expect(Object.keys(info).sort()).toEqual(['contentHash', 'packId', 'version']);
    });

    it('is null without a manifest', () => {
      process.env.PACK_PATH = tmpDir;
      expect(packService.getActivePackInfo()).toBeNull();
    });
  });

  describe('resolvePackFile (whitelist + containment)', () => {
    it('resolves inventoried paths to absolute paths inside the pack dir', () => {
      process.env.PACK_PATH = TOY_PACK;
      const abs = packService.resolvePackFile('tokens.json');
      expect(abs).toBe(path.join(TOY_PACK, 'tokens.json'));
      expect(packService.resolvePackFile('game.json')).toBe(path.join(TOY_PACK, 'game.json'));
    });

    it('returns null for non-inventoried paths and with no manifest', () => {
      process.env.PACK_PATH = TOY_PACK;
      expect(packService.resolvePackFile('pack-manifest.json')).toBeNull();
      expect(packService.resolvePackFile('nope.json')).toBeNull();

      process.env.PACK_PATH = tmpDir;
      packService._resetForTesting();
      expect(packService.resolvePackFile('tokens.json')).toBeNull();
    });

    it('refuses traversal even when the manifest inventory itself is hostile', () => {
      process.env.PACK_PATH = tmpDir;
      writeManifest(tmpDir, minimalManifest({
        files: [{ path: '../outside.txt', role: 'other', sha1: '0'.repeat(40), size: 1 }],
      }));
      // resolvePackFile never touches the target file — containment is
      // decided purely on the resolved path prefix.
      expect(packService.resolvePackFile('../outside.txt')).toBeNull();
    });
  });
});
