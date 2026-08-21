/**
 * Money display formatting — pure grammar (A3 slice 3b, R-3b-1).
 *
 * gameRules/formatting is the scanner-parity surface: the scanner's
 * utils/formatCurrency.js must produce IDENTICAL output for every
 * fixture format (its own suite carries the twin pins).
 */

const fs = require('fs');
const path = require('path');
const { parseMoneyFormat, formatMoney, BAKED_MONEY_SPEC } = require('../../../src/gameRules/formatting');

const ALN_GAME = JSON.parse(fs.readFileSync(
  path.resolve(__dirname, '../../../../ALN-TokenData/game.json'), 'utf8'
));
const TOY_GAME = JSON.parse(fs.readFileSync(
  path.resolve(__dirname, '../../e2e/fixtures/packs/toy-heist/game.json'), 'utf8'
));

describe('gameRules/formatting (R-3b-1 grammar)', () => {
  describe('parseMoneyFormat', () => {
    it('parses the ALN spec into affixes', () => {
      expect(parseMoneyFormat('$#,###')).toEqual({ prefix: '$', suffix: '' });
    });

    it('parses suffix-unit specs (the toy class)', () => {
      expect(parseMoneyFormat('#,### cr')).toEqual({ prefix: '', suffix: ' cr' });
      expect(parseMoneyFormat('€ #,###')).toEqual({ prefix: '€ ', suffix: '' });
      expect(parseMoneyFormat('#,###')).toEqual({ prefix: '', suffix: '' });
    });

    it.each(['dollars', '$#,###-#,###', '##,###', '$#,##', '', null, undefined, 42])(
      'returns null for undrivable %j', (bad) => {
        expect(parseMoneyFormat(bad)).toBeNull();
      }
    );
  });

  describe('formatMoney', () => {
    const aln = parseMoneyFormat('$#,###');
    const toy = parseMoneyFormat('#,### cr');

    it('BYTE-IDENTITY with the legacy scanner expression under the ALN spec (incl. negatives)', () => {
      // The legacy formatCurrency was '$' + (value || 0).toLocaleString()
      // — the sign rides the number token ($-25,000, the B9 golden quirk).
      for (const v of [0, 1, 999, 1000, 25000, 150000, 750000, -25000, -1000000]) {
        expect(formatMoney(v, aln)).toBe('$' + (v || 0).toLocaleString('en-US'));
      }
      expect(formatMoney(-25000, aln)).toBe('$-25,000');
    });

    it('renders the toy spec with the suffix outside the signed number', () => {
      expect(formatMoney(25000, toy)).toBe('25,000 cr');
      expect(formatMoney(-25000, toy)).toBe('-25,000 cr');
      expect(formatMoney(0, toy)).toBe('0 cr');
    });

    it('null/undefined/NaN render as 0 (legacy || 0 semantics preserved)', () => {
      expect(formatMoney(null, aln)).toBe('$0');
      expect(formatMoney(undefined, aln)).toBe('$0');
      expect(formatMoney(NaN, aln)).toBe('$0');
    });

    it('a null spec falls back to the baked ALN spec', () => {
      expect(formatMoney(5000, null)).toBe('$5,000');
      expect(formatMoney(5000)).toBe('$5,000');
    });
  });

  describe('drift tripwires (pack ↔ bake)', () => {
    it('BAKED_MONEY_SPEC equals the parsed REAL ALN game.json format', () => {
      expect(BAKED_MONEY_SPEC).toEqual(parseMoneyFormat(ALN_GAME.scoring.display.format));
    });

    it('both fixture packs declare drivable formats (the grammar has live consumers)', () => {
      expect(parseMoneyFormat(ALN_GAME.scoring.display.format)).not.toBeNull();
      expect(parseMoneyFormat(TOY_GAME.scoring.display.format)).not.toBeNull();
      // And they genuinely diverge — the dual-pack legs exercise the
      // grammar for real, not two copies of the ALN spec.
      expect(TOY_GAME.scoring.display.format).not.toBe(ALN_GAME.scoring.display.format);
    });
  });
});
