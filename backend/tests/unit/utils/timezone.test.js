/**
 * Unit tests for timezone auto-derivation utility.
 */

const fs = require('fs');

describe('timezone utility', () => {
  let originalReadFileSync;
  let originalDateTimeFormat;
  let getPosixTimezone, _resetCache;

  beforeEach(() => {
    // Re-require fresh each test to reset cache cleanly and
    // allow per-test jest.doMock for fs stubbing.
    jest.resetModules();
    ({ getPosixTimezone, _resetCache } = require('../../../src/utils/timezone'));
    _resetCache();

    originalReadFileSync = fs.readFileSync;
    originalDateTimeFormat = Intl.DateTimeFormat;
  });

  afterEach(() => {
    fs.readFileSync = originalReadFileSync;
    Intl.DateTimeFormat = originalDateTimeFormat;
    _resetCache();
  });

  function stubIana(zone) {
    Intl.DateTimeFormat = function () {
      return { resolvedOptions: () => ({ timeZone: zone }) };
    };
  }

  function stubReadFile(content) {
    fs.readFileSync = jest.fn(() => Buffer.from(content, 'latin1'));
  }

  it('extracts POSIX TZ from trailing footer of zoneinfo file', () => {
    stubIana('America/Los_Angeles');
    // Simulated TZif footer: binary content followed by \n<POSIX>\n
    stubReadFile('TZif2\x00\x01\x02...\nPST8PDT,M3.2.0,M11.1.0\n');

    expect(getPosixTimezone()).toBe('PST8PDT,M3.2.0,M11.1.0');
  });

  it('falls back to UTC0 when zoneinfo file is missing', () => {
    stubIana('America/Los_Angeles');
    fs.readFileSync = jest.fn(() => { throw new Error('ENOENT'); });

    expect(getPosixTimezone()).toBe('UTC0');
  });

  it('rejects IANA names with path-escape characters', () => {
    stubIana('../../../etc/passwd');
    fs.readFileSync = jest.fn();  // should never be called

    expect(getPosixTimezone()).toBe('UTC0');
    expect(fs.readFileSync).not.toHaveBeenCalled();
  });

  it('rejects empty IANA name', () => {
    stubIana('');
    fs.readFileSync = jest.fn();

    expect(getPosixTimezone()).toBe('UTC0');
    expect(fs.readFileSync).not.toHaveBeenCalled();
  });

  it('falls back to UTC0 when zoneinfo file has no POSIX footer', () => {
    stubIana('Etc/UTC');
    stubReadFile('');  // empty

    expect(getPosixTimezone()).toBe('UTC0');
  });

  it('caches the result — second call does not re-read', () => {
    stubIana('America/Los_Angeles');
    stubReadFile('TZif2\nPST8PDT,M3.2.0,M11.1.0\n');

    expect(getPosixTimezone()).toBe('PST8PDT,M3.2.0,M11.1.0');
    expect(fs.readFileSync).toHaveBeenCalledTimes(1);

    // Subsequent calls return cached value without touching fs
    expect(getPosixTimezone()).toBe('PST8PDT,M3.2.0,M11.1.0');
    expect(fs.readFileSync).toHaveBeenCalledTimes(1);
  });

  it('accepts Etc/UTC zone (POSIX = UTC0)', () => {
    stubIana('Etc/UTC');
    stubReadFile('TZif2\nUTC0\n');

    expect(getPosixTimezone()).toBe('UTC0');
  });

  it('returns UTC0 when Intl lookup throws', () => {
    Intl.DateTimeFormat = function () { throw new Error('no intl'); };

    expect(getPosixTimezone()).toBe('UTC0');
  });
});
