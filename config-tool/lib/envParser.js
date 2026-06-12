'use strict';
const fs = require('fs');

/**
 * Parse a .env file string into a structured object.
 * Preserves comments, blank lines, and ordering for round-trip fidelity.
 *
 * @param {string} content - Raw .env file content
 * @returns {{ values: Object, lines: Array }} Parsed structure
 */
function parseEnvFile(content) {
  const values = {};
  const lines = [];

  for (const raw of content.split('\n')) {
    const trimmed = raw.trim();

    if (trimmed === '') {
      lines.push({ type: 'blank', raw });
    } else if (trimmed.startsWith('#')) {
      lines.push({ type: 'comment', raw });
    } else {
      const eqIndex = trimmed.indexOf('=');
      if (eqIndex === -1) {
        lines.push({ type: 'comment', raw }); // Malformed line, preserve as-is
        continue;
      }
      const key = trimmed.substring(0, eqIndex).trim();
      // NOTE: an unquoted inline `#` is NOT treated as a comment — for
      // `KEY=val # note` the value keeps " # note". This deliberately
      // diverges from the backend's dotenv parser, which strips unquoted
      // inline comments. Pinned in tests/envParser.test.js; change only in
      // lockstep with serializeEnv quoting and the backend's parser.
      let value = trimmed.substring(eqIndex + 1).trim();

      // Strip surrounding quotes. Double-quoted values unescape \" → "
      // (mirror of serializeEnv's escaping — F-TOOL-03 round-trip).
      if (value.length >= 2 && value.startsWith('"') && value.endsWith('"')) {
        value = value.slice(1, -1).replace(/\\"/g, '"');
      } else if (value.length >= 2 && value.startsWith("'") && value.endsWith("'")) {
        value = value.slice(1, -1);
      }

      values[key] = value;
      lines.push({ type: 'keyvalue', key, raw });
    }
  }

  return { values, lines };
}

/**
 * Serialize a parsed env structure back to .env file format.
 * Updated values are written in their original position.
 *
 * @param {{ values: Object, lines: Array }} parsed - Parsed env structure
 * @returns {string} Serialized .env content
 */
function serializeEnv(parsed) {
  const { values, lines } = parsed;
  const outputLines = [];

  for (const line of lines) {
    if (line.type === 'blank') {
      outputLines.push('');
    } else if (line.type === 'comment') {
      outputLines.push(line.raw);
    } else if (line.type === 'keyvalue') {
      const val = String(values[line.key] ?? '');
      // Reject newlines outright — a value containing \n or \r would inject
      // arbitrary additional env lines into backend/.env (F-TOOL-03).
      if (/[\n\r]/.test(val)) {
        throw new Error(`env value for ${line.key} must not contain newlines`);
      }
      // Quote values containing spaces, #, or quotes; escape embedded
      // double quotes so they survive the round-trip.
      const needsQuotes = val.includes(' ') || val.includes('#') || val.includes('"') || val.includes("'");
      const formatted = needsQuotes ? `"${val.replace(/"/g, '\\"')}"` : val;
      outputLines.push(`${line.key}=${formatted}`);
    }
  }

  const result = outputLines.join('\n');
  // Ensure exactly one trailing newline
  return result.endsWith('\n') ? result : result + '\n';
}

/**
 * Read and parse a .env file from disk.
 * @param {string} filePath - Absolute path to .env file
 * @returns {{ values: Object, lines: Array }}
 */
function readEnv(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  return parseEnvFile(content);
}

/**
 * Write updated values to a .env file, preserving structure.
 * @param {string} filePath - Absolute path to .env file
 * @param {{ values: Object, lines: Array }} parsed - Parsed env to write
 */
function writeEnv(filePath, parsed) {
  // Atomic write (tmp + rename) — a crash mid-write must not truncate
  // backend/.env (F-TOOL-10).
  const tmp = `${filePath}.tmp`;
  try {
    fs.writeFileSync(tmp, serializeEnv(parsed), 'utf8');
    fs.renameSync(tmp, filePath);
  } catch (err) {
    try { fs.unlinkSync(tmp); } catch { /* best-effort cleanup */ }
    throw err;
  }
}

module.exports = { parseEnvFile, serializeEnv, readEnv, writeEnv };
