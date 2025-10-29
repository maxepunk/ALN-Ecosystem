/**
 * VideoQueueService Unit Tests
 * Tests queue management and event emission patterns
 * NOTE: Full video playback flows are tested in integration tests
 */

const { resetAllServices } = require('../../helpers/service-reset');
const videoQueueService = require('../../../src/services/videoQueueService');
const tokenService = require('../../../src/services/tokenService');
const transactionService = require('../../../src/services/transactionService');
const VideoQueueItem = require('../../../src/models/videoQueueItem');

describe('VideoQueueService - Queue Management', () => {
  let testToken;

  beforeAll(async () => {
    // Initialize transactionService with tokens
    const tokens = tokenService.loadTokens();
    await transactionService.init(tokens);
  });

  beforeEach(async () => {
    // Reset service state using centralized helper
    await resetAllServices();

    // Get test token from transactionService
    testToken = transactionService.tokens.get('534e2b03'); // test_30sec.mp4
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
      expect(item1.tokenId).toBe('534e2b03');

      const item2 = videoQueueService.addToQueue(testToken, 'DEVICE_2');
      expect(videoQueueService.queue.length).toBe(2);

      expect(videoQueueService.queue).toContain(item1);
      expect(videoQueueService.queue).toContain(item2);
    });

    it('should emit queue:added event when item added', (done) => {
      videoQueueService.once('queue:added', (queueItem) => {
        try {
          expect(queueItem).toBeInstanceOf(VideoQueueItem);
          expect(queueItem.tokenId).toBe('534e2b03');
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
});
