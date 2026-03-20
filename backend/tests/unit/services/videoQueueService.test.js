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
});
