/**
 * Grammar-twin pins for public/js/utils/formatting.js (A3 slice 3b —
 * review F: the config-tool copy had no tests). The ESM module is
 * dynamic-imported from this CJS node:test harness.
 */
'use strict';
const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert');

const mod = import('../public/js/utils/formatting.js');

describe('formatting grammar twin (slice 3b)', () => {
  beforeEach(async () => {
    const { applyPackMoneyFormat } = await mod;
    applyPackMoneyFormat(null); // baked ALN spec
  });

  it('baked spec matches the engine convention, including negatives on the number token', async () => {
    const { formatCurrency } = await mod;
    assert.strictEqual(formatCurrency(150000), '$150,000');
    assert.strictEqual(formatCurrency(0), '$0');
    assert.strictEqual(formatCurrency(null), '$0');
    // Engine convention (NOT Intl's -$25,000): sign rides the number token
    assert.strictEqual(formatCurrency(-25000), '$-25,000');
  });

  it('applies a drivable pack format (the toy class) and declines undrivable ones', async () => {
    const { formatCurrency, applyPackMoneyFormat } = await mod;
    assert.strictEqual(applyPackMoneyFormat('#,### cr'), true);
    assert.strictEqual(formatCurrency(25000), '25,000 cr');
    assert.strictEqual(applyPackMoneyFormat('dollars'), false);
    assert.strictEqual(formatCurrency(25000), '$25,000'); // reset to baked, not stale
  });
});
