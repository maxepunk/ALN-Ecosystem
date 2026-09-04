// B0 BS.3 — draftBar DOM component under jsdom (the harness the design
// adds: DOM-layer units run under node:test + jsdom; touched files gain
// coverage).

'use strict';
const { before, describe, it, beforeEach } = require('node:test');
const assert = require('node:assert');

let renderDraftBar, dom;

before(async () => {
  const { JSDOM } = require('jsdom');
  dom = new JSDOM('<div id="bar"></div>');
  global.document = dom.window.document;
  ({ renderDraftBar } = await import('../public/js/components/draftBar.js'));
});

const STAMP = {
  draftId: 'dabc-123',
  base: { contentHash: 'sha256:0123456789abcdef' },
};

describe('draftBar', () => {
  let container;

  beforeEach(() => {
    container = dom.window.document.getElementById('bar');
    container.textContent = '';
  });

  it('renders the draft identity (id + base hash prefix) with Publish and Discard', () => {
    renderDraftBar(container, STAMP, { onPublish() {}, onDiscard() {} });
    const label = container.querySelector('.draft-bar__label');
    assert.match(label.textContent, /dabc-123/);
    assert.match(label.textContent, /01234567/);
    assert.ok(container.querySelector('.draft-bar__publish'));
    assert.ok(container.querySelector('.draft-bar__discard'));
  });

  it('clicking Publish / Discard fires the handlers', () => {
    const fired = [];
    renderDraftBar(container, STAMP, {
      onPublish: () => fired.push('publish'),
      onDiscard: () => fired.push('discard'),
    });
    container.querySelector('.draft-bar__publish').click();
    container.querySelector('.draft-bar__discard').click();
    assert.deepStrictEqual(fired, ['publish', 'discard']);
  });

  it('renders empty when there is no draft', () => {
    renderDraftBar(container, STAMP, { onPublish() {}, onDiscard() {} });
    renderDraftBar(container, null, { onPublish() {}, onDiscard() {} });
    assert.strictEqual(container.children.length, 0);
  });
});
