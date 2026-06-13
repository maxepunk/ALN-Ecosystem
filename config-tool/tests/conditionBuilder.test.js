const { before, describe, it } = require('node:test');
const assert = require('node:assert');

// conditionBuilder.js is ESM (browser module) — import dynamically, same
// pattern as musicModel.test.js. Only the pure coercion helper is testable
// here; the render functions need a DOM (no jsdom harness in this repo).
let coerceConditionValue;
before(async () => {
  ({ coerceConditionValue } = await import('../public/js/components/conditionBuilder.js'));
});

describe('coerceConditionValue (CT-F3: coerce by field type, not value shape)', () => {
  it('coerces numeric-looking input for numeric fields', () => {
    assert.strictEqual(coerceConditionValue('points', '75000', 'eq'), 75000);
    assert.strictEqual(coerceConditionValue('valueRating', '4', 'gte'), 4);
    assert.strictEqual(coerceConditionValue('teamScore', '10000', 'gt'), 10000);
    assert.strictEqual(coerceConditionValue('multiplier', '5', 'eq'), 5);
    assert.strictEqual(coerceConditionValue('bonus', '250000', 'eq'), 250000);
    assert.strictEqual(coerceConditionValue('duration', '12.5', 'lt'), 12.5);
  });

  it('keeps numeric-looking input as a STRING for string fields', () => {
    // A team literally named "42" must stay "42" — the backend's condition
    // ops compare strictly, so coercing here would make it never match.
    assert.strictEqual(coerceConditionValue('teamId', '42', 'eq'), '42');
    assert.strictEqual(coerceConditionValue('tokenId', '007', 'eq'), '007');
    assert.strictEqual(coerceConditionValue('cueId', '12', 'eq'), '12');
  });

  it('keeps non-numeric input raw even on numeric fields (mid-typing)', () => {
    assert.strictEqual(coerceConditionValue('points', '', 'eq'), '');
    assert.strictEqual(coerceConditionValue('points', '12abc', 'eq'), '12abc');
  });

  it('in-operator lists coerce per entry on numeric fields only', () => {
    assert.deepStrictEqual(coerceConditionValue('valueRating', '3, 4, 5', 'in'), [3, 4, 5]);
    assert.deepStrictEqual(coerceConditionValue('teamId', '42, Team Alpha', 'in'), ['42', 'Team Alpha']);
  });
});
