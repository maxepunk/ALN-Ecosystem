/**
 * ProcessMonitor — reusable self-healing spawned-process monitor
 *
 * Extracted from audioRoutingService.startSinkMonitor() pattern.
 * Handles: spawn lifecycle, line-buffered stdout, exponential backoff restart,
 * orphan prevention (process.on('exit')), shutdown guard, max failure cap.
 *
 * Services provide: command, args, label. Listen to 'line' events.
 */

const { spawn } = require('child_process');
const EventEmitter = require('events');
const logger = require('./logger');

const DEFAULTS = {
  maxFailures: 5,
  restartDelay: 5000,
  backoffMultiplier: 2,
};

class ProcessMonitor extends EventEmitter {
  /**
   * @param {Object} options
   * @param {string} options.command - Command to spawn
   * @param {string[]} options.args - Arguments for the command
   * @param {string} options.label - Label for logging
   * @param {number} [options.maxFailures=5] - Max consecutive failures before giving up
   * @param {number} [options.restartDelay=5000] - Base restart delay (ms)
   * @param {number} [options.backoffMultiplier=2] - Backoff multiplier
   */
  constructor({ command, args, label, maxFailures, restartDelay, backoffMultiplier }) {
    super();
    this._command = command;
    this._args = args;
    this._label = label;
    this._maxFailures = maxFailures ?? DEFAULTS.maxFailures;
    this._restartDelay = restartDelay ?? DEFAULTS.restartDelay;
    this._backoffMultiplier = backoffMultiplier ?? DEFAULTS.backoffMultiplier;

    this._proc = null;
    this._restartTimer = null;
    this._failures = 0;
    this._stopped = false;
    this._processExitHandler = null;
  }

  /** Start the monitored process. Idempotent — no-op if already running. */
  start() {
    if (this._proc) return;

    this._stopped = false;

    // Clean up previous exit handler if any (from restart — prevents listener accumulation)
    if (this._processExitHandler) {
      process.removeListener('exit', this._processExitHandler);
    }

    this._proc = spawn(this._command, this._args, { stdio: ['ignore', 'pipe', 'pipe'] });
    logger.info(`${this._label} monitor started`, { pid: this._proc.pid });

    // Orphan prevention: kill child on parent exit (e.g., PM2 restart)
    this._processExitHandler = () => {
      if (this._proc) this._proc.kill();
    };
    process.on('exit', this._processExitHandler);

    let buffer = '';
    let receivedData = false;

    this._proc.stdout.on('data', (data) => {
      receivedData = true;
      buffer += data.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop(); // Keep incomplete line in buffer

      for (const line of lines) {
        if (line.trim()) {
          this.emit('line', line);
        }
      }
    });

    this._proc.stderr.on('data', (data) => {
      logger.debug(`${this._label} stderr`, { data: data.toString() });
    });

    this._proc.on('close', (code) => {
      this._proc = null;

      if (this._stopped) return;

      if (receivedData) {
        this._failures = 0;
        logger.info(`${this._label} exited normally, restarting`, { exitCode: code });
      } else {
        this._failures++;
        if (this._failures >= this._maxFailures) {
          logger.error(`${this._label} failed ${this._failures} times, giving up`);
          this.emit('gave-up', { failures: this._failures });
          return;
        }
        logger.warn(`${this._label} exited`, { exitCode: code, failures: this._failures });
      }

      const delay = this._restartDelay * Math.pow(this._backoffMultiplier, this._failures);
      this._restartTimer = setTimeout(() => {
        this._restartTimer = null;
        logger.info(`Restarting ${this._label}`, { delay });
        this.emit('restarted', { attempt: this._failures || 1, delay });
        this.start();
      }, delay);
    });
  }

  /** Stop the monitored process and prevent restart. */
  stop() {
    this._stopped = true;

    if (this._proc) {
      this._proc.kill();
      this._proc = null;
    }
    if (this._processExitHandler) {
      process.removeListener('exit', this._processExitHandler);
      this._processExitHandler = null;
    }
    if (this._restartTimer) {
      clearTimeout(this._restartTimer);
      this._restartTimer = null;
    }
    this._failures = 0;
  }

  /** @returns {boolean} Whether the process is currently running */
  isRunning() {
    return this._proc !== null;
  }
}

module.exports = ProcessMonitor;
