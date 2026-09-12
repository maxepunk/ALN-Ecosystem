/**
 * B0 BS.1 — the path-blind manifest cache (red-team S6/A1b, pre-existing
 * defect class): _readDiskManifest keyed its cache on mtime ONLY, so two
 * pack directories whose manifests share an mtime (cp -p, rsync, git
 * checkout) served EACH OTHER'S manifest across a PACK_PATH swap — the
 * activation gate's "validates the same read" invariant broken. The
 * cache must key on path+mtime.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

describe('packService manifest cache is path-aware (S6/A1b)', () => {
  let dirA; let dirB;

  beforeEach(() => {
    dirA = fs.mkdtempSync(path.join(os.tmpdir(), 'aln-cacheA-'));
    dirB = fs.mkdtempSync(path.join(os.tmpdir(), 'aln-cacheB-'));
    const when = new Date('2026-01-01T00:00:00Z');
    for (const [dir, id] of [[dirA, 'pack-a'], [dirB, 'pack-b']]) {
      const mf = path.join(dir, 'pack-manifest.json');
      fs.writeFileSync(mf, JSON.stringify({
        packId: id, version: '1.0.0', contentHash: `sha256:${id.padEnd(16, '0')}`, files: [],
      }));
      fs.utimesSync(mf, when, when); // identical mtimes — the trap
    }
  });

  afterEach(() => {
    fs.rmSync(dirA, { recursive: true, force: true });
    fs.rmSync(dirB, { recursive: true, force: true });
    delete process.env.PACK_PATH;
  });

  it('a PACK_PATH swap between equal-mtime manifests returns the NEW directory\'s manifest', () => {
    jest.isolateModules(() => {
      process.env.PACK_PATH = dirA;
      const packService = require('../../../src/services/packService');
      expect(packService.getManifest().packId).toBe('pack-a');
      process.env.PACK_PATH = dirB;
      expect(packService.getManifest().packId).toBe('pack-b');
    });
  });
});
