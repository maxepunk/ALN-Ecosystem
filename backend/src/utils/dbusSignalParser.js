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

// A PropertiesChanged body has the signature `sa{sv}as` — exactly three
// top-level arguments. Once the third one closes, the message is complete and
// MUST be emitted immediately: dbus-monitor writes no terminator, so waiting
// for the next message's header strands the last message of a burst (W10 F-C2,
// the ~28 s "VLC stays stopped" class of waitForVlcLoaded timeouts).
const PROPERTIES_CHANGED_ARG_COUNT = 3;

// Blank out a body line's string value before counting nesting, so brackets
// inside the value can never look like structure. dbus-monitor does NOT escape
// embedded quotes, so a title like `Take 5" ]]) mix` would re-pair under a
// non-greedy match and leak its closers. A body line carries at most one string
// literal, so blanking first-quote-to-last-quote is both safe and exhaustive.
const QUOTED_VALUE_RE = /"[\s\S]*"/;

// Safety net for messages we cannot complete structurally, i.e. every member
// other than PropertiesChanged. Generous, because the only cost of waiting is
// latency on those messages, whereas dbus-monitor output can be split across
// pipe chunks under load on a busy Pi.
const DEFAULT_IDLE_FLUSH_MS = 500;

// PropertiesChanged body parsing
const CHANGED_INTERFACE_RE = /^\s+string\s+"([^"]+)"/;
const DICT_ENTRY_KEY_RE = /^\s+string\s+"([^"]+)"/;
const VARIANT_VALUE_RE = /variant\s+(.+)/;

class DbusSignalParser extends EventEmitter {
  /**
   * @param {Object} [options]
   * @param {number} [options.idleFlushMs=100] - Idle gap after which an
   *   incomplete message is flushed. 0 disables the fallback (tests only).
   */
  constructor({ idleFlushMs = DEFAULT_IDLE_FLUSH_MS } = {}) {
    super();
    this._idleFlushMs = idleFlushMs;
    this._idleTimer = null;
    this._resetPending();
  }

  _resetPending() {
    this._currentHeader = null;
    this._currentBody = [];
    this._currentType = null;
    this._currentMember = null;
    this._depth = 0;
    this._completedArgs = 0;
  }

  /**
   * Feed a single line from dbus-monitor stdout.
   *
   * A message is emitted as soon as it is known to be complete:
   *   1. structurally, once a PropertiesChanged body's third top-level
   *      argument closes;
   *   2. on the next message boundary;
   *   3. for members we cannot complete structurally, by the idle-flush timer.
   *
   * A PropertiesChanged body is NEVER idle-flushed while incomplete: emitting
   * a partial block would strand its remaining lines (feedLine drops body lines
   * once the header has been consumed) and the tail is exactly where
   * PlaybackStatus sits. Incomplete blocks fall back to boundary completion.
   */
  feedLine(line) {
    const boundaryMatch = line.match(MESSAGE_BOUNDARY_RE);
    if (boundaryMatch) {
      // New message boundary — emit the previous message if any
      this._emitPending();

      this._currentType = boundaryMatch[1];
      this._currentHeader = line;
      this._currentBody = [];
      const headerMatch = line.match(HEADER_RE);
      this._currentMember = headerMatch ? headerMatch[3] : null;
      this._depth = 0;
      this._completedArgs = 0;
      this._armIdleFlush();
      return;
    }

    // Body line — accumulate only if we have a current message
    if (this._currentHeader === null) return;
    this._currentBody.push(line);

    if (this._currentMember === 'PropertiesChanged') {
      if (this._trackArgCompletion(line)) this._emitPending();
      return;
    }

    this._armIdleFlush();
  }

  /**
   * Track top-level argument nesting for the current PropertiesChanged body.
   * @param {string} line - Raw body line
   * @returns {boolean} true once all three top-level arguments have closed
   * @private
   */
  _trackArgCompletion(line) {
    const structure = line.replace(QUOTED_VALUE_RE, '""');
    const trimmed = structure.trim();
    if (trimmed === '') return false;

    const depthBefore = this._depth;
    let depth = depthBefore;
    for (const ch of structure) {
      if (ch === '[' || ch === '(') {
        depth += 1;
      } else if (ch === ']' || ch === ')') {
        depth = Math.max(0, depth - 1);
      }
    }
    this._depth = depth;

    // Count a top-level argument ONLY on the two shapes dbus-monitor actually
    // prints at depth 0: a bare scalar line (the leading `string "..."`) and a
    // line that is nothing but the closer of a top-level container. Anything
    // else reaching depth 0 is noise from a malformed value, not an argument.
    const isBareScalar = depthBefore === 0 && depth === 0;
    const isTopLevelCloser = depth === 0 && (trimmed === ']' || trimmed === ')');
    if (isBareScalar || isTopLevelCloser) {
      this._completedArgs += 1;
    }
    return this._completedArgs >= PROPERTIES_CHANGED_ARG_COUNT;
  }

  /**
   * (Re)arm the idle-flush timer. Unref'd so it never holds the process open.
   * @private
   */
  _armIdleFlush() {
    this._clearIdleFlush();
    if (!this._idleFlushMs) return;
    // PropertiesChanged completes structurally or at the next boundary only
    if (this._currentMember === 'PropertiesChanged') return;
    this._idleTimer = setTimeout(() => {
      this._idleTimer = null;
      this._emitPending();
    }, this._idleFlushMs);
    if (this._idleTimer && typeof this._idleTimer.unref === 'function') {
      this._idleTimer.unref();
    }
  }

  /** @private */
  _clearIdleFlush() {
    if (this._idleTimer) {
      clearTimeout(this._idleTimer);
      this._idleTimer = null;
    }
  }

  /** Emit any pending accumulated message. Safe to call anytime. */
  flush() {
    this._emitPending();
  }

  /**
   * Cancel timers and drop any partially accumulated message.
   * Call when the feeding process is stopped.
   */
  dispose() {
    this._clearIdleFlush();
    this._resetPending();
  }

  _emitPending() {
    this._clearIdleFlush();
    if (!this._currentHeader) return;

    // Only emit signal type messages
    if (this._currentType === 'signal') {
      const parsed = this._parseSignal(this._currentHeader, this._currentBody);
      if (parsed) {
        this.emit('signal', parsed);
      }
    }

    this._resetPending();
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
