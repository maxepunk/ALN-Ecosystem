/**
 * Unit tests for pidFile.resolvePidFile
 *
 * This helper is a safety boundary: the paths it returns are read by
 * ProcessMonitor._killOrphan() and displayDriver._doLaunch(), both of which
 * signal whatever pid they find. A bad ALN_PIDFILE_DIR must degrade LOUDLY to
 * /tmp rather than silently produce a path nothing can read or write — a path
 * that cannot be read disables orphan reaping with no visible symptom.
 */

const path = require('path');
const os = require('os');
const fs = require('fs');

jest.mock('../../../src/utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

describe('resolvePidFile', () => {
  const ORIGINAL_DIR = process.env.ALN_PIDFILE_DIR;
  let resolvePidFile;
  let logger;

  beforeEach(() => {
    // Fresh module registry per test: the module memoises which bad directories
    // it has already warned about. resetModules also hands out a NEW instance of
    // the mocked logger, so it must be re-required here — a reference grabbed
    // before the reset is not the object the module under test will call.
    jest.resetModules();
    ({ resolvePidFile } = require('../../../src/utils/pidFile'));
    logger = require('../../../src/utils/logger');
  });

  afterEach(() => {
    // CRITICAL: other suites in this worker rely on the isolated dir that
    // jest.config.base.js installed. Never leak a mutated value out of here.
    if (ORIGINAL_DIR === undefined) delete process.env.ALN_PIDFILE_DIR;
    else process.env.ALN_PIDFILE_DIR = ORIGINAL_DIR;
  });

  it('returns null for a missing pidFile', () => {
    expect(resolvePidFile(null)).toBeNull();
    expect(resolvePidFile(undefined)).toBeNull();
    expect(resolvePidFile('')).toBeNull();
  });

  it('keeps only the basename and uses the configured directory', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aln-pidfile-test-'));
    process.env.ALN_PIDFILE_DIR = dir;

    expect(resolvePidFile('/tmp/aln-pm-vlc.pid')).toBe(path.join(dir, 'aln-pm-vlc.pid'));
    expect(resolvePidFile('aln-pm-mpd.pid')).toBe(path.join(dir, 'aln-pm-mpd.pid'));

    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('creates the configured directory when it does not exist yet', () => {
    const dir = path.join(os.tmpdir(), `aln-pidfile-test-mk-${process.pid}`);
    fs.rmSync(dir, { recursive: true, force: true });
    process.env.ALN_PIDFILE_DIR = dir;

    resolvePidFile('/tmp/aln-pm-vlc.pid');

    expect(fs.existsSync(dir)).toBe(true);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('defaults to /tmp when ALN_PIDFILE_DIR is unset', () => {
    delete process.env.ALN_PIDFILE_DIR;
    expect(resolvePidFile('/tmp/aln-pm-vlc.pid')).toBe('/tmp/aln-pm-vlc.pid');
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('WARNS and falls back to /tmp for a relative ALN_PIDFILE_DIR', () => {
    process.env.ALN_PIDFILE_DIR = 'relative/pidfiles';

    expect(resolvePidFile('/tmp/aln-pm-vlc.pid')).toBe('/tmp/aln-pm-vlc.pid');
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('ALN_PIDFILE_DIR unusable'),
      expect.objectContaining({ dir: 'relative/pidfiles', reason: 'not an absolute path' })
    );
  });

  it('WARNS and falls back to /tmp when the directory cannot be created', () => {
    // A regular file cannot be a parent directory — mkdir fails with ENOTDIR.
    // (Do NOT use a path under /proc: mkdirSync with recursive:true does not
    // return on this kernel and wedges the jest worker at 100% CPU.)
    const blocker = path.join(os.tmpdir(), `aln-pidfile-test-file-${process.pid}`);
    fs.writeFileSync(blocker, 'not a directory');
    const unusable = path.join(blocker, 'sub');
    process.env.ALN_PIDFILE_DIR = unusable;

    try {
      expect(resolvePidFile('/tmp/aln-pm-vlc.pid')).toBe('/tmp/aln-pm-vlc.pid');
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('ALN_PIDFILE_DIR unusable'),
        expect.objectContaining({ dir: unusable })
      );
    } finally {
      fs.unlinkSync(blocker);
    }
  });

  it('warns only once per distinct bad directory', () => {
    process.env.ALN_PIDFILE_DIR = 'still/relative';

    resolvePidFile('/tmp/aln-pm-vlc.pid');
    resolvePidFile('/tmp/aln-pm-mpd.pid');
    resolvePidFile('/tmp/aln-pm-vlc.pid');

    expect(logger.warn).toHaveBeenCalledTimes(1);
  });
});
