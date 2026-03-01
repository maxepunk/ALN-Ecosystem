/**
 * Sound Service
 * PipeWire pw-play wrapper for audio playback
 * Manages sound effect processes with start/stop/status tracking
 */
'use strict';

const EventEmitter = require('events');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const logger = require('../utils/logger');
const config = require('../config');
const registry = require('./serviceHealthRegistry');
const { execFileAsync } = require('../utils/execHelper');

class SoundService extends EventEmitter {
  constructor() {
    super();
    this.processes = new Map(); // pid → {file, target, volume, process}
    this.audioDir = path.resolve(__dirname, '../../public/audio');
  }

  /**
   * Initialize the sound service.
   * Checks that pw-play is available on the system.
   * @returns {Promise<void>}
   */
  async init() {
    const available = await this.checkHealth();
    if (available) {
      logger.info('[Sound] Service initialized — pw-play available');
    } else {
      logger.warn('[Sound] Service initialized — pw-play not available');
    }
  }

  /**
   * On-demand health check. Re-probes pw-play availability and reports to registry.
   * @returns {Promise<boolean>} true if pw-play is available
   */
  async checkHealth() {
    try {
      await execFileAsync('which', ['pw-play'], 3000);
      registry.report('sound', 'healthy', 'pw-play available');
      return true;
    } catch {
      registry.report('sound', 'down', 'pw-play not found');
      return false;
    }
  }

  play({ file, target, volume }) {
    const filePath = path.resolve(this.audioDir, file);

    if (!fs.existsSync(filePath)) {
      logger.error(`[Sound] File not found: ${filePath}`);
      this.emit('sound:error', { file, error: `File not found: ${file}` });
      return null;
    }

    const args = [];
    if (target) args.push('--target', target);
    if (volume !== undefined) args.push('--volume', String(volume / 100));
    args.push(filePath);

    const proc = spawn('pw-play', args, { stdio: ['ignore', 'pipe', 'pipe'] });

    const entry = { file, target: target || 'default', volume: volume || 100, pid: proc.pid };
    this.processes.set(proc.pid, { ...entry, process: proc });

    proc.on('close', (code) => {
      this.processes.delete(proc.pid);
      if (code === 0) {
        this.emit('sound:completed', { file, pid: proc.pid });
      } else {
        this.emit('sound:stopped', { file, pid: proc.pid, reason: code === null ? 'killed' : 'error' });
      }
    });

    proc.on('error', (err) => {
      this.processes.delete(proc.pid);
      logger.error(`[Sound] pw-play error for ${file}:`, err.message);
      this.emit('sound:error', { file, error: err.message });
    });

    this.emit('sound:started', entry);
    logger.info(`[Sound] Playing ${file} (pid=${proc.pid}, target=${entry.target})`);
    return entry;
  }

  stop({ file } = {}) {
    if (file) {
      for (const [pid, entry] of this.processes) {
        if (entry.file === file) {
          entry.process.kill();
          logger.info(`[Sound] Stopped ${file} (pid=${pid})`);
        }
      }
    } else {
      for (const [pid, entry] of this.processes) {
        entry.process.kill();
        logger.info(`[Sound] Stopped ${entry.file} (pid=${pid})`);
      }
    }
  }

  /**
   * Get current sound state snapshot.
   * @returns {{playing: Array<{file: string, target: string, volume: number, pid: number}>}}
   */
  getState() {
    return { playing: this.getPlaying() };
  }

  getPlaying() {
    return Array.from(this.processes.values()).map(({ file, target, volume, pid }) => ({
      file, target, volume, pid
    }));
  }

  fileExists(filename) {
    const resolved = path.resolve(this.audioDir, filename);
    // Ensure path stays within audio directory (supports subdirs but not traversal)
    if (!resolved.startsWith(this.audioDir)) return false;
    return fs.existsSync(resolved);
  }

  reset() {
    this.stop();
    this.processes.clear();
    registry.report('sound', 'down', 'Reset');
  }

  cleanup() {
    this.reset();
    this.removeAllListeners();
  }
}

module.exports = new SoundService();
