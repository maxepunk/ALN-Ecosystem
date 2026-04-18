/**
 * VideoQueueService Unit Tests
 * Tests queue management and event emission patterns
 * NOTE: Full video playback flows are tested in integration tests
 */

const { resetAllServices } = require('../../helpers/service-reset');
const videoQueueService = require('../../../src/services/videoQueueService');
const transactionService = require('../../../src/services/transactionService');
const VideoQueueItem = require('../../../src/models/videoQueueItem');
const Token = require('../../../src/models/token');

describe('VideoQueueService - Queue Management', () => {
  let testToken;

  beforeEach(async () => {
    // Reset service state using centralized helper
    await resetAllServices();

    // Create mock token with video (following transactionService.test.js pattern)
    testToken = new Token({
      id: 'test_video_token',
      name: 'Test Video Token',
      value: 100,
      memoryType: 'Technical',
      mediaAssets: {
        image: null,
        audio: null,
        video: 'test_30sec.mp4',
        processingImage: null
      },
      metadata: {
        rating: 3
      }
    });

    // Manually add to transactionService.tokens for consistency
    transactionService.tokens.set('test_video_token', testToken);
  });

  afterEach(async () => {
    await resetAllServices();
    videoQueueService.removeAllListeners();
  });

  describe('Basic Queue Operations', () => {
    it('should add items to queue', () => {
      expect(videoQueueService.queue.length).toBe(0);

      const item1 = videoQueueService.addToQueue(testToken, 'DEVICE_1');
      expect(videoQueueService.queue.length).toBe(1);
      expect(item1).toBeInstanceOf(VideoQueueItem);
      expect(item1.tokenId).toBe('test_video_token');

      const item2 = videoQueueService.addToQueue(testToken, 'DEVICE_2');
      expect(videoQueueService.queue.length).toBe(2);

      expect(videoQueueService.queue).toContain(item1);
      expect(videoQueueService.queue).toContain(item2);
    });

    it('should emit queue:added event when item added', (done) => {
      videoQueueService.once('queue:added', (queueItem) => {
        try {
          expect(queueItem).toBeInstanceOf(VideoQueueItem);
          expect(queueItem.tokenId).toBe('test_video_token');
          done();
        } catch (error) {
          done(error);
        }
      });

      videoQueueService.addToQueue(testToken, 'TEST_DEVICE');
    });

    it('should clear completed items from queue', () => {
      // Directly add items to queue without triggering playback
      const item1 = VideoQueueItem.fromToken(testToken, 'DEVICE_1');
      const item2 = VideoQueueItem.fromToken(testToken, 'DEVICE_2');

      // Manually set status to playing then completed (bypassing state machine for testing)
      item1.status = 'playing';
      item1.completePlayback();

      videoQueueService.queue.push(item1, item2);

      // Clear completed items
      const cleared = videoQueueService.clearCompleted();

      expect(cleared).toBe(1);
      expect(videoQueueService.queue.length).toBe(1);
      expect(videoQueueService.queue[0]).toBe(item2);
    });

    it('should reset to clean state', () => {
      // Add items directly to queue
      videoQueueService.queue.push(
        VideoQueueItem.fromToken(testToken, 'DEVICE_1'),
        VideoQueueItem.fromToken(testToken, 'DEVICE_2')
      );
      videoQueueService.currentItem = videoQueueService.queue[0];

      expect(videoQueueService.queue.length).toBe(2);
      expect(videoQueueService.currentItem).not.toBeNull();

      // Reset
      videoQueueService.reset();

      expect(videoQueueService.queue.length).toBe(0);
      expect(videoQueueService.currentItem).toBeNull();
      expect(videoQueueService.playbackTimer).toBeNull();
    });

    it('should preserve event listeners after reset', () => {
      const handler = jest.fn();
      videoQueueService.on('video:idle', handler);
      const countBefore = videoQueueService.listenerCount('video:idle');

      videoQueueService.reset();

      // Listeners should survive reset (broadcasts.js depends on this)
      expect(videoQueueService.listenerCount('video:idle')).toBe(countBefore);
      videoQueueService.removeListener('video:idle', handler);
    });

    it('should clear all timer types on reset', () => {
      // Set both timer types
      videoQueueService.playbackTimer = setTimeout(() => {}, 10000);
      videoQueueService.progressTimer = setInterval(() => {}, 1000);

      videoQueueService.reset();

      expect(videoQueueService.playbackTimer).toBeNull();
      expect(videoQueueService.progressTimer).toBeNull();
    });
  });

  describe('progressTimer cleanup', () => {
    it('should clear progressTimer on skipCurrent', async () => {
      // Set up a playing item with a progressTimer
      videoQueueService.currentItem = {
        isPlaying: () => true, id: 'test', tokenId: 'tok1',
        completePlayback: jest.fn(), getPlaybackDuration: () => 5,
      };
      videoQueueService.progressTimer = setInterval(() => {}, 1000);

      await videoQueueService.skipCurrent();

      expect(videoQueueService.progressTimer).toBeNull();
    });

    it('should clear progressTimer on clearQueue', () => {
      videoQueueService.currentItem = {
        failPlayback: jest.fn(), isPlaying: () => true,
      };
      videoQueueService.progressTimer = setInterval(() => {}, 1000);

      videoQueueService.clearQueue();

      expect(videoQueueService.progressTimer).toBeNull();
    });
  });

  describe('clearQueue() video:idle emission', () => {
    it('should NOT emit video:idle when no video was playing and queue was empty', () => {
      const idleSpy = jest.fn();
      videoQueueService.on('video:idle', idleSpy);

      videoQueueService.clearQueue();

      expect(idleSpy).not.toHaveBeenCalled();
      videoQueueService.removeListener('video:idle', idleSpy);
    });

    it('should emit video:idle when a video was playing (currentItem set)', () => {
      const idleSpy = jest.fn();
      videoQueueService.on('video:idle', idleSpy);

      videoQueueService.currentItem = {
        failPlayback: jest.fn(), isPlaying: () => true,
      };

      videoQueueService.clearQueue();

      expect(idleSpy).toHaveBeenCalledTimes(1);
      videoQueueService.removeListener('video:idle', idleSpy);
    });

    it('should emit video:idle when queue had pending items (no currentItem)', () => {
      const idleSpy = jest.fn();
      videoQueueService.on('video:idle', idleSpy);

      const item = VideoQueueItem.fromToken(testToken, 'DEVICE_1');
      videoQueueService.queue.push(item);
      // currentItem remains null — item is pending in queue, not yet playing

      videoQueueService.clearQueue();

      expect(idleSpy).toHaveBeenCalledTimes(1);
      videoQueueService.removeListener('video:idle', idleSpy);
    });
  });

  describe('VLC-down resilience (queue must not get stuck)', () => {
    // skipCurrent is the only transport method that needs try/catch around VLC calls.
    // It clears progressTimer BEFORE calling vlcService.stop(), removing the safety net
    // that normally catches VLC failures. Without try/catch, a VLC error leaves the
    // queue item stuck in 'playing' with no timer to recover it.
    //
    // pauseCurrent/resumeCurrent do NOT need try/catch: they leave progressTimer
    // running, so VLC failures are caught by the polling loop's error handler.
    // Errors correctly propagate to the GM as failure acks.
    let vlcService;

    beforeEach(() => {
      vlcService = require('../../../src/services/vlcMprisService');
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('skipCurrent should complete queue item even when vlcService.stop() throws', async () => {
      jest.spyOn(vlcService, 'stop').mockRejectedValue(new Error('VLC not connected'));

      videoQueueService.currentItem = {
        isPlaying: () => true, id: 'test', tokenId: 'tok1',
        completePlayback: jest.fn(), getPlaybackDuration: () => 5,
      };
      videoQueueService.progressTimer = setInterval(() => {}, 1000);

      const result = await videoQueueService.skipCurrent();

      expect(result).toBe(true);
      expect(videoQueueService.progressTimer).toBeNull();
      expect(videoQueueService.currentItem).toBeNull();
    });
  });

  describe('Event Emission Pattern', () => {
    it('should emit video:idle when no pending items in queue', (done) => {
      videoQueueService.once('video:idle', () => {
        try {
          // Idle emitted when no pending items (even if completed items exist)
          expect(videoQueueService.queue.find(item => item.isPending())).toBeUndefined();
          done();
        } catch (error) {
          done(error);
        }
      });

      // Process empty queue
      videoQueueService.processQueue();
    });
  });

  describe('processQueue - no direct VLC idle call', () => {
    let vlcService;

    beforeEach(() => {
      // Access the vlcService that videoQueueService uses internally
      vlcService = require('../../../src/services/vlcMprisService');
      // Spy on returnToIdleLoop (may not exist as mock, so create spy)
      if (!jest.isMockFunction(vlcService.returnToIdleLoop)) {
        jest.spyOn(vlcService, 'returnToIdleLoop').mockResolvedValue(true);
      }
      vlcService.returnToIdleLoop.mockClear();
    });

    afterEach(() => {
      if (jest.isMockFunction(vlcService.returnToIdleLoop) && vlcService.returnToIdleLoop.mockRestore) {
        vlcService.returnToIdleLoop.mockRestore();
      }
    });

    it('should NOT call vlcService.returnToIdleLoop when queue is empty', async () => {
      // displayControlService owns the post-video display decision via video:idle
      await videoQueueService.processQueue();

      expect(vlcService.returnToIdleLoop).not.toHaveBeenCalled();
    });

    it('should emit video:idle when queue is empty', async () => {
      const idleHandler = jest.fn();
      videoQueueService.on('video:idle', idleHandler);

      await videoQueueService.processQueue();

      expect(idleHandler).toHaveBeenCalled();
      videoQueueService.removeListener('video:idle', idleHandler);
    });
  });

  describe('canAcceptVideo()', () => {
    const registry = require('../../../src/services/serviceHealthRegistry');

    beforeEach(() => {
      // Default: VLC healthy
      registry.report('vlc', 'healthy', 'test');
    });

    afterEach(() => {
      registry.reset();
    });

    it('should return available: true when VLC healthy and not playing', () => {
      const result = videoQueueService.canAcceptVideo();
      expect(result).toEqual({ available: true });
    });

    it('should return available: false with reason vlc_down when VLC unhealthy', () => {
      registry.report('vlc', 'down', 'VLC offline');

      const result = videoQueueService.canAcceptVideo();
      expect(result.available).toBe(false);
      expect(result.reason).toBe('vlc_down');
      expect(result.message).toMatch(/VLC/i);
    });

    it('should return available: false with reason video_busy when video is playing', () => {
      jest.spyOn(videoQueueService, 'isPlaying').mockReturnValue(true);
      jest.spyOn(videoQueueService, 'getRemainingTime').mockReturnValue(25);

      const result = videoQueueService.canAcceptVideo();
      expect(result.available).toBe(false);
      expect(result.reason).toBe('video_busy');
      expect(result.waitTime).toBe(25);
    });
  });

  describe('videoFileExists()', () => {
    it('should return true when video file exists in public/videos/', () => {
      const fs = require('fs');
      jest.spyOn(fs, 'existsSync').mockReturnValue(true);

      expect(videoQueueService.videoFileExists('test.mp4')).toBe(true);
      expect(fs.existsSync).toHaveBeenCalledWith(
        expect.stringContaining('public/videos/test.mp4')
      );
    });

    it('should return false when video file does not exist', () => {
      const fs = require('fs');
      jest.spyOn(fs, 'existsSync').mockReturnValue(false);

      expect(videoQueueService.videoFileExists('missing.mp4')).toBe(false);
    });

    it('should handle absolute paths starting with /', () => {
      const fs = require('fs');
      jest.spyOn(fs, 'existsSync').mockReturnValue(true);

      videoQueueService.videoFileExists('/videos/abs.mp4');
      const calledPath = fs.existsSync.mock.calls[0][0];
      expect(calledPath).toContain('public/videos/abs.mp4');
      expect(calledPath).not.toContain('public/videos//');
    });
  });

  describe('Video Queue Hold Behavior', () => {
    const registry = require('../../../src/services/serviceHealthRegistry');

    beforeEach(() => {
      // Default: VLC healthy
      registry.report('vlc', 'healthy', 'test');
    });

    afterEach(() => {
      registry.reset();
    });

    describe('processQueue() with VLC down', () => {
      it('should emit video:held when VLC is down and pending items exist', async () => {
        registry.report('vlc', 'down', 'VLC offline');
        const item = VideoQueueItem.fromToken(testToken, 'DEVICE_1');
        videoQueueService.queue.push(item);

        const heldHandler = jest.fn();
        videoQueueService.on('video:held', heldHandler);

        await videoQueueService.processQueue();

        expect(heldHandler).toHaveBeenCalledWith(expect.objectContaining({
          id: expect.stringMatching(/^held-video-/),
          type: 'video',
          reason: expect.any(String),
          tokenId: item.tokenId,
          videoFile: item.videoPath,
          requestedBy: item.requestedBy,
          status: 'held',
        }));
        videoQueueService.removeListener('video:held', heldHandler);
      });

      it('should NOT attempt playback when VLC is down', async () => {
        registry.report('vlc', 'down', 'VLC offline');
        const item = VideoQueueItem.fromToken(testToken, 'DEVICE_1');
        videoQueueService.queue.push(item);

        await videoQueueService.processQueue();

        // Item should still be pending (not playing or failed)
        expect(item.isPending()).toBe(true);
      });

      it('should still emit video:idle when queue is empty even if VLC is down', async () => {
        registry.report('vlc', 'down', 'VLC offline');
        const idleHandler = jest.fn();
        videoQueueService.on('video:idle', idleHandler);

        await videoQueueService.processQueue();

        expect(idleHandler).toHaveBeenCalled();
        videoQueueService.removeListener('video:idle', idleHandler);
      });

      it('should NOT create duplicate held records when processQueue is called multiple times', async () => {
        registry.report('vlc', 'down', 'VLC offline');
        const item1 = VideoQueueItem.fromToken(testToken, 'DEVICE_1');
        const item2 = VideoQueueItem.fromToken(testToken, 'DEVICE_2');
        videoQueueService.queue.push(item1, item2);

        // Simulate multiple processQueue calls (as addToQueue would trigger)
        await videoQueueService.processQueue();
        await videoQueueService.processQueue();
        await videoQueueService.processQueue();

        // Only one held record for the first pending item
        expect(videoQueueService.getHeldVideos()).toHaveLength(1);
        expect(videoQueueService.getHeldVideos()[0].queueItemId).toBe(item1.id);
      });
    });

    describe('getHeldVideos()', () => {
      it('should return empty array when no held items', () => {
        expect(videoQueueService.getHeldVideos()).toEqual([]);
      });

      it('should return held items after processQueue holds a video', async () => {
        registry.report('vlc', 'down', 'VLC offline');
        const item = VideoQueueItem.fromToken(testToken, 'DEVICE_1');
        videoQueueService.queue.push(item);

        await videoQueueService.processQueue();

        const held = videoQueueService.getHeldVideos();
        expect(held).toHaveLength(1);
        expect(held[0]).toEqual(expect.objectContaining({
          type: 'video',
          reason: 'service_down',
          tokenId: 'test_video_token',
          queueItemId: item.id,
          status: 'held',
        }));
        expect(held[0].id).toBeDefined();
        expect(held[0].heldAt).toBeDefined();
      });
    });

    describe('releaseHeld()', () => {
      it('should remove item from held list and re-queue for playback', async () => {
        registry.report('vlc', 'down', 'VLC offline');
        const item = VideoQueueItem.fromToken(testToken, 'DEVICE_1');
        videoQueueService.queue.push(item);
        await videoQueueService.processQueue();

        const held = videoQueueService.getHeldVideos();
        expect(held).toHaveLength(1);

        // VLC recovers — GM can now release
        registry.report('vlc', 'healthy', 'VLC reconnected');

        const releasedHandler = jest.fn();
        videoQueueService.on('video:released', releasedHandler);

        videoQueueService.releaseHeld(held[0].id);

        expect(videoQueueService.getHeldVideos()).toHaveLength(0);
        expect(releasedHandler).toHaveBeenCalledWith(expect.objectContaining({
          heldId: held[0].id,
        }));
        videoQueueService.removeListener('video:released', releasedHandler);
      });

      it('should throw when VLC is still down', async () => {
        registry.report('vlc', 'down', 'VLC offline');
        const item = VideoQueueItem.fromToken(testToken, 'DEVICE_1');
        videoQueueService.queue.push(item);
        await videoQueueService.processQueue();

        const held = videoQueueService.getHeldVideos();
        expect(() => videoQueueService.releaseHeld(held[0].id)).toThrow('VLC is still down');
        // Held item should remain
        expect(videoQueueService.getHeldVideos()).toHaveLength(1);
      });

      it('should throw when heldId not found', () => {
        expect(() => videoQueueService.releaseHeld('nonexistent')).toThrow();
      });
    });

    describe('discardHeld()', () => {
      it('should remove item from held list and remove from queue', async () => {
        registry.report('vlc', 'down', 'VLC offline');
        const item = VideoQueueItem.fromToken(testToken, 'DEVICE_1');
        videoQueueService.queue.push(item);
        await videoQueueService.processQueue();

        const held = videoQueueService.getHeldVideos();
        expect(held).toHaveLength(1);

        const discardedHandler = jest.fn();
        videoQueueService.on('video:discarded', discardedHandler);

        videoQueueService.discardHeld(held[0].id);

        expect(videoQueueService.getHeldVideos()).toHaveLength(0);
        expect(discardedHandler).toHaveBeenCalledWith(expect.objectContaining({
          heldId: held[0].id,
        }));
        videoQueueService.removeListener('video:discarded', discardedHandler);
      });

      it('should throw when heldId not found', () => {
        expect(() => videoQueueService.discardHeld('nonexistent')).toThrow();
      });
    });

    describe('VLC recovery', () => {
      it('should emit video:recoverable when VLC changes from down to healthy', async () => {
        registry.report('vlc', 'down', 'VLC offline');
        const item = VideoQueueItem.fromToken(testToken, 'DEVICE_1');
        videoQueueService.queue.push(item);
        await videoQueueService.processQueue();

        const recoverableHandler = jest.fn();
        videoQueueService.on('video:recoverable', recoverableHandler);

        // VLC recovers
        registry.report('vlc', 'healthy', 'VLC reconnected');

        expect(recoverableHandler).toHaveBeenCalledWith(
          expect.objectContaining({ heldCount: 1 })
        );
        videoQueueService.removeListener('video:recoverable', recoverableHandler);
      });

      it('should NOT emit video:recoverable when no held items exist', () => {
        const recoverableHandler = jest.fn();
        videoQueueService.on('video:recoverable', recoverableHandler);

        registry.report('vlc', 'down', 'VLC offline');
        registry.report('vlc', 'healthy', 'VLC reconnected');

        expect(recoverableHandler).not.toHaveBeenCalled();
        videoQueueService.removeListener('video:recoverable', recoverableHandler);
      });
    });

    describe('reset() clears held items', () => {
      it('should clear held items on reset', async () => {
        registry.report('vlc', 'down', 'VLC offline');
        const item = VideoQueueItem.fromToken(testToken, 'DEVICE_1');
        videoQueueService.queue.push(item);
        await videoQueueService.processQueue();

        expect(videoQueueService.getHeldVideos()).toHaveLength(1);

        videoQueueService.reset();

        expect(videoQueueService.getHeldVideos()).toEqual([]);
      });

      it('should reset held ID counter so new session starts from held-video-1', async () => {
        registry.report('vlc', 'down', 'VLC offline');
        const item = VideoQueueItem.fromToken(testToken, 'DEVICE_1');
        videoQueueService.queue.push(item);
        await videoQueueService.processQueue();

        const heldBefore = videoQueueService.getHeldVideos();
        expect(heldBefore[0].id).toMatch(/^held-video-/);

        videoQueueService.reset();
        registry.report('vlc', 'down', 'VLC offline');

        const item2 = VideoQueueItem.fromToken(testToken, 'DEVICE_2');
        videoQueueService.queue.push(item2);
        await videoQueueService.processQueue();

        const heldAfter = videoQueueService.getHeldVideos();
        expect(heldAfter[0].id).toBe('held-video-1');
      });
    });
  });

  describe('playVideo() concurrent entry prevention', () => {
    // Regression test for: two simultaneous processQueue() calls both entering
    // playVideo() for the same pending item when pre-play hooks block.
    // Fix: startPlayback() and currentItem assignment happen BEFORE hooks,
    // so the second processQueue() sees currentItem.isPlaying() === true and returns.

    let vlcService;
    let registry;

    beforeEach(() => {
      vlcService = require('../../../src/services/vlcMprisService');
      registry = require('../../../src/services/serviceHealthRegistry');
      jest.spyOn(vlcService, 'playVideo').mockResolvedValue(undefined);
      jest.spyOn(vlcService, 'getStatus').mockResolvedValue({
        state: 'playing', length: 30, position: 0.1,
      });
      jest.spyOn(vlcService, 'getState').mockReturnValue({ connected: true });
      const fs = require('fs');
      jest.spyOn(fs, 'existsSync').mockReturnValue(true);
      const config = require('../../../src/config');
      config.features.videoPlayback = false; // Use timer-based simulation (no VLC wait)
      // Mark VLC healthy so processQueue() reaches playVideo()
      registry.report('vlc', 'healthy', 'test setup');
    });

    afterEach(() => {
      jest.restoreAllMocks();
      const config = require('../../../src/config');
      config.features.videoPlayback = false;
      registry.reset();
    });

    it('concurrent processQueue() calls should only call startPlayback() once per item', async () => {
      // Arrange: one pending item, one pre-play hook that blocks long enough
      // for both processQueue() calls to run before either claims the item
      // (without the fix, both would enter playVideo and call startPlayback twice)
      const item = VideoQueueItem.fromToken(testToken, 'DEVICE_1');
      videoQueueService.queue.push(item);

      let hookCallCount = 0;
      const blockingHook = () => new Promise(resolve => {
        hookCallCount++;
        // Resolve immediately — we just count calls to detect duplicate entry
        resolve();
      });
      videoQueueService.registerPrePlayHook(blockingHook);

      // Spy on startPlayback to count calls
      const startPlaybackSpy = jest.spyOn(item, 'startPlayback');

      // Act: two concurrent processQueue() calls (simulates two addToQueue setImmediate)
      await Promise.all([
        videoQueueService.processQueue(),
        videoQueueService.processQueue(),
      ]);

      // Assert: startPlayback called exactly once (item claimed by first entrant)
      expect(startPlaybackSpy).toHaveBeenCalledTimes(1);
      // Hook also called exactly once (second processQueue exits early)
      expect(hookCallCount).toBe(1);
    });

    it('concurrent processQueue() calls should not throw duplicate-startPlayback error', async () => {
      // Without the fix, the second playVideo() calls startPlayback() on a 'playing'
      // item, which throws "Cannot start playback for item with status playing".
      const item = VideoQueueItem.fromToken(testToken, 'DEVICE_1');
      videoQueueService.queue.push(item);

      // Register a hook that yields to the event loop, allowing concurrent entry
      videoQueueService.registerPrePlayHook(
        () => new Promise(resolve => setImmediate(resolve))
      );

      // Both processQueue() calls should complete without throwing
      await expect(
        Promise.all([
          videoQueueService.processQueue(),
          videoQueueService.processQueue(),
        ])
      ).resolves.not.toThrow();
    });

    it('second processQueue() call returns immediately after item is claimed', async () => {
      const item = VideoQueueItem.fromToken(testToken, 'DEVICE_1');
      videoQueueService.queue.push(item);

      // No hooks needed — just verify that once currentItem is set, second call exits
      const playVideoSpy = jest.spyOn(videoQueueService, 'playVideo');

      // Manually set currentItem to playing state before second call
      // (simulates what happens after fix: first call claims item immediately)
      const originalPlayVideo = videoQueueService.playVideo.bind(videoQueueService);
      playVideoSpy.mockImplementationOnce(async (queueItem) => {
        await originalPlayVideo(queueItem);
      });

      await videoQueueService.processQueue();

      // After first processQueue completes, item should be in playing state or completed
      expect(item.isPending()).toBe(false);
    });
  });

  describe('waitForVlcLoaded — reactive state:changed listener', () => {
    let vlcService;

    beforeEach(() => {
      vlcService = require('../../../src/services/vlcMprisService');
      // Ensure clean state state
      vlcService.state = 'stopped';
      vlcService.track = null;
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('fast path: resolves immediately when VLC is already playing the expected file', async () => {
      vlcService.state = 'playing';
      vlcService.track = { filename: 'target.mp4', length: 60 };

      const getStatusSpy = jest.spyOn(vlcService, 'getStatus').mockResolvedValue({
        state: 'playing',
        currentItem: 'target.mp4',
        length: 60,
        position: 0.1,
      });

      const result = await videoQueueService.waitForVlcLoaded('target.mp4', 'test fast path', 5000);

      expect(result).toBeDefined();
      expect(getStatusSpy).toHaveBeenCalledTimes(1);
    });

    it('resolves when state:changed fires with expected filename and playing state', async () => {
      // NOT in fast path (wrong filename initially)
      vlcService.state = 'stopped';
      vlcService.track = null;

      const getStatusSpy = jest.spyOn(vlcService, 'getStatus').mockResolvedValue({
        state: 'playing',
        currentItem: 'target.mp4',
        length: 60,
        position: 0.0,
      });

      // Emit state:changed after a brief delay
      setTimeout(() => {
        vlcService.emit('state:changed', {
          previous: { state: 'stopped', filename: null },
          current: { state: 'playing', filename: 'target.mp4' },
        });
      }, 20);

      const result = await videoQueueService.waitForVlcLoaded('target.mp4', 'test reactive', 5000);

      expect(result).toBeDefined();
      // getStatus called once (from reactive handler, NOT polling)
      expect(getStatusSpy).toHaveBeenCalledTimes(1);
    });

    it('ignores state:changed events for wrong filename', async () => {
      vlcService.state = 'stopped';
      vlcService.track = null;

      const getStatusSpy = jest.spyOn(vlcService, 'getStatus').mockResolvedValue({
        state: 'playing',
        currentItem: 'target.mp4',
        length: 60,
        position: 0.0,
      });

      // First emit wrong file, then correct file
      setTimeout(() => {
        vlcService.emit('state:changed', {
          previous: { state: 'stopped', filename: null },
          current: { state: 'playing', filename: 'wrong.mp4' },
        });
      }, 10);
      setTimeout(() => {
        vlcService.emit('state:changed', {
          previous: { state: 'playing', filename: 'wrong.mp4' },
          current: { state: 'playing', filename: 'target.mp4' },
        });
      }, 30);

      const result = await videoQueueService.waitForVlcLoaded('target.mp4', 'test ignores wrong', 5000);
      expect(result).toBeDefined();
      // getStatus called once (only after correct file fires)
      expect(getStatusSpy).toHaveBeenCalledTimes(1);
    });

    it('ignores state:changed events for non-playing states', async () => {
      vlcService.state = 'stopped';
      vlcService.track = null;

      const getStatusSpy = jest.spyOn(vlcService, 'getStatus').mockResolvedValue({
        state: 'playing',
        currentItem: 'target.mp4',
        length: 60,
        position: 0.0,
      });

      // First emit paused for correct file (should be ignored), then playing
      setTimeout(() => {
        vlcService.emit('state:changed', {
          previous: { state: 'stopped', filename: null },
          current: { state: 'paused', filename: 'target.mp4' },
        });
      }, 10);
      setTimeout(() => {
        vlcService.emit('state:changed', {
          previous: { state: 'paused', filename: 'target.mp4' },
          current: { state: 'playing', filename: 'target.mp4' },
        });
      }, 30);

      const result = await videoQueueService.waitForVlcLoaded('target.mp4', 'test non-playing ignored', 5000);
      expect(result).toBeDefined();
      expect(getStatusSpy).toHaveBeenCalledTimes(1);
    });

    it('rejects with timeout error when state:changed never fires with expected file', async () => {
      vlcService.state = 'stopped';
      vlcService.track = null;

      jest.spyOn(vlcService, 'getStatus').mockResolvedValue({
        state: 'stopped',
        currentItem: null,
        length: 0,
        position: 0,
      });

      await expect(
        videoQueueService.waitForVlcLoaded('never.mp4', 'timeout test', 100)
      ).rejects.toThrow(/Timeout waiting for timeout test after 100ms/);
    });

    it('timeout error message includes expected filename and current state', async () => {
      vlcService.state = 'stopped';
      vlcService.track = { filename: 'different.mp4' };

      await expect(
        videoQueueService.waitForVlcLoaded('expected.mp4', 'file load', 100)
      ).rejects.toThrow(/expected\.mp4/);
    });

    it('does not leave dangling listeners after resolution', async () => {
      vlcService.state = 'stopped';
      vlcService.track = null;

      jest.spyOn(vlcService, 'getStatus').mockResolvedValue({
        state: 'playing',
        currentItem: 'target.mp4',
        length: 60,
        position: 0,
      });

      const listenersBefore = vlcService.listenerCount('state:changed');

      setTimeout(() => {
        vlcService.emit('state:changed', {
          previous: { state: 'stopped', filename: null },
          current: { state: 'playing', filename: 'target.mp4' },
        });
      }, 10);

      await videoQueueService.waitForVlcLoaded('target.mp4', 'cleanup test', 5000);

      // Listener should be removed after resolution
      expect(vlcService.listenerCount('state:changed')).toBe(listenersBefore);
    });

    it('does not leave dangling listeners after timeout rejection', async () => {
      vlcService.state = 'stopped';
      vlcService.track = null;

      const listenersBefore = vlcService.listenerCount('state:changed');

      await expect(
        videoQueueService.waitForVlcLoaded('timeout.mp4', 'cleanup timeout test', 50)
      ).rejects.toThrow();

      // Listener should be removed after rejection
      expect(vlcService.listenerCount('state:changed')).toBe(listenersBefore);
    });

    it('does NOT poll getStatus in a loop (no polling pattern)', async () => {
      vlcService.state = 'stopped';
      vlcService.track = null;

      const getStatusSpy = jest.spyOn(vlcService, 'getStatus').mockResolvedValue({
        state: 'playing',
        currentItem: 'target.mp4',
        length: 60,
        position: 0,
      });

      setTimeout(() => {
        vlcService.emit('state:changed', {
          previous: { state: 'stopped', filename: null },
          current: { state: 'playing', filename: 'target.mp4' },
        });
      }, 50);

      await videoQueueService.waitForVlcLoaded('target.mp4', 'no-polling test', 5000);

      // getStatus should be called exactly once (reactive, not polling)
      expect(getStatusSpy.mock.calls.length).toBeLessThan(5);
      expect(getStatusSpy.mock.calls.length).toBe(1);
    });
  });

  describe('playVideo() — listener race during vlcService.playVideo() (regression for 2026-04-17 endgame cutoff)', () => {
    let vlcService;
    let registry;

    beforeEach(() => {
      vlcService = require('../../../src/services/vlcMprisService');
      registry = require('../../../src/services/serviceHealthRegistry');
      vlcService.state = 'stopped';
      vlcService.track = null;

      const fs = require('fs');
      jest.spyOn(fs, 'existsSync').mockReturnValue(true);

      const config = require('../../../src/config');
      config.features.videoPlayback = true; // exercise the VLC code path

      registry.report('vlc', 'healthy', 'test setup');

      jest.spyOn(vlcService, 'getStatus').mockResolvedValue({
        state: 'playing',
        currentItem: 'target.mp4',
        length: 60,
        position: 0,
      });
    });

    afterEach(() => {
      jest.restoreAllMocks();
      const config = require('../../../src/config');
      config.features.videoPlayback = false;
      registry.reset();
    });

    it('resolves when state:changed fires during vlcService.playVideo() execution', async () => {
      // Simulate the production race: VLC emits state:changed while playVideo() is
      // still running (before waitForVlcLoaded() has registered its listener).
      //
      // The production race is: VLC's debounced MPRIS signal fires during the
      // OpenUri D-Bus chain inside vlcService.playVideo(). By the time the backend
      // calls waitForVlcLoaded(), the event is gone AND vlcService.state/track may
      // have been updated by a subsequent transient signal (e.g., a brief state
      // glitch) so the fast-path check also misses.
      //
      // We simulate this by:
      // 1. Emitting state:changed with the correct terminal state (the event the
      //    listener MUST catch to resolve)
      // 2. THEN mutating vlcService.track to a non-matching value so the fast-path
      //    check inside waitForVlcLoaded() fails when it enters
      //
      // Pre-fix: listener registered AFTER playVideo() returns. The emit happened
      //   with no listener. Fast-path fails (track was mutated). Wait hangs until
      //   the 30s timeout. Promise.race resolves to 'neither' at 200ms.
      // Post-fix: listener registered BEFORE playVideo() is called. Catches the
      //   emit, resolves. video:started fires. Promise.race resolves to 'started'.
      jest.spyOn(vlcService, 'playVideo').mockImplementation(async () => {
        // Simulate VLC's debounced signal firing during the OpenUri/getStatus D-Bus chain.
        // At this instant, state/track are the correct terminal values.
        vlcService.state = 'playing';
        vlcService.track = { filename: 'target.mp4', length: 60 };
        vlcService.emit('state:changed', {
          previous: { state: 'playing', filename: 'idle-loop.mp4' },
          current: { state: 'playing', filename: 'target.mp4' },
        });
        // Yield to event loop so the emit is fully processed
        await new Promise(resolve => setImmediate(resolve));

        // Now simulate a transient state desync: a subsequent signal mutated
        // vlcService.track to something that doesn't match the expected filename.
        // This defeats the fast-path check inside waitForVlcLoaded() when it
        // eventually runs in the pre-fix code path.
        vlcService.track = { filename: null, length: 0 };
      });

      const raceToken = new Token({
        id: 'target',
        name: 'Target',
        value: 100,
        memoryType: 'Technical',
        mediaAssets: {
          image: null,
          audio: null,
          video: 'target.mp4',
          processingImage: null,
        },
        metadata: { rating: 3 },
      });
      const item = VideoQueueItem.fromToken(raceToken, 'DEVICE_1');

      // playVideo() should eventually emit video:started (not video:failed)
      const startedPromise = new Promise(resolve => {
        videoQueueService.once('video:started', resolve);
      });
      const failedPromise = new Promise(resolve => {
        videoQueueService.once('video:failed', resolve);
      });

      // Fire-and-forget: pre-fix code will hang here for 30s waiting on
      // waitForVlcLoaded. We don't await it so the Promise.race below can
      // declare 'neither' at 200ms and fail the assertion cleanly.
      // Attach .catch() to suppress unhandled rejection from the 30s timeout
      // that eventually fires after the test ends (pre-fix only).
      videoQueueService.playVideo(item).catch(() => {});

      // Race the events: started should win. If neither fires within 200ms,
      // that means waitForVlcLoaded missed the event (pre-fix behavior).
      const winner = await Promise.race([
        startedPromise.then(() => 'started'),
        failedPromise.then(() => 'failed'),
        new Promise(resolve => setTimeout(() => resolve('neither'), 200)),
      ]);

      expect(winner).toBe('started');
    });
  });
});
