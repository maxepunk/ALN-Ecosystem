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

class SoundService extends EventEmitter {
  constructor() {
    super();
    this.processes = new Map(); // pid → {file, target, volume, process}
    this.audioDir = path.resolve(__dirname, '../../public/audio');
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

  getPlaying() {
    return Array.from(this.processes.values()).map(({ file, target, volume, pid }) => ({
      file, target, volume, pid
    }));
  }

  reset() {
    this.stop();
    this.processes.clear();
  }

  cleanup() {
    this.reset();
    this.removeAllListeners();
  }
}

module.exports = new SoundService();
