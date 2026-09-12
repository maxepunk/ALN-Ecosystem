/**
 * Shared client store (B0 BS.3, design r1 D-B0.2): ONE plain
 * observable — subscribe/update, no framework — holding the auth
 * session, the draft identity, and per-section dirty state. Sections
 * and the api layer read/write through this instead of ad-hoc module
 * state.
 *
 * Pure module, no DOM, no fetch — the musicModel pure-split shape
 * (REQUIRED for new client code), testable under node:test.
 */

export function createStore(initial) {
  let state = { ...initial };
  const subscribers = new Set();

  return {
    get: () => state,
    update(patch) {
      state = { ...state, ...patch };
      for (const fn of subscribers) fn(state);
    },
    subscribe(fn) {
      subscribers.add(fn);
      return () => subscribers.delete(fn);
    },
  };
}

const INITIAL = { token: null, draft: null, dirty: {} };

function buildAppStore() {
  const store = createStore({ ...INITIAL, dirty: {} });
  return {
    ...store,
    /** Per-section dirty flag (replaces app.js's ad-hoc dirtyState). */
    setDirty(section, dirty) {
      store.update({ dirty: { ...store.get().dirty, [section]: dirty } });
    },
    /** True when ANY section has unsaved changes. */
    isDirty() {
      return Object.values(store.get().dirty).some(Boolean);
    },
  };
}

export let appStore = buildAppStore();

/** Test seam: fresh app store state between cases. */
export function resetAppStore() {
  appStore = buildAppStore();
  return appStore;
}
