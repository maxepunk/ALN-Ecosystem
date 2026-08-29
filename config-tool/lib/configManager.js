'use strict';
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const { readEnv, writeEnv } = require('./envParser');
const {
  validateScoring,
  validateRouting,
  validateEnvUpdates,
  validatePresetSections,
  assertValid,
} = require('./validators');
const { MASK_SENTINEL } = require('./secrets');
// A3 slice 4 (D-4.7c): the same pack-internal cue gate packService runs at
// activation. Dependency-free by design (no winston/dotenv) — safe to
// import directly from the backend tree without pulling in service wiring.
const { validateCuesBlock } = require('../../backend/src/gameRules/cueValidation');

const PROJECT_ROOT = path.resolve(__dirname, '../..');

const DEFAULT_PATHS = {
  envPath: path.join(PROJECT_ROOT, 'backend/.env'),
  // A3 slice 2 (ledger L1): scoring values live in the pack rules file's
  // `scoring` block — the retired scoring-config.json is gone, and writes
  // to it were silently ignored by the engine.
  gamePath: path.join(PROJECT_ROOT, 'ALN-TokenData/game.json'),
  // A3 slice 4 (design D-4.7c/D-4.7d): cues are PACK content — the old
  // venue cues file that used to live under backend/config/ (a sibling of
  // routing.json below) is retired. This tool edits ONLY the checked-in
  // submodule pack at ALN-TokenData/cues.json. A PACK_PATH-injected
  // alternate pack directory (backend test-harness seam) is a
  // runtime-only override this tool never sees or writes.
  cuesPath: path.join(PROJECT_ROOT, 'ALN-TokenData/cues.json'),
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
      scoring: this._readJson(this.paths.gamePath).scoring || {},
      cues: this._readJson(this.paths.cuesPath),
      routing: this._readJson(this.paths.routingPath),
      pack: this._readPackIdentity(),
    };
  }

  /**
   * Identity of the pack this tool is editing (slice 3a): id/title/modes
   * from game.json, version/contentHash from the manifest beside it. The
   * SPA derives its title and mode labels from here instead of baked ALN
   * wording. Nulls (not errors) for a packless/partial dir — the tool
   * still serves.
   */
  _readPackIdentity() {
    const game = this._readJson(this.paths.gamePath);
    const manifest = this._readJson(
      path.join(path.dirname(this.paths.gamePath), 'pack-manifest.json')
    );
    return {
      id: game.id || null,
      title: game.title || null,
      version: manifest.version || null,
      contentHash: manifest.contentHash || null,
      modes: Array.isArray(game.modes)
        ? game.modes.map((m) => ({
          id: m.id,
          label: m.label,
          scoringPolicy: m.scoringPolicy || null,
        }))
        : [],
      // A3 slice 4 (D-4.7d): the lighting-role vocabulary the cue editor's
      // role picker draws from — sourced straight from game.json so the
      // tool never hand-mirrors it out of sync with the pack.
      lightingRoles: Array.isArray(game.lightingRoles) ? game.lightingRoles : [],
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
    // MERGE into the pack rules file: the scoring block also carries keys
    // this editor doesn't own (display, semantics) — preserve them. A
    // missing/empty game.json means there is no pack to edit; writing a
    // rules file containing ONLY scoring would fabricate a broken pack.
    const game = this._readJson(this.paths.gamePath);
    if (Object.keys(game).length === 0) {
      throw new Error(
        `Cannot write scoring: ${this.paths.gamePath} is missing or empty — ` +
        'the pack rules file must exist (check the ALN-TokenData submodule)'
      );
    }
    // PAIR ATOMICITY (review finding): if the manifest rebuild throws
    // after game.json was replaced, the pack would be left edited with a
    // stale manifest — the exact state that fails the scanners' per-file
    // sha1 verify, behind a 500 that implies nothing changed. Restore the
    // pre-edit game.json on rebuild failure so the pair stays consistent.
    const previousGame = JSON.parse(JSON.stringify(game));
    game.scoring = { ...game.scoring, ...data };
    this._writeJson(this.paths.gamePath, game);
    try {
      this._rebuildPackManifest();
    } catch (err) {
      this._writeJson(this.paths.gamePath, previousGame);
      throw new Error(
        `Scoring write rolled back: pack-manifest rebuild failed (${err.message}). ` +
        'game.json was restored to its previous state; fix the pack directory and retry.'
      );
    }
  }

  // Any pack-file edit requires a manifest regen (root CLAUDE.md rule) —
  // a stale manifest fails the scanners' per-file sha1 verify and the
  // backend's freshness contract test. Same generator the CLI uses.
  _rebuildPackManifest() {
    const { build } = require('../../backend/scripts/build-pack-manifest');
    const packDir = path.dirname(this.paths.gamePath);
    const { manifest, manifestPath } = build(packDir);
    this._writeJson(manifestPath, manifest);
  }

  writeCues(data) {
    // Pack cues are the HEADER form (A3 slice 4): {kind:'cues',
    // schemaVersion, cues:[...]}. A bare array or the old wrapper-only
    // shape (both tolerated pre-migration) is refused outright — the pack
    // manifest tracks this file by its full header doc, and a partial
    // write would silently drop kind/schemaVersion from the checked-in
    // pack (D-4.7c).
    if (data === null || typeof data !== 'object' || Array.isArray(data)
        || data.kind !== 'cues' || !Array.isArray(data.cues)) {
      assertValid(
        ['cues payload must be the pack header form {kind: "cues", schemaVersion, cues: [...]}'],
        'cues config'
      );
    }

    // Pack-internal gate (A3 slice 4 S4, D-4.7c): validateCuesBlock is the
    // SAME dependency-free pure check packService runs at activation —
    // trigger/action vocabulary, lighting-role, and token-id cross-checks
    // against THIS pack's game.json + tokens.json. Refuse the write
    // outright on any problem (F-TOOL-04) rather than persist cues the
    // engine would refuse to activate.
    const game = this._readJson(this.paths.gamePath);
    if (Object.keys(game).length === 0) {
      throw new Error(
        `Cannot write cues: ${this.paths.gamePath} is missing or empty — ` +
        'the pack rules file must exist (check the ALN-TokenData submodule)'
      );
    }
    const tokens = this._readJson(this.paths.tokensPath);
    const problems = validateCuesBlock(data.cues, game, tokens);
    assertValid(problems, 'cues config');

    // PAIR ATOMICITY (the writeScoring shape, existence-aware): snapshot
    // the previous file, write, rebuild the pack manifest, restore on
    // rebuild failure — cues.json and pack-manifest.json must never drift
    // out of sync (a stale manifest fails the scanners' per-file sha1
    // verify). Unlike scoring (which lives inside the always-present
    // game.json), an ABSENT cues.json is a legal pack state — so the
    // snapshot records absence, and the rollback DELETES the new file
    // instead of fabricating `{}` (which the activation gate would refuse
    // as not the header form).
    const hadCuesFile = fs.existsSync(this.paths.cuesPath);
    const previousCues = hadCuesFile ? this._readJson(this.paths.cuesPath) : null;
    this._writeJson(this.paths.cuesPath, data);
    try {
      this._rebuildPackManifest();
    } catch (err) {
      if (hadCuesFile) {
        this._writeJson(this.paths.cuesPath, previousCues);
      } else {
        fs.rmSync(this.paths.cuesPath, { force: true });
      }
      throw new Error(
        `Cues write rolled back: pack-manifest rebuild failed (${err.message}). ` +
        `cues.json was ${hadCuesFile ? 'restored to its previous state' : 'removed (the pack had no cues file before this write)'}; ` +
        'fix the pack directory and retry.'
      );
    }
    // D-4.7d limitation: this tool writes the CHECKED-IN submodule pack
    // only (see the cuesPath comment on DEFAULT_PATHS).
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
      // Cues are PACK content, not venue/preset state (A3 slice 4,
      // D-4.7c) — presets no longer capture them. A preset saved before
      // this migration may still carry an old `cues` section on disk;
      // loadPreset below never reads it.
      routing: config.routing,
    };
    const filename = name.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '.json';
    this._writeJson(path.join(this.paths.presetsDir, filename), preset);
    return filename;
  }

  loadPreset(filename) {
    const preset = JSON.parse(fs.readFileSync(path.join(this.paths.presetsDir, path.basename(filename)), 'utf8'));

    // Validate all three venue sections BEFORE writing any — a preset must
    // apply fully or not at all (F-TOOL-11: no half-applied presets). Cues
    // are pack content, not a preset section (A3 slice 4) — see the write
    // sequence below.
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
      // Cues are pack content (A3 slice 4, D-4.7c/D-4.7d) — NEVER written
      // from a preset. An old preset/backup saved before this migration
      // may still carry a `cues` section; it is silently ignored here,
      // never applied to the pack. The operator's recovery tool must
      // never be able to write concrete-sceneId cues back into the pack.
      this.writeRouting(preset.routing);
    } catch (err) {
      if (!backup) throw err; // current config was unreadable — nothing to restore
      try {
        this.writeEnvValues(backup.env);
        // Skip the scoring restore when the backup captured nothing real
        // (readAll returns {} for a missing game.json): writeScoring({})
        // would throw validation and convert a recoverable partial
        // failure into the false 'half-applied' path (review finding).
        if (backup.scoring && Object.keys(backup.scoring).length > 0) {
          this.writeScoring(backup.scoring);
        }
        // See note above — cues are never restored either.
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
    // a preset with `scoringConfig: "hello"` must not import-fine and
    // corrupt on load. `cues` is no longer a validated (or required)
    // section (A3 slice 4, D-4.7c) — an older export that still carries
    // one is accepted here and simply never acted on by loadPreset.
    assertValid(validatePresetSections(presetData), 'imported preset');
    if (!fs.existsSync(this.paths.presetsDir)) fs.mkdirSync(this.paths.presetsDir, { recursive: true });
    const filename = presetData.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '.json';
    this._writeJson(path.join(this.paths.presetsDir, filename), presetData);
    return filename;
  }
}

module.exports = { ConfigManager, DEFAULT_PATHS };
