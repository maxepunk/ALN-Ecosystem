/**
 * Money display formatting — pure functions (A3 slice 3b, ruling R-3b-1).
 *
 * The pack's `scoring.display.format` is the driving spec, parsed with a
 * deliberately MINIMAL grammar: exactly one '#,###' number token (signed
 * integer, en-US comma grouping) wrapped by literal prefix/suffix affixes.
 * "$#,###" → "$150,000" / "$-25,000" (the sign rides the number token —
 * byte-identical to the legacy '$' + toLocaleString output, including the
 * B9 golden's negative quirk). "#,### cr" → "25,000 cr".
 *
 * gameRules/ is the engine/game seam AND the scanner-parity surface: the
 * scanner's utils/formatCurrency.js must match this module's outputs for
 * every fixture format (drift-tripwired in both suites). Schema-open,
 * gate-enforced: game.schema.json patterns the grammar; the activation
 * gate refuses formats parseMoneyFormat cannot drive.
 *
 * No I/O, no service reads — plain values only.
 */

const NUMBER_TOKEN = /^([^#]*)#,###([^#]*)$/;

// The baked ALN spec — the shim/fallback twin of the pack default
// (drift-mirrored against ALN-TokenData/game.json in the unit suite).
const BAKED_MONEY_SPEC = Object.freeze({ prefix: '$', suffix: '' });

/**
 * Parse a pack-declared money format into an affix spec.
 * @param {*} format - scoring.display.format value
 * @returns {{prefix: string, suffix: string}|null} null when undrivable
 */
function parseMoneyFormat(format) {
  const m = typeof format === 'string' ? format.match(NUMBER_TOKEN) : null;
  return m ? { prefix: m[1], suffix: m[2] } : null;
}

/**
 * Render a money value under a parsed spec (baked ALN spec when null).
 * @param {number} value
 * @param {{prefix: string, suffix: string}|null} [spec]
 * @returns {string}
 */
function formatMoney(value, spec) {
  const { prefix, suffix } = spec || BAKED_MONEY_SPEC;
  // (value || 0) mirrors the scanner's legacy formatCurrency exactly
  // (null/undefined/NaN all render as 0); explicit en-US pins the
  // grouping the report contract and E2E assertions already assume.
  return prefix + (value || 0).toLocaleString('en-US') + suffix;
}

module.exports = { parseMoneyFormat, formatMoney, BAKED_MONEY_SPEC };
