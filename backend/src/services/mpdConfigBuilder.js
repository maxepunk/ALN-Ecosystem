'use strict';

const path = require('path');

/**
 * Build an MPD config file body. All path args MUST be absolute.
 * @param {Object} opts
 * @param {string} opts.musicDir            Absolute path to MP3 directory
 * @param {string} [opts.socketPath]        Unix socket for MPD client connections
 * @param {string} [opts.dbFile]            MPD database file
 * @param {string} [opts.pidFile]           MPD internal pid file (separate from ProcessMonitor's)
 * @param {string} [opts.logFile]           MPD log
 * @param {string} [opts.stateFile]         MPD persisted state
 * @param {string} [opts.playlistDir]       MPD's playlist directory
 * @param {string} [opts.appName]           PipeWire/PulseAudio application_name (for routing)
 * @returns {string} MPD config body
 */
function buildMpdConfig({
  musicDir,
  socketPath = '/tmp/aln-mpd.sock',
  dbFile = '/tmp/aln-mpd.db',
  pidFile = '/tmp/aln-mpd-internal.pid',
  logFile = '/tmp/aln-mpd.log',
  stateFile = '/tmp/aln-mpd.state',
  playlistDir = '/tmp/aln-mpd-playlists',
  appName = 'aln-music',
} = {}) {
  for (const [name, p] of Object.entries({ musicDir, socketPath, dbFile, pidFile, logFile, stateFile, playlistDir })) {
    if (typeof p !== 'string' || !path.isAbsolute(p)) {
      throw new Error(`${name} must be an absolute path, got: ${p}`);
    }
  }
  return `# ALN MPD config (auto-generated — do not edit)
music_directory   "${musicDir}"
playlist_directory "${playlistDir}"
db_file           "${dbFile}"
log_file          "${logFile}"
state_file        "${stateFile}"
pid_file          "${pidFile}"
bind_to_address   "${socketPath}"

audio_output {
  type           "pulse"
  name           "${appName}"
  application_name "${appName}"
}

audio_buffer_size "4096"
restore_paused    "yes"
auto_update       "no"
`;
}

module.exports = { buildMpdConfig };
