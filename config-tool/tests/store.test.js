// B0 BS.3 — the shared client store (design r1 D-B0.2: "one plain
// observable store module — subscribe/update, no framework — holding
// draft identity + dirty state + auth session"). Pure module, no DOM:
// the musicModel pure-split shape, REQUIRED for new client code.

'use strict';
const { before, describe, it, beforeEach } = require('node:test');
const assert = require('node:assert');

// store.js is ESM (browser module) — dynamic import from CJS, the
// musicModel.test.js pattern.
let createStore, appStore, resetAppStore;
before(async () => {
  ({ createStore, appStore, resetAppStore } = await import('../public/js/store.js'));
});

describe('store', () => {
  describe('createStore', () => {
    it('get returns the state; update patches shallowly and notifies subscribers', () => {
      const store = createStore({ a: 1, b: 2 });
      const seen = [];
      store.subscribe((state) => seen.push({ ...state }));
      store.update({ b: 3 });
      assert.deepStrictEqual(store.get(), { a: 1, b: 3 });
      assert.deepStrictEqual(seen, [{ a: 1, b: 3 }]);
    });

    it('unsubscribe stops notifications', () => {
      const store = createStore({ n: 0 });
      let calls = 0;
      const unsub = store.subscribe(() => calls++);
      store.update({ n: 1 });
      unsub();
      store.update({ n: 2 });
      assert.strictEqual(calls, 1);
    });
  });

  describe('appStore (auth session + draft identity + dirty state)', () => {
    beforeEach(() => resetAppStore());

    it('starts logged out, no draft, clean', () => {
      const s = appStore.get();
      assert.strictEqual(s.token, null);
      assert.strictEqual(s.draft, null);
      assert.deepStrictEqual(s.dirty, {});
    });

    it('setDirty tracks per-section dirty state and isDirty aggregates', () => {
      appStore.setDirty('economy', true);
      assert.strictEqual(appStore.get().dirty.economy, true);
      assert.strictEqual(appStore.isDirty(), true);
      appStore.setDirty('economy', false);
      assert.strictEqual(appStore.isDirty(), false);
    });
  });
});
