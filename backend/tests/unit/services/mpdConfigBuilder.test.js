const { buildMpdConfig } = require('../../../src/services/mpdConfigBuilder');

describe('mpdConfigBuilder', () => {
  const validArgs = {
    musicDir: '/abs/music',
    socketPath: '/tmp/x.sock',
    dbFile: '/tmp/x.db',
    pidFile: '/tmp/x.pid',
    logFile: '/tmp/x.log',
    stateFile: '/tmp/x.state',
    playlistDir: '/tmp/x-pl',
    appName: 'aln-music',
  };

  it('builds config with quoted absolute paths', () => {
    const cfg = buildMpdConfig(validArgs);
    expect(cfg).toContain('music_directory   "/abs/music"');
    expect(cfg).toContain('bind_to_address   "/tmp/x.sock"');
    expect(cfg).toContain('name           "aln-music"');
    // application_name is intentionally NOT emitted — MPD's pulse backend
    // doesn't recognize it (logs "option ... not recognized" every restart).
    // The `name` field above lands in PipeWire as media.name instead, which
    // audioRoutingService matches on to identify our specific MPD instance.
    expect(cfg).not.toContain('application_name');
    expect(cfg).toContain('type           "pulse"');
  });

  it('uses default appName when omitted', () => {
    const { appName, ...rest } = validArgs;
    const cfg = buildMpdConfig(rest);
    expect(cfg).toContain('name           "aln-music"');
    // application_name is intentionally NOT emitted — MPD's pulse backend
    // doesn't recognize it (logs "option ... not recognized" every restart).
    // The `name` field above lands in PipeWire as media.name instead, which
    // audioRoutingService matches on to identify our specific MPD instance.
    expect(cfg).not.toContain('application_name');
  });

  it('uses default paths when omitted', () => {
    const cfg = buildMpdConfig({ musicDir: '/abs/music' });
    expect(cfg).toContain('"/tmp/aln-mpd.sock"');
    expect(cfg).toContain('"/tmp/aln-mpd.db"');
  });

  it('throws on relative musicDir', () => {
    expect(() => buildMpdConfig({ ...validArgs, musicDir: 'relative/path' }))
      .toThrow(/absolute/i);
  });

  it('throws on relative socketPath', () => {
    expect(() => buildMpdConfig({ ...validArgs, socketPath: 'sock' }))
      .toThrow(/absolute/i);
  });

  it('includes restore_paused yes for game-clock pause survival', () => {
    expect(buildMpdConfig(validArgs)).toContain('restore_paused    "yes"');
  });

  it('disables auto_update (we control file delivery)', () => {
    expect(buildMpdConfig(validArgs)).toContain('auto_update       "no"');
  });
});
