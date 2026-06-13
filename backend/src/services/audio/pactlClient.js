/**
 * PactlClient — pure pactl output parsers and exec helper.
 *
 * No state. No EventEmitter. No service knowledge.
 * All methods are static-like functions exported from a singleton
 * so callers can inject them cleanly in tests without touching
 * child_process mocks.
 *
 * F-SHOW-24: Merged the two duplicate sink-input parsers that existed
 * in audioRoutingService.js:
 *   - _parseSinkInputs (line-scan, appName substring)
 *   - _identifySinkInput section-body parser (section-split, stream resolution)
 *
 * Unified semantics: section-based parsing with priority ordering
 * (application.name → application.process.binary → media.name).
 * Both call sites are served by the same underlying section parser:
 *   - findSinkInput fallback path: parseSinkInputsByAppName (appName substring)
 *   - _identifySinkInput: parseSinkInputSection (stream + appName from section)
 *
 * The line-scan approach (_parseSinkInputs) was semantically equivalent
 * for well-formed pactl output (each line carries only one property), but
 * required two maintainable code paths. The section approach is more robust
 * to future pactl output format changes (all three keys visible per section).
 */

const { execFileAsync } = require('../../utils/execHelper');

/** Timeout for pactl one-shot commands (ms) */
const PACTL_TIMEOUT = 5000;

/**
 * Execute a pactl (or other system) command.
 * @param {string} cmd
 * @param {string[]} args
 * @returns {Promise<string>} stdout
 */
function execFile(cmd, args) {
  return execFileAsync(cmd, args, PACTL_TIMEOUT);
}

/**
 * Parse `pactl list sinks short` tab-delimited output.
 * Each line: id\tname\tdriver\tformat\tstate
 *
 * @param {string} output - Raw pactl output
 * @param {function(string): string} classifySink - Injected classifier (prevents circular import)
 * @param {function(string, string): string} generateLabel - Injected label generator
 * @returns {Array<{id: string, name: string, driver: string, format: string,
 *   state: string, type: string, label: string}>}
 */
function parseSinkList(output, classifySink, generateLabel) {
  if (!output || !output.trim()) {
    return [];
  }

  return output.trim().split('\n')
    .filter(line => line.split('\t').length >= 2)
    .map(line => {
      const parts = line.split('\t');
      const id = parts[0];
      const name = parts[1];
      const driver = parts[2] || '';
      const format = parts[3] || '';
      const state = parts[4] || '';
      const type = classifySink(name);
      return {
        id,
        name,
        driver,
        format,
        state,
        type,
        label: generateLabel(name, type),
      };
    });
}

/**
 * Parse a `pactl subscribe` event line.
 * Format: "Event 'action' on type #id"
 *
 * @param {string} line - Single line from pactl subscribe
 * @returns {{action: string, type: string, id: string}|null}
 */
function parsePactlEvent(line) {
  const match = line.match(/^Event '(\w+)' on (sink|source|sink-input|source-output|card) #(\d+)$/);
  if (!match) return null;

  return {
    action: match[1],
    type: match[2],
    id: match[3],
  };
}

/**
 * Extract the three identity fields from a sink-input section body.
 * Returns all three fields so the caller can apply whichever precedence they need.
 *
 * Unified parser (F-SHOW-24): replaces both the line-scan _parseSinkInputs and
 * the section-body parser inside _identifySinkInput.
 *
 * Precedence rationale (documented once here):
 *   1. application.name  — most informative; VLC sets it to "VLC media player (...)"
 *   2. application.process.binary — fallback when application.name is empty/generic
 *   3. media.name — MPD hardcodes application.name = "Music Player Daemon" but our
 *      `name "aln-music"` config field lands here and is the only unique signal
 *
 * @param {string} sectionBody - Text of one sink-input section (after "Sink Input #N")
 * @returns {{appName: string|null, binary: string|null, mediaName: string|null}}
 */
function parseSinkInputSection(sectionBody) {
  const nameMatch = sectionBody.match(/application\.name\s*=\s*"([^"]+)"/i);
  const binaryMatch = sectionBody.match(/application\.process\.binary\s*=\s*"([^"]+)"/i);
  const mediaMatch = sectionBody.match(/media\.name\s*=\s*"([^"]+)"/i);

  return {
    appName: nameMatch ? nameMatch[1] : null,
    binary: binaryMatch ? binaryMatch[1] : null,
    mediaName: mediaMatch ? mediaMatch[1] : null,
  };
}

/**
 * Parse `pactl list sink-inputs` output to find a specific application's sink-input index.
 *
 * Checks all three identity fields in precedence order (application.name →
 * application.process.binary → media.name). Returns the first sink-input whose
 * best-matching identity field includes the appName substring.
 *
 * Unified replacement for _parseSinkInputs (line-scan path used by findSinkInput
 * fallback and getStreamVolume).
 *
 * @param {string} output - Raw pactl output
 * @param {string} appName - Application name substring to search for
 * @returns {string|null} Sink-input index or null
 */
function parseSinkInputsByAppName(output, appName) {
  if (!output || !output.trim()) {
    return null;
  }

  const sections = output.split(/(?=^Sink Input #)/m);

  const matched = sections.find(section => {
    const idxMatch = section.match(/^Sink Input #(\d+)/);
    if (!idxMatch) return false;
    const { appName: name, binary, mediaName } = parseSinkInputSection(section);
    // Check in precedence order: first field with content that includes appName wins
    return [name, binary, mediaName].filter(Boolean).some(id => id.includes(appName));
  });

  if (!matched) return null;
  const idxMatch = matched.match(/^Sink Input #(\d+)/);
  return idxMatch ? idxMatch[1] : null;
}

/**
 * Parse all sink-inputs from `pactl list sink-inputs` output.
 * Returns a map of id → {appName, binary, mediaName} for all sink-inputs.
 * Used by _identifySinkInput to look up a specific id's identity fields.
 *
 * @param {string} output - Raw pactl output
 * @param {string} id - Specific sink-input id to find
 * @returns {{appName: string|null, binary: string|null, mediaName: string|null}|null}
 */
function parseSinkInputById(output, id) {
  if (!output || !output.trim()) {
    return null;
  }

  // Split on "Sink Input #N" keeping the header line with each section.
  // The regex splits AFTER the first occurrence — we iterate over sections
  // that each start with "Sink Input #N".
  const raw = output.split(/Sink Input #/);
  const section = raw.find(s => {
    const idxMatch = s.match(/^(\d+)/);
    return idxMatch && idxMatch[1] === id;
  });
  return section ? parseSinkInputSection(section) : null;
}

/**
 * Extract volume percentage for a specific sink-input from pactl list sink-inputs output.
 *
 * @param {string} output - Raw pactl list sink-inputs output
 * @param {string} sinkInputIdx - Sink-input index to find
 * @returns {number|null} Volume percentage or null
 */
function extractVolumeForSinkInput(output, sinkInputIdx) {
  if (!output || !output.trim()) {
    return null;
  }

  // Split into sections and find the one with the target index
  const raw = output.split(/Sink Input #/);
  const section = raw.find(s => {
    const idxMatch = s.match(/^(\d+)/);
    return idxMatch && idxMatch[1] === sinkInputIdx;
  });
  if (!section) return null;

  // Extract volume from the matching section
  // Format: "Volume: front-left: 65536 / 100% / 0.00 dB, ..."
  const volumeMatch = section.match(/Volume:.*?(\d+)%/);
  return volumeMatch ? parseInt(volumeMatch[1], 10) : null;
}

module.exports = {
  execFile,
  parseSinkList,
  parsePactlEvent,
  parseSinkInputSection,
  parseSinkInputsByAppName,
  parseSinkInputById,
  extractVolumeForSinkInput,
};
