'use strict';
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const { readEnv, writeEnv } = require('./envParser');
const {
  validateScoring,
  validateCues,
  validateRouting,
  validateEnvUpdates,
  validatePresetSections,
  assertValid,
} = require('./validators');
const { MASK_SENTINEL } = require('./secrets');

const PROJECT_ROOT = path.resolve(__dirname, '../..');

const DEFAULT_PATHS = {
  envPath: path.join(PROJECT_ROOT, 'backend/.env'),
  scoringPath: path.join(PROJECT_ROOT, 'ALN-TokenData/scoring-config.json'),
  cuesPath: path.join(PROJECT_ROOT, 'backend/config/environment/cues.json'),
  routingPath: path.join(PROJECT_ROOT, 'backend/config/environment/routing.json'),
  tokensPath: path.join(PROJECT_ROOT, 'ALN-TokenData/tokens.json'),
  soundsDir: path.join(PROJECT_ROOT, 'backend/public/audio'),
  videosDir: path.join(PROJECT_ROOT, 'backend/public/videos'),
  presetsDir: path.join(__dirname, '../presets'),
};

class ConfigManager {
  constructor(paths = {}) {
    this.paths = { ...DEFAULT_PATHS, ...paths };
  }

  // -- Readers --

  readAll() {
    return {
      env: readEnv(this.paths.envPath).values,
      scoring: this._readJson(this.paths.scoringPath),
      cues: this._readJson(this.paths.cuesPath),
      routing: this._readJson(this.paths.routingPath),
    };
  }

  readTokens() {
    return this._readJson(this.paths.tokensPath);
  }

  _readJson(filePath) {
    try {
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (err) {
      if (err.code === 'ENOENT') return {};
      throw err;
    }
  }

  // -- Writers --

  writeEnvValues(updates) {
    assertValid(validateEnvUpdates(updates), 'env updates');
    const parsed = readEnv(this.paths.envPath);
    for (const [key, value] of Object.entries(updates)) {
      // Masked secrets round-trip from GET /config as the sentinel; that
      // means "unchanged" — never overwrite the real value with bullets.
      if (value === MASK_SENTINEL) continue;
      parsed.values[key] = String(value);
      // If key doesn't exist in lines, append it
      if (!parsed.lines.some(l => l.type === 'keyvalue' && l.key === key)) {
        parsed.lines.push({ type: 'keyvalue', key, raw: `${key}=${value}` });
      }
    }
    writeEnv(this.paths.envPath, parsed);
  }

  writeScoring(data) {
    assertValid(validateScoring(data), 'scoring config');
    this._writeJson(this.paths.scoringPath, data);
  }

  writeCues(data) {
    assertValid(validateCues(data), 'cues config');
    this._writeJson(this.paths.cuesPath, data);
  }

  writeRouting(data) {
    assertValid(validateRouting(data), 'routing config');
    this._writeJson(this.paths.routingPath, data);
  }

  // Atomic write: tmp + rename so a crash mid-write can never leave a
  // truncated JSON file for the backend to silently replace with defaults
  // at next boot (F-TOOL-10).
  _writeJson(filePath, data) {
    const tmp = `${filePath}.tmp`;
    try {
      fs.writeFileSync(tmp, JSON.stringify(data, null, 2) + '\n', 'utf8');
      fs.renameSync(tmp, filePath);
    } catch (err) {
      try { fs.unlinkSync(tmp); } catch { /* best-effort cleanup */ }
      throw err;
    }
  }

  // -- Assets --

  listSounds() {
    return this._listFiles(this.paths.soundsDir, ['.wav', '.mp3']);
  }

  listVideos() {
    return this._listFiles(this._getVideosDir(), ['.mp4']);
  }

  async _listFiles(dir, extensions) {
    if (!fs.existsSync(dir)) return [];
    const results = [];
    for (const f of fs.readdirSync(dir)) {
      if (!extensions.includes(path.extname(f).toLowerCase())) continue;
      const stat = fs.statSync(path.join(dir, f));
      if (!stat.isFile()) continue;
      const duration = await this._getFileDuration(path.join(dir, f));
      results.push({ name: f, size: stat.size, modified: stat.mtime.toISOString(), duration });
    }
    return results;
  }

  _getFileDuration(filePath) {
    return new Promise((resolve) => {
      execFile('ffprobe', ['-v', 'quiet', '-print_format', 'json', '-show_format', filePath],
        { timeout: 5000 },
        (err, stdout) => {
          if (err) return resolve(null);
          try {
            const data = JSON.parse(stdout);
            const dur = parseFloat(data.format?.duration);
            resolve(Number.isFinite(dur) ? dur : null);
          } catch {
            resolve(null);
          }
        }
      );
    });
  }

  deleteAsset(type, filename) {
    const dir = type === 'sounds' ? this.paths.soundsDir : this._getVideosDir();
    const filePath = path.join(dir, path.basename(filename));
    if (!fs.existsSync(filePath)) throw new Error(`File not found: ${filename}`);
    fs.unlinkSync(filePath);
  }

  getAssetUploadDir(type) {
    return type === 'sounds' ? this.paths.soundsDir : this._getVideosDir();
  }

  _getVideosDir() {
    try {
      const env = readEnv(this.paths.envPath).values;
      if (env.VIDEO_DIR) {
        const resolved = path.resolve(path.dirname(this.paths.envPath), env.VIDEO_DIR);
        if (fs.existsSync(resolved)) return resolved;
      }
    } catch { /* fall through */ }
    return this.paths.videosDir;
  }

  // -- Presets --

  listPresets() {
    if (!fs.existsSync(this.paths.presetsDir)) return [];
    return fs.readdirSync(this.paths.presetsDir)
      .filter(f => f.endsWith('.json'))
      .map(f => {
        const data = JSON.parse(fs.readFileSync(path.join(this.paths.presetsDir, f), 'utf8'));
        return { filename: f, name: data.name, created: data.created, description: data.description || '' };
      });
  }

  savePreset(name, description) {
    if (!fs.existsSync(this.paths.presetsDir)) fs.mkdirSync(this.paths.presetsDir, { recursive: true });
    const config = this.readAll();
    const preset = {
      name,
      created: new Date().toISOString(),
      description,
      env: config.env,
      scoringConfig: config.scoring,
      cues: config.cues,
      routing: config.routing,
    };
    const filename = name.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '.json';
    this._writeJson(path.join(this.paths.presetsDir, filename), preset);
    return filename;
  }

  loadPreset(filename) {
    const preset = JSON.parse(fs.readFileSync(path.join(this.paths.presetsDir, path.basename(filename)), 'utf8'));

    // Validate ALL four sections BEFORE writing any — a preset must apply
    // fully or not at all (F-TOOL-11: no half-applied presets).
    assertValid(validatePresetSections(preset), `preset "${filename}"`);

    // Auto-backup current config before overwriting. Tolerate a corrupt
    // existing config file (skip-with-warning) — preset load is exactly the
    // recovery path for that scenario, so the backup must not brick it.
    // The in-memory snapshot doubles as the rollback source below.
    let backup = null;
    try {
      backup = this.readAll();
      this.savePreset('_backup_' + Date.now(), 'Auto-backup before loading preset');
    } catch (err) {
      backup = null;
      console.warn(`[config-tool] Skipping auto-backup (current config unreadable): ${err.message}`);
    }

    // Write all config files from preset. Up-front validation can't catch
    // I/O failures (EACCES, disk full) mid-sequence — on any write failure,
    // roll back every section from the backup taken above so the config is
    // never left half-applied (F-TOOL-11).
    try {
      this.writeEnvValues(preset.env);
      this.writeScoring(preset.scoringConfig);
      this.writeCues(preset.cues);
      this.writeRouting(preset.routing);
    } catch (err) {
      if (!backup) throw err; // current config was unreadable — nothing to restore
      try {
        this.writeEnvValues(backup.env);
        this.writeScoring(backup.scoring);
        this.writeCues(backup.cues);
        this.writeRouting(backup.routing);
      } catch (restoreErr) {
        throw new Error(
          `preset apply failed (${err.message}); rollback ALSO failed (${restoreErr.message}) — ` +
          'config may be half-applied; restore manually from the auto-backup preset'
        );
      }
      throw new Error(`preset apply failed; previous config restored: ${err.message}`);
    }

    return preset;
  }

  deletePreset(filename) {
    const filePath = path.join(this.paths.presetsDir, path.basename(filename));
    if (!fs.existsSync(filePath)) throw new Error(`Preset not found: ${filename}`);
    fs.unlinkSync(filePath);
  }

  exportPreset(filename) {
    return JSON.parse(fs.readFileSync(path.join(this.paths.presetsDir, path.basename(filename)), 'utf8'));
  }

  importPreset(presetData) {
    // Imported presets go through the SAME validators as direct writes —
    // a preset with `cues: "hello"` must not import-fine and corrupt on load.
    assertValid(validatePresetSections(presetData), 'imported preset');
    if (!fs.existsSync(this.paths.presetsDir)) fs.mkdirSync(this.paths.presetsDir, { recursive: true });
    const filename = presetData.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '.json';
    this._writeJson(path.join(this.paths.presetsDir, filename), presetData);
    return filename;
  }
}

module.exports = { ConfigManager, DEFAULT_PATHS };
