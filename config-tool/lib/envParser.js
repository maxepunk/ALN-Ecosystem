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
      let value = trimmed.substring(eqIndex + 1).trim();

      // Strip surrounding quotes
      if ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))) {
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
      const val = values[line.key] ?? '';
      // Quote values containing spaces, #, or special chars
      const needsQuotes = val.includes(' ') || val.includes('#') || val.includes('"');
      const formatted = needsQuotes ? `"${val}"` : val;
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
  fs.writeFileSync(filePath, serializeEnv(parsed), 'utf8');
}

module.exports = { parseEnvFile, serializeEnv, readEnv, writeEnv };
