/**
 * Train-review MAJOR 3 (F-P2-1 / LD-1) + riders F-P2-2 / F-P2-4 /
 * F-P2-6 — the activation gate refuses unreadable pack files instead
 * of silently running the baked shims.
 *
 * The show-night failure MAJOR 3 pins: an operator hand-edits
 * game.json on the machine, leaves a trailing comma, restarts. The
 * engine used to boot with a healthy pack identity while all cues,
 * strings, theme and surfaces vanished and scoring fell to the baked
 * ALN tables (coincidentally right for ALN, flatly wrong for any
 * other pack) — and validate-pack reported ok:true. Only ENOENT is
 * the packless posture; a pack that SHIPS a rules file must ship a
 * readable one.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

const packService = require('../../../src/services/packService');

const TOY_PACK = path.resolve(__dirname, '../../e2e/fixtures/packs/toy-heist');

describe('activation gate — unreadable pack files REFUSE (MAJOR 3 + riders)', () => {
  let tmpDir;
  const originalPackPath = process.env.PACK_PATH;

  /** Copy the real toy pack into tmpDir and point the engine at it. */
  function stagePack() {
    fs.cpSync(TOY_PACK, tmpDir, { recursive: true });
    process.env.PACK_PATH = tmpDir;
  }

  function readGame() {
    return JSON.parse(fs.readFileSync(path.join(tmpDir, 'game.json'), 'utf8'));
  }

  function writeGameRaw(content) {
    fs.writeFileSync(path.join(tmpDir, 'game.json'), content);
  }

  beforeEach(() => {
    packService._resetForTesting();
    delete process.env.PACK_PATH;
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aln-gate-'));
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

  it('a healthy toy-pack copy activates (harness sanity)', () => {
    stagePack();
    expect(() => packService.activatePack()).not.toThrow();
  });

  it('F-P2-1: game.json with a trailing comma REFUSES activation (never the shims)', () => {
    stagePack();
    const raw = fs.readFileSync(path.join(tmpDir, 'game.json'), 'utf8');
    writeGameRaw(raw.replace(/}\s*$/, ',}'));

    expect(() => packService.activatePack()).toThrow(/game\.json.*valid JSON/i);
  });

  it('F-P2-1: a game.json containing literal null REFUSES (not the silent no-warn path)', () => {
    stagePack();
    writeGameRaw('null');

    expect(() => packService.activatePack()).toThrow(/game\.json.*object/i);
  });

  it('F-P2-1: a non-object game.json (array) REFUSES', () => {
    stagePack();
    writeGameRaw('[1,2,3]');

    expect(() => packService.activatePack()).toThrow(/game\.json.*object/i);
  });

  it('ENOENT stays the packless posture: no game.json at all still activates (legacy shims)', () => {
    // Tokens-only checkout — the pre-pack legacy class the shims exist for.
    fs.copyFileSync(path.join(TOY_PACK, 'tokens.json'), path.join(tmpDir, 'tokens.json'));
    process.env.PACK_PATH = tmpDir;

    expect(() => packService.activatePack()).not.toThrow();
    expect(packService.getGameConfig()).toBeNull();
  });

  it('F-P2-2: an unparseable tokens.json REFUSES (the coverage gates cannot run blind)', () => {
    stagePack();
    fs.writeFileSync(path.join(tmpDir, 'tokens.json'), '{ broken');

    expect(() => packService.activatePack()).toThrow(/tokens\.json.*valid JSON/i);
  });

  it('F-P2-2: a non-object tokens.json (array) REFUSES', () => {
    stagePack();
    fs.writeFileSync(path.join(tmpDir, 'tokens.json'), '[1,2]');

    expect(() => packService.activatePack()).toThrow(/tokens\.json.*object/i);
  });

  it('a non-ENOENT read error on either file REFUSES as unreadable (never the shims)', () => {
    // A directory where the file should be → EISDIR on read: exists
    // but unreadable — the refusal class, not the packless posture.
    stagePack();
    fs.rmSync(path.join(tmpDir, 'game.json'));
    fs.mkdirSync(path.join(tmpDir, 'game.json'));
    expect(() => packService.activatePack()).toThrow(/game\.json unreadable/i);

    packService._resetForTesting();
    process.env.PACK_PATH = tmpDir;
    fs.rmSync(path.join(tmpDir, 'game.json'), { recursive: true });
    fs.copyFileSync(path.join(TOY_PACK, 'game.json'), path.join(tmpDir, 'game.json'));
    fs.rmSync(path.join(tmpDir, 'tokens.json'));
    fs.mkdirSync(path.join(tmpDir, 'tokens.json'));
    expect(() => packService.activatePack()).toThrow(/tokens\.json unreadable/i);
  });

  it('F-P2-4: a null entry in modes[] is a named refusal, not a crash', () => {
    stagePack();
    const game = readGame();
    game.modes.push(null);
    writeGameRaw(JSON.stringify(game));

    expect(() => packService.activatePack()).toThrow(/modes\[\].*object/i);
  });

  it('F-P2-6: an unparseable engine.minVersion REFUSES instead of silently passing', () => {
    stagePack();
    const manifestPath = path.join(tmpDir, 'pack-manifest.json');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    manifest.engine = { ...(manifest.engine || {}), minVersion: 'abc' };
    fs.writeFileSync(manifestPath, JSON.stringify(manifest));

    expect(() => packService.activatePack()).toThrow(/minVersion/);
  });

  it('F-P2-6: a 4-part engine.minVersion REFUSES (the compare reads 3 parts)', () => {
    stagePack();
    const manifestPath = path.join(tmpDir, 'pack-manifest.json');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    manifest.engine = { ...(manifest.engine || {}), minVersion: '1.2.3.4' };
    fs.writeFileSync(manifestPath, JSON.stringify(manifest));

    expect(() => packService.activatePack()).toThrow(/minVersion/);
  });
});
