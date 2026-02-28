/**
 * DbusSignalParser — parse dbus-monitor --monitor multi-line output
 * into structured signal objects with property values.
 *
 * Composable with ProcessMonitor: PM feeds lines → Parser accumulates →
 * emits 'signal' events with parsed { path, interface, member, properties }.
 *
 * Focused on PropertiesChanged signals (the D-Bus pattern for state monitoring).
 * Complex nested values (Metadata dicts) provided as raw text for service-level parsing.
 */

const EventEmitter = require('events');
const logger = require('./logger');

// Matches the start of a new D-Bus message (signal, method call, method return, error)
const MESSAGE_BOUNDARY_RE = /^(signal|method call|method return|error)\s/;

// Parse signal header fields
const HEADER_RE = /path=([^;]+);\s*interface=([^;]+);\s*member=(\S+)/;
const SENDER_RE = /sender=([^\s]+)/;

// PropertiesChanged body parsing
const CHANGED_INTERFACE_RE = /^\s+string\s+"([^"]+)"/;
const DICT_ENTRY_KEY_RE = /^\s+string\s+"([^"]+)"/;
const VARIANT_VALUE_RE = /variant\s+(.+)/;

class DbusSignalParser extends EventEmitter {
  constructor() {
    super();
    this._currentHeader = null;
    this._currentBody = [];
    this._currentType = null;
  }

  /**
   * Feed a single line from dbus-monitor stdout.
   * Accumulates lines until the next message boundary, then emits the completed message.
   */
  feedLine(line) {
    const boundaryMatch = line.match(MESSAGE_BOUNDARY_RE);
    if (boundaryMatch) {
      // New message boundary — emit the previous message if any
      this._emitPending();

      this._currentType = boundaryMatch[1];
      this._currentHeader = line;
      this._currentBody = [];
      return;
    }

    // Body line — accumulate if we have a current message
    if (this._currentHeader !== null) {
      this._currentBody.push(line);
    }
  }

  /** Emit any pending accumulated message. Safe to call anytime. */
  flush() {
    this._emitPending();
  }

  _emitPending() {
    if (!this._currentHeader) return;

    // Only emit signal type messages
    if (this._currentType === 'signal') {
      const parsed = this._parseSignal(this._currentHeader, this._currentBody);
      if (parsed) {
        this.emit('signal', parsed);
      }
    }

    this._currentHeader = null;
    this._currentBody = [];
    this._currentType = null;
  }

  _parseSignal(headerLine, bodyLines) {
    const headerMatch = headerLine.match(HEADER_RE);
    if (!headerMatch) return null;

    const [, path, iface, member] = headerMatch;
    const senderMatch = headerLine.match(SENDER_RE);
    const sender = senderMatch ? senderMatch[1] : null;
    const raw = bodyLines.join('\n');

    const result = { type: 'signal', path, interface: iface, member, sender, raw };

    // Parse PropertiesChanged signals
    if (member === 'PropertiesChanged' && iface === 'org.freedesktop.DBus.Properties') {
      this._parsePropertiesChanged(bodyLines, result);
    }

    return result;
  }

  _parsePropertiesChanged(bodyLines, result) {
    // Extract changed interface from first string arg
    for (const line of bodyLines) {
      const ifaceMatch = line.match(CHANGED_INTERFACE_RE);
      if (ifaceMatch) {
        result.changedInterface = ifaceMatch[1];
        break;
      }
    }

    // Parse property dict entries
    result.properties = {};
    let currentKey = null;
    let inDictEntry = false;

    for (const line of bodyLines) {
      const trimmed = line.trim();

      if (trimmed.startsWith('dict entry(')) {
        inDictEntry = true;
        currentKey = null;
        continue;
      }

      if (trimmed === ')' && inDictEntry) {
        inDictEntry = false;
        currentKey = null;
        continue;
      }

      if (inDictEntry && !currentKey) {
        const keyMatch = line.match(DICT_ENTRY_KEY_RE);
        if (keyMatch) {
          currentKey = keyMatch[1];
          continue;
        }
      }

      if (inDictEntry && currentKey) {
        const variantMatch = line.match(VARIANT_VALUE_RE);
        if (variantMatch) {
          const value = this._parseTypedValue(variantMatch[1].trim());
          if (value !== undefined) {
            result.properties[currentKey] = value;
          }
          // Don't reset currentKey yet — complex types may span multiple lines
        }
      }
    }
  }

  _parseTypedValue(valueStr) {
    // boolean
    if (valueStr === 'boolean true') return true;
    if (valueStr === 'boolean false') return false;

    // string
    const stringMatch = valueStr.match(/^string\s+"([^"]*)"$/);
    if (stringMatch) return stringMatch[1];

    // double
    const doubleMatch = valueStr.match(/^double\s+(-?[\d.]+(?:e[+-]?\d+)?)$/);
    if (doubleMatch) return parseFloat(doubleMatch[1]);

    // int types (int16, int32, int64, uint16, uint32, uint64)
    const intMatch = valueStr.match(/^u?int(?:16|32|64)\s+(-?\d+)$/);
    if (intMatch) return parseInt(intMatch[1], 10);

    // Complex types (arrays, dicts) — return undefined, service uses raw
    return undefined;
  }
}

module.exports = DbusSignalParser;
