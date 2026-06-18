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
    fs.writeFileSync(path.join(tmpDir, 'scoring-config.json'), JSON.stringify({
      version: '1.0',
      baseValues: { '1': 10000, '2': 25000, '3': 50000, '4': 75000, '5': 150000 },
      typeMultipliers: { Personal: 1, Mention: 3, Business: 3, Party: 5, Technical: 5, UNKNOWN: 0 }
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
      scoringPath: path.join(tmpDir, 'scoring-config.json'),
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

  it('writes scoring config', () => {
    configManager.writeScoring({
      version: '1.0',
      baseValues: { '1': 99999, '2': 25000, '3': 50000, '4': 75000, '5': 150000 },
      typeMultipliers: { Personal: 1, UNKNOWN: 0 },
    });
    const reread = JSON.parse(fs.readFileSync(path.join(tmpDir, 'scoring-config.json'), 'utf8'));
    assert.strictEqual(reread.baseValues['1'], 99999);
    // atomic write leaves no tmp file behind (F-TOOL-10)
    assert.ok(!fs.existsSync(path.join(tmpDir, 'scoring-config.json.tmp')));
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

  it('writes cues config', () => {
    const cues = { cues: [{ id: 'test', label: 'Test', quickFire: true, commands: [] }] };
    configManager.writeCues(cues);
    const reread = JSON.parse(fs.readFileSync(path.join(tmpDir, 'cues.json'), 'utf8'));
    assert.strictEqual(reread.cues[0].id, 'test');
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
      const scoring = JSON.parse(fs.readFileSync(path.join(tmpDir, 'scoring-config.json'), 'utf8'));
      assert.strictEqual(scoring.baseValues['1'], 10000);
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
