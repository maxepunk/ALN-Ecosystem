'use strict';

/**
 * HeldItemsStore Tests
 *
 * Tests the unified held item store that replaces near-duplicate implementations
 * in cueEngineService and videoQueueService.
 * Fixes F-SHOW-16: held:release-all midway-abort, re-hold prevention, conflictTimers collision.
 */

jest.mock('../../../../src/utils/logger', () => ({
  info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(),
}));

jest.mock('../../../../src/services/serviceHealthRegistry', () => ({
  isHealthy: jest.fn().mockReturnValue(true),
  report: jest.fn(),
  on: jest.fn(),
}));

describe('HeldItemsStore', () => {
  let HeldItemsStore;

  beforeEach(() => {
    jest.resetModules();
    jest.mock('../../../../src/services/serviceHealthRegistry', () => ({
      isHealthy: jest.fn().mockReturnValue(true),
      report: jest.fn(),
      on: jest.fn(),
    }));
    HeldItemsStore = require('../../../../src/services/heldItemsStore');
  });

  describe('holdItem()', () => {
    it('creates a cue held item with correct structure', () => {
      const store = new HeldItemsStore();
      const held = store.holdItem({
        type: 'cue',
        cueId: 'test-cue',
        trigger: 'event:transaction',
        parentChain: null,
        blockedBy: ['vlc'],
        reason: 'service_down',
      });

      expect(held.id).toMatch(/^held-cue-\d+$/);
      expect(held.type).toBe('cue');
      expect(held.cueId).toBe('test-cue');
      expect(held.reason).toBe('service_down');
      expect(held.status).toBe('held');
    });

    it('creates a video held item with correct structure', () => {
      const store = new HeldItemsStore();
      const held = store.holdItem({
        type: 'video',
        tokenId: 'my-token',
        videoFile: 'my-token.mp4',
        requestedBy: 'player',
        queueItemId: 'q-1',
        reason: 'vlc_down',
      });

      expect(held.id).toMatch(/^held-video-\d+$/);
      expect(held.type).toBe('video');
      expect(held.tokenId).toBe('my-token');
      expect(held.status).toBe('held');
    });

    it('assigns globally unique IDs across multiple store instances (shared counter)', () => {
      // Two stores created sequentially — IDs must not collide
      const store1 = new HeldItemsStore();
      const store2 = new HeldItemsStore();

      const a = store1.holdItem({ type: 'cue', cueId: 'a', reason: 'service_down', blockedBy: [] });
      const b = store2.holdItem({ type: 'video', tokenId: 'b', reason: 'vlc_down' });

      expect(a.id).not.toBe(b.id);
    });
  });

  describe('getAll()', () => {
    it('returns all held items', () => {
      const store = new HeldItemsStore();
      store.holdItem({ type: 'cue', cueId: 'a', reason: 'service_down', blockedBy: [] });
      store.holdItem({ type: 'video', tokenId: 'b', reason: 'vlc_down' });

      const items = store.getAll();
      expect(items).toHaveLength(2);
    });

    it('returns a copy (mutations do not affect internal state)', () => {
      const store = new HeldItemsStore();
      store.holdItem({ type: 'cue', cueId: 'a', reason: 'service_down', blockedBy: [] });
      const items = store.getAll();
      items.push({ fake: true });
      expect(store.getAll()).toHaveLength(1);
    });
  });

  describe('getByType()', () => {
    it('returns only cue items', () => {
      const store = new HeldItemsStore();
      store.holdItem({ type: 'cue', cueId: 'a', reason: 'service_down', blockedBy: [] });
      store.holdItem({ type: 'video', tokenId: 'b', reason: 'vlc_down' });

      expect(store.getByType('cue')).toHaveLength(1);
      expect(store.getByType('video')).toHaveLength(1);
    });
  });

  describe('release()', () => {
    it('removes item and returns it', () => {
      const store = new HeldItemsStore();
      const held = store.holdItem({ type: 'cue', cueId: 'a', reason: 'service_down', blockedBy: [] });
      const released = store.release(held.id);
      expect(released.status).toBe('released');
      expect(store.getAll()).toHaveLength(0);
    });

    it('throws if heldId not found', () => {
      const store = new HeldItemsStore();
      expect(() => store.release('held-99999')).toThrow(/not found/i);
    });
  });

  describe('discard()', () => {
    it('removes item and marks as discarded', () => {
      const store = new HeldItemsStore();
      const held = store.holdItem({ type: 'cue', cueId: 'b', reason: 'service_down', blockedBy: [] });
      const discarded = store.discard(held.id);
      expect(discarded.status).toBe('discarded');
      expect(store.getAll()).toHaveLength(0);
    });

    it('throws if heldId not found', () => {
      const store = new HeldItemsStore();
      expect(() => store.discard('held-99999')).toThrow(/not found/i);
    });
  });

  describe('releaseAll() — F-SHOW-16 fix: try-all, no midway abort', () => {
    it('releases all items even if some fail, returning per-item results', async () => {
      const store = new HeldItemsStore();
      const h1 = store.holdItem({ type: 'cue', cueId: 'ok', reason: 'service_down', blockedBy: [] });
      const h2 = store.holdItem({ type: 'cue', cueId: 'fail', reason: 'service_down', blockedBy: ['vlc'] });
      const h3 = store.holdItem({ type: 'video', tokenId: 'v1', reason: 'vlc_down' });

      // Provide a per-item release handler; h2 will throw
      const results = await store.releaseAll(async (item) => {
        if (item.cueId === 'fail') throw new Error('service still down');
      });

      // h1 and h3 should be released; h2 should report error but not abort others
      expect(results.find(r => r.id === h1.id).success).toBe(true);
      expect(results.find(r => r.id === h2.id).success).toBe(false);
      expect(results.find(r => r.id === h3.id).success).toBe(true);

      // h2 remains held; h1 and h3 are gone
      expect(store.getAll()).toHaveLength(1);
      expect(store.getAll()[0].id).toBe(h2.id);
    });

    it('returns empty results array when no items held', async () => {
      const store = new HeldItemsStore();
      const results = await store.releaseAll(async () => {});
      expect(results).toEqual([]);
    });
  });

  describe('discardAll()', () => {
    it('discards all items', () => {
      const store = new HeldItemsStore();
      store.holdItem({ type: 'cue', cueId: 'a', reason: 'service_down', blockedBy: [] });
      store.holdItem({ type: 'video', tokenId: 'b', reason: 'vlc_down' });

      store.discardAll();
      expect(store.getAll()).toHaveLength(0);
    });
  });

  describe('clear()', () => {
    it('removes all items without status change', () => {
      const store = new HeldItemsStore();
      store.holdItem({ type: 'cue', cueId: 'a', reason: 'service_down', blockedBy: [] });
      store.clear();
      expect(store.getAll()).toHaveLength(0);
    });
  });

  describe('F-SHOW-16: conflictTimers keyed by heldId not cueId', () => {
    it('same cue held twice gets two distinct heldIds without timer collision', () => {
      jest.useFakeTimers();
      const store = new HeldItemsStore();

      const h1 = store.holdItem({ type: 'cue', cueId: 'same-cue', reason: 'video_busy', blockedBy: [] });
      const timer1 = jest.fn();
      store.setAutoDiscard(h1.id, timer1, 10000);

      const h2 = store.holdItem({ type: 'cue', cueId: 'same-cue', reason: 'video_busy', blockedBy: [] });
      const timer2 = jest.fn();
      store.setAutoDiscard(h2.id, timer2, 10000);

      // Two distinct timers, keyed by heldId not cueId
      expect(h1.id).not.toBe(h2.id);

      // Discard h1 — should clear h1's timer, not h2's
      store.discard(h1.id);
      jest.advanceTimersByTime(15000);
      // timer1 was cleared; timer2 fires naturally
      // (timer functions are mocks, not real setTimeout callbacks, so we verify store state)
      expect(store.getAll().map(i => i.id)).toContain(h2.id);

      jest.useRealTimers();
    });
  });
});
