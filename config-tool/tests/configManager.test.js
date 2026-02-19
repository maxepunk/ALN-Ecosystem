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
      baseValues: { '1': 10000, '2': 25000 },
      typeMultipliers: { Personal: 1, Business: 3, Technical: 5, UNKNOWN: 0 }
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
    configManager.writeScoring({ version: '1.0', baseValues: { '1': 99999 }, typeMultipliers: {} });
    const reread = JSON.parse(fs.readFileSync(path.join(tmpDir, 'scoring-config.json'), 'utf8'));
    assert.strictEqual(reread.baseValues['1'], 99999);
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
    const cues = { cues: [{ id: 'test', label: 'Test', commands: [] }] };
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

    it('prevents path traversal in loadPreset', () => {
      assert.throws(() => configManager.loadPreset('../../../etc/passwd'));
    });

    it('prevents path traversal in exportPreset', () => {
      assert.throws(() => configManager.exportPreset('../../../etc/passwd'));
    });
  });

  describe('assets', () => {
    it('lists sound files', () => {
      fs.writeFileSync(path.join(tmpDir, 'sounds', 'test.wav'), 'fake');
      const sounds = configManager.listSounds();
      assert.strictEqual(sounds.length, 1);
      assert.strictEqual(sounds[0].name, 'test.wav');
    });

    it('lists video files', () => {
      fs.writeFileSync(path.join(tmpDir, 'videos', 'test.mp4'), 'fake');
      const videos = configManager.listVideos();
      assert.strictEqual(videos.length, 1);
      assert.strictEqual(videos[0].name, 'test.mp4');
    });

    it('deletes an asset', () => {
      fs.writeFileSync(path.join(tmpDir, 'sounds', 'delete-me.wav'), 'fake');
      configManager.deleteAsset('sounds', 'delete-me.wav');
      assert.strictEqual(configManager.listSounds().length, 0);
    });

    it('prevents path traversal in delete', () => {
      assert.throws(() => configManager.deleteAsset('sounds', '../../../etc/passwd'), /not found/);
    });
  });
});
