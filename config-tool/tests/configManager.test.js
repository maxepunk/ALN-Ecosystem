const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

describe('configManager', () => {
  let tmpDir, configManager;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aln-config-test-'));

    fs.writeFileSync(path.join(tmpDir, '.env'), 'PORT=3000\nHOST=0.0.0.0\n');
    fs.writeFileSync(path.join(tmpDir, 'game.json'), JSON.stringify({
      kind: 'game', schemaVersion: 2, id: 'test-pack',
      // A3 slice 4: declares the same capability ids real packs declare
      // (ALN-TokenData/game.json) so cue-authoring tests exercising
      // standing triggers / timelines / lighting roles don't trip the
      // validateCuesBlock "requires" lint (rule 6).
      requires: ['cues.standing', 'cues.timeline', 'lighting.roles'],
      lightingRoles: ['gameplay', 'video-playback'],
      scoring: {
        baseValues: { '1': 10000, '2': 25000, '3': 50000, '4': 75000, '5': 150000 },
        typeMultipliers: { Personal: 1, Mention: 3, Business: 3, Party: 5, Technical: 5, UNKNOWN: 0 },
        display: { unit: 'currency-usd', format: '$#,###' }
      }
    }));
    fs.writeFileSync(path.join(tmpDir, 'cues.json'), JSON.stringify({ cues: [] }));
    fs.writeFileSync(path.join(tmpDir, 'routing.json'), JSON.stringify({
      routes: { video: { sink: 'hdmi', fallback: 'hdmi' } },
      ducking: []
    }));
    fs.writeFileSync(path.join(tmpDir, 'tokens.json'), JSON.stringify({
      tok001: { SF_RFID: 'tok001', SF_ValueRating: 3, SF_MemoryType: 'Personal' }
    }));

    fs.mkdirSync(path.join(tmpDir, 'sounds'));
    fs.mkdirSync(path.join(tmpDir, 'videos'));
    fs.mkdirSync(path.join(tmpDir, 'presets'));

    const { ConfigManager } = require('../lib/configManager');
    configManager = new ConfigManager({
      envPath: path.join(tmpDir, '.env'),
      gamePath: path.join(tmpDir, 'game.json'),
      cuesPath: path.join(tmpDir, 'cues.json'),
      routingPath: path.join(tmpDir, 'routing.json'),
      tokensPath: path.join(tmpDir, 'tokens.json'),
      soundsDir: path.join(tmpDir, 'sounds'),
      videosDir: path.join(tmpDir, 'videos'),
      presetsDir: path.join(tmpDir, 'presets'),
    });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('reads all config sources', () => {
    const config = configManager.readAll();
    assert.strictEqual(config.env.PORT, '3000');
    assert.strictEqual(config.scoring.baseValues['1'], 10000);
    assert.deepStrictEqual(config.cues, { cues: [] });
    assert.strictEqual(config.routing.routes.video.sink, 'hdmi');
  });

  describe('pack identity (slice 3a — the tool shows WHICH pack it edits)', () => {
    it('readAll exposes pack identity from game.json + pack-manifest.json', () => {
      const game = JSON.parse(fs.readFileSync(path.join(tmpDir, 'game.json'), 'utf8'));
      game.title = 'Midnight Heist';
      game.modes = [
        { id: 'fence', label: 'Fence', scoringPolicy: 'standard' },
        { id: 'tipoff', label: 'Tip-Off' },
      ];
      fs.writeFileSync(path.join(tmpDir, 'game.json'), JSON.stringify(game));
      fs.writeFileSync(path.join(tmpDir, 'pack-manifest.json'), JSON.stringify({
        kind: 'pack-manifest', schemaVersion: 2, packId: 'test-pack',
        version: '2.1.0', contentHash: 'sha256:abc123', files: [],
      }));

      const { pack } = configManager.readAll();

      assert.strictEqual(pack.id, 'test-pack');
      assert.strictEqual(pack.title, 'Midnight Heist');
      assert.strictEqual(pack.version, '2.1.0');
      assert.strictEqual(pack.contentHash, 'sha256:abc123');
      assert.deepStrictEqual(pack.modes, [
        { id: 'fence', label: 'Fence', scoringPolicy: 'standard' },
        { id: 'tipoff', label: 'Tip-Off', scoringPolicy: null },
      ]);
    });

    it('degrades to nulls when manifest/title/modes are absent (packless dir still serves)', () => {
      // Fixture default: game.json has id but no title/modes, no manifest.
      const { pack } = configManager.readAll();

      assert.strictEqual(pack.id, 'test-pack');
      assert.strictEqual(pack.title, null);
      assert.strictEqual(pack.version, null);
      assert.strictEqual(pack.contentHash, null);
      assert.deepStrictEqual(pack.modes, []);
    });
  });

  it('writes scoring into game.json, preserving non-editor scoring keys + rebuilding the manifest', () => {
    configManager.writeScoring({
      baseValues: { '1': 99999, '2': 25000, '3': 50000, '4': 75000, '5': 150000 },
      typeMultipliers: { Personal: 1, UNKNOWN: 0 },
    });
    const game = JSON.parse(fs.readFileSync(path.join(tmpDir, 'game.json'), 'utf8'));
    assert.strictEqual(game.scoring.baseValues['1'], 99999);
    assert.deepStrictEqual(game.scoring.typeMultipliers, { Personal: 1, UNKNOWN: 0 });
    // MERGE: keys this editor doesn't own survive the write
    assert.deepStrictEqual(game.scoring.display, { unit: 'currency-usd', format: '$#,###' });
    // the rest of the pack rules file is untouched
    assert.strictEqual(game.id, 'test-pack');
    // atomic write leaves no tmp file behind (F-TOOL-10)
    assert.ok(!fs.existsSync(path.join(tmpDir, 'game.json.tmp')));
    // a pack-file edit regenerates the manifest (stale manifests fail the
    // scanners' sha1 verify + the backend freshness contract test)
    const manifest = JSON.parse(fs.readFileSync(path.join(tmpDir, 'pack-manifest.json'), 'utf8'));
    assert.ok(manifest.files.some(f => f.path === 'game.json'));
    assert.ok(manifest.contentHash.startsWith('sha256:'));
  });

  it('restores game.json when the manifest rebuild fails (pair atomicity)', () => {
    const original = JSON.parse(fs.readFileSync(path.join(tmpDir, 'game.json'), 'utf8'));
    const realRebuild = configManager._rebuildPackManifest.bind(configManager);
    configManager._rebuildPackManifest = () => { throw new Error('disk on fire'); };
    try {
      assert.throws(
        () => configManager.writeScoring({
          baseValues: { '1': 99999, '2': 25000, '3': 50000, '4': 75000, '5': 150000 },
          typeMultipliers: { Personal: 1 },
        }),
        /rolled back.*manifest rebuild failed/
      );
    } finally {
      configManager._rebuildPackManifest = realRebuild;
    }
    // the edit did NOT survive — pack + manifest stay consistent
    const after = JSON.parse(fs.readFileSync(path.join(tmpDir, 'game.json'), 'utf8'));
    assert.deepStrictEqual(after, original);
  });

  it('refuses to write scoring when game.json is missing (never fabricates a pack)', () => {
    fs.rmSync(path.join(tmpDir, 'game.json'));
    assert.throws(
      () => configManager.writeScoring({
        baseValues: { '1': 1, '2': 2, '3': 3, '4': 4, '5': 5 },
        typeMultipliers: { Personal: 1 },
      }),
      /missing or empty/
    );
  });

  it('writes env values preserving structure', () => {
    configManager.writeEnvValues({ PORT: '4000' });
    const content = fs.readFileSync(path.join(tmpDir, '.env'), 'utf8');
    assert.ok(content.includes('PORT=4000'));
    assert.ok(content.includes('HOST=0.0.0.0'));
  });

  it('appends new env keys that do not exist in the file', () => {
    configManager.writeEnvValues({ NEW_KEY: 'new_value' });
    const content = fs.readFileSync(path.join(tmpDir, '.env'), 'utf8');
    assert.ok(content.includes('NEW_KEY=new_value'));
    assert.ok(content.includes('PORT=3000')); // existing keys preserved
  });

  it('reads tokens (read-only)', () => {
    const tokens = configManager.readTokens();
    assert.strictEqual(tokens.tok001.SF_ValueRating, 3);
  });

  describe('writeCues (A3 slice 4 — pack content, D-4.7c/D-4.7d)', () => {
    it('writes a valid header-form cues doc and rebuilds the pack manifest', () => {
      const cues = {
        kind: 'cues', schemaVersion: 2,
        cues: [{ id: 'test', label: 'Test', quickFire: true, commands: [{ action: 'sound:play', payload: { file: 'x.wav' } }] }],
      };

      // Spy on the manifest rebuild the same way writeScoring's tests
      // stub/override it — count calls without disturbing the real work.
      const realRebuild = configManager._rebuildPackManifest.bind(configManager);
      let rebuildCalls = 0;
      configManager._rebuildPackManifest = () => { rebuildCalls += 1; return realRebuild(); };
      try {
        configManager.writeCues(cues);
      } finally {
        configManager._rebuildPackManifest = realRebuild;
      }

      assert.strictEqual(rebuildCalls, 1);
      const reread = JSON.parse(fs.readFileSync(path.join(tmpDir, 'cues.json'), 'utf8'));
      assert.strictEqual(reread.kind, 'cues');
      assert.strictEqual(reread.schemaVersion, 2);
      assert.strictEqual(reread.cues[0].id, 'test');
      // atomic write leaves no tmp file behind (F-TOOL-10)
      assert.ok(!fs.existsSync(path.join(tmpDir, 'cues.json.tmp')));
      // a pack-file edit regenerates the manifest (same pairing as scoring)
      const manifest = JSON.parse(fs.readFileSync(path.join(tmpDir, 'pack-manifest.json'), 'utf8'));
      assert.ok(manifest.files.some(f => f.path === 'cues.json'));
    });

    it('refuses a non-header-form payload (bare array) and leaves the file untouched', () => {
      const before = fs.readFileSync(path.join(tmpDir, 'cues.json'), 'utf8');
      assert.throws(
        () => configManager.writeCues([{ id: 'c1', label: 'C1', quickFire: true, commands: [] }]),
        /Invalid cues config/
      );
      assert.strictEqual(fs.readFileSync(path.join(tmpDir, 'cues.json'), 'utf8'), before);
    });

    it('refuses a header-form payload that fails the pack-internal gate, and leaves the file untouched', () => {
      const before = fs.readFileSync(path.join(tmpDir, 'cues.json'), 'utf8');
      const invalid = {
        kind: 'cues', schemaVersion: 2,
        // trigger.event is not in the engine's cue-trigger vocabulary
        cues: [{ id: 'bad', label: 'Bad', trigger: { event: 'not:a:real:event' }, commands: [{ action: 'sound:play', payload: { file: 'x.wav' } }] }],
      };
      assert.throws(
        () => configManager.writeCues(invalid),
        /Invalid cues config/
      );
      assert.strictEqual(fs.readFileSync(path.join(tmpDir, 'cues.json'), 'utf8'), before);
      // no tmp file left behind either
      assert.ok(!fs.existsSync(path.join(tmpDir, 'cues.json.tmp')));
    });

    it('restores cues.json when the manifest rebuild fails (pair atomicity)', () => {
      // _writeJson always re-serializes (pretty-printed + trailing
      // newline), so the restored file is not byte-identical to the
      // fixture's raw JSON.stringify output — compare PARSED content,
      // same as writeScoring's equivalent rollback test.
      const before = JSON.parse(fs.readFileSync(path.join(tmpDir, 'cues.json'), 'utf8'));
      const realRebuild = configManager._rebuildPackManifest.bind(configManager);
      configManager._rebuildPackManifest = () => { throw new Error('disk on fire'); };
      try {
        assert.throws(
          () => configManager.writeCues({
            kind: 'cues', schemaVersion: 2,
            cues: [{ id: 'c1', label: 'C1', quickFire: true, commands: [{ action: 'sound:play', payload: { file: 'x.wav' } }] }],
          }),
          /rolled back.*manifest rebuild failed/
        );
      } finally {
        configManager._rebuildPackManifest = realRebuild;
      }
      const after = JSON.parse(fs.readFileSync(path.join(tmpDir, 'cues.json'), 'utf8'));
      assert.deepStrictEqual(after, before);
    });

    it('refuses to write cues when game.json is missing (never edits a pack-less dir)', () => {
      fs.rmSync(path.join(tmpDir, 'game.json'));
      assert.throws(
        () => configManager.writeCues({ kind: 'cues', schemaVersion: 2, cues: [] }),
        /missing or empty/
      );
    });
  });

  it('writes routing config', () => {
    const routing = { routes: { video: { sink: 'bluetooth', fallback: 'hdmi' } }, ducking: [] };
    configManager.writeRouting(routing);
    const reread = JSON.parse(fs.readFileSync(path.join(tmpDir, 'routing.json'), 'utf8'));
    assert.strictEqual(reread.routes.video.sink, 'bluetooth');
  });

  describe('presets', () => {
    it('saves and lists presets', () => {
      const filename = configManager.savePreset('Test Venue', 'A test preset');
      assert.strictEqual(filename, 'test-venue.json');
      const list = configManager.listPresets();
      assert.strictEqual(list.length, 1);
      assert.strictEqual(list[0].name, 'Test Venue');
    });

    it('loads a preset and creates backup', () => {
      configManager.savePreset('Original', '');
      configManager.writeEnvValues({ PORT: '9999' });
      configManager.loadPreset('original.json');
      // After loading, PORT should be back to original
      const content = fs.readFileSync(path.join(tmpDir, '.env'), 'utf8');
      assert.ok(content.includes('PORT=3000'));
      // Backup should exist
      const presets = configManager.listPresets();
      assert.ok(presets.some(p => p.name.startsWith('_backup_')));
    });

    // A3 slice 4 (D-4.7c/D-4.7d): a preset saved before this migration may
    // still carry a `cues` section on disk. loadPreset must never write it
    // to the pack — the operator's recovery tool must never be able to
    // write concrete-sceneId cues back into a role-based pack.
    it('loadPreset never writes cues.json, even from an old cues-bearing preset', () => {
      const before = fs.readFileSync(path.join(tmpDir, 'cues.json'), 'utf8');
      const legacyPreset = {
        name: 'Legacy', created: 'now', description: '',
        env: { PORT: '8080' },
        scoringConfig: {
          baseValues: { '1': 10000, '2': 25000, '3': 50000, '4': 75000, '5': 150000 },
          typeMultipliers: { Personal: 1 },
        },
        // Pre-migration shape: concrete sceneId, no header envelope.
        cues: { cues: [{ id: 'legacy', label: 'Legacy Cue', quickFire: true, commands: [{ action: 'lighting:scene:activate', payload: { sceneId: 'scene.game' } }] }] },
        routing: { routes: {}, ducking: [] },
      };
      fs.writeFileSync(path.join(tmpDir, 'presets', 'legacy.json'), JSON.stringify(legacyPreset));

      configManager.loadPreset('legacy.json');

      // env/routing DID apply (proves the load actually ran)...
      const content = fs.readFileSync(path.join(tmpDir, '.env'), 'utf8');
      assert.ok(content.includes('PORT=8080'));
      // ...but cues.json is byte-identical to before — never touched
      assert.strictEqual(fs.readFileSync(path.join(tmpDir, 'cues.json'), 'utf8'), before);
    });

    it('deletes a preset', () => {
      configManager.savePreset('To Delete', '');
      configManager.deletePreset('to-delete.json');
      assert.strictEqual(configManager.listPresets().length, 0);
    });

    it('exports and imports a preset', () => {
      configManager.savePreset('Exportable', 'desc');
      const data = configManager.exportPreset('exportable.json');
      assert.strictEqual(data.name, 'Exportable');
      configManager.deletePreset('exportable.json');
      const imported = configManager.importPreset(data);
      assert.strictEqual(imported, 'exportable.json');
      assert.strictEqual(configManager.listPresets().length, 1);
    });

    // A3 slice 4 (D-4.7c): savePreset no longer captures cues at all, so a
    // freshly-captured preset has no `cues` key — importPreset (which runs
    // the same validators as a direct write) must accept that.
    it('saves a preset with no cues key, and imports it back without requiring one', () => {
      configManager.savePreset('Cueless', '');
      const onDisk = JSON.parse(fs.readFileSync(path.join(tmpDir, 'presets', 'cueless.json'), 'utf8'));
      assert.ok(!('cues' in onDisk));

      configManager.deletePreset('cueless.json');
      const imported = configManager.importPreset(onDisk);
      assert.strictEqual(imported, 'cueless.json');
      assert.strictEqual(configManager.listPresets().length, 1);
    });

    it('rolls back all sections when a write fails mid-apply (CT-F2)', () => {
      configManager.savePreset('Target', '');
      const presetPath = path.join(tmpDir, 'presets', 'target.json');
      const preset = JSON.parse(fs.readFileSync(presetPath, 'utf8'));
      preset.env.PORT = '7777';
      preset.scoringConfig.baseValues['1'] = 11111;
      fs.writeFileSync(presetPath, JSON.stringify(preset));

      // I/O-failure seam: the scoring write fails ONCE (env has already been
      // applied by then); the rollback's writeScoring call reaches the real
      // writer on the second invocation.
      const realWriteScoring = configManager.writeScoring.bind(configManager);
      let calls = 0;
      configManager.writeScoring = (data) => {
        calls += 1;
        if (calls === 1) throw new Error('EACCES: permission denied');
        return realWriteScoring(data);
      };

      assert.throws(
        () => configManager.loadPreset('target.json'),
        /previous config restored/
      );

      // env was written with preset values before the failure — rolled back
      const content = fs.readFileSync(path.join(tmpDir, '.env'), 'utf8');
      assert.ok(content.includes('PORT=3000'));
      assert.ok(!content.includes('PORT=7777'));
      // scoring never took the preset value (first write threw; rollback
      // rewrote the original)
      const game = JSON.parse(fs.readFileSync(path.join(tmpDir, 'game.json'), 'utf8'));
      assert.strictEqual(game.scoring.baseValues['1'], 10000);
      assert.strictEqual(calls, 2);
    });

    it('prevents path traversal in loadPreset', () => {
      assert.throws(() => configManager.loadPreset('../../../etc/passwd'));
    });

    it('prevents path traversal in exportPreset', () => {
      assert.throws(() => configManager.exportPreset('../../../etc/passwd'));
    });
  });

  describe('assets', () => {
    it('lists sound files with duration', async () => {
      fs.writeFileSync(path.join(tmpDir, 'sounds', 'test.wav'), 'fake');
      const sounds = await configManager.listSounds();
      assert.strictEqual(sounds.length, 1);
      assert.strictEqual(sounds[0].name, 'test.wav');
      assert.strictEqual(sounds[0].duration, null); // fake file has no valid duration
    });

    it('lists video files with duration', async () => {
      fs.writeFileSync(path.join(tmpDir, 'videos', 'test.mp4'), 'fake');
      const videos = await configManager.listVideos();
      assert.strictEqual(videos.length, 1);
      assert.strictEqual(videos[0].name, 'test.mp4');
      assert.strictEqual(videos[0].duration, null); // fake file has no valid duration
    });

    it('deletes an asset', async () => {
      fs.writeFileSync(path.join(tmpDir, 'sounds', 'delete-me.wav'), 'fake');
      configManager.deleteAsset('sounds', 'delete-me.wav');
      assert.strictEqual((await configManager.listSounds()).length, 0);
    });

    it('prevents path traversal in delete', () => {
      assert.throws(() => configManager.deleteAsset('sounds', '../../../etc/passwd'), /not found/);
    });
  });
});
