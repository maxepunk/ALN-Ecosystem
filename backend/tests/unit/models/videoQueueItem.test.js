const VideoQueueItem = require('../../../src/models/videoQueueItem');

describe('VideoQueueItem', () => {
  describe('constructor', () => {
    test('creates with pending status', () => {
      const item = new VideoQueueItem({
        tokenId: 'tok1',
        videoPath: '/videos/tok1.mp4',
        requestedBy: 'player-001'
      });
      expect(item.isPending()).toBe(true);
      expect(item.tokenId).toBe('tok1');
    });

    test('auto-generates id if not provided', () => {
      const item = new VideoQueueItem({ tokenId: 'tok1', videoPath: '/v.mp4', requestedBy: 'p1' });
      expect(item.id).toBeTruthy();
    });
  });

  describe('playback lifecycle', () => {
    let item;
    beforeEach(() => {
      item = new VideoQueueItem({
        tokenId: 'tok1',
        videoPath: '/videos/tok1.mp4',
        requestedBy: 'player-001'
      });
    });

    test('startPlayback transitions pending → playing', () => {
      item.startPlayback();
      expect(item.isPlaying()).toBe(true);
      expect(item.playbackStart).toBeTruthy();
    });

    test('startPlayback throws if not pending', () => {
      item.startPlayback();
      expect(() => item.startPlayback()).toThrow();
    });

    test('completePlayback transitions playing → completed', () => {
      item.startPlayback();
      item.completePlayback();
      expect(item.isCompleted()).toBe(true);
      expect(item.playbackEnd).toBeTruthy();
    });

    test('completePlayback throws if not playing', () => {
      expect(() => item.completePlayback()).toThrow();
    });

    test('failPlayback sets error and failed status', () => {
      item.startPlayback();
      item.failPlayback('VLC crashed');
      expect(item.hasFailed()).toBe(true);
      expect(item.error).toBe('VLC crashed');
    });

    test('failPlayback works from pending state', () => {
      item.failPlayback('File not found');
      expect(item.hasFailed()).toBe(true);
    });
  });

  describe('timing calculations', () => {
    test('getPlaybackDuration returns seconds for completed item', () => {
      const item = new VideoQueueItem({
        tokenId: 'tok1', videoPath: '/v.mp4', requestedBy: 'p1'
      });
      item.startPlayback();
      // Simulate 2 seconds of playback
      item.playbackStart = new Date(Date.now() - 2000).toISOString();
      item.completePlayback();
      const duration = item.getPlaybackDuration();
      expect(duration).toBeGreaterThanOrEqual(1);
    });

    test('getPlaybackDuration returns null if not completed', () => {
      const item = new VideoQueueItem({
        tokenId: 'tok1', videoPath: '/v.mp4', requestedBy: 'p1'
      });
      expect(item.getPlaybackDuration()).toBeNull();
    });

    test('shouldTimeout returns true for long-running playback', () => {
      const item = new VideoQueueItem({
        tokenId: 'tok1', videoPath: '/v.mp4', requestedBy: 'p1'
      });
      item.startPlayback();
      item.playbackStart = new Date(Date.now() - 400000).toISOString();
      expect(item.shouldTimeout(300)).toBe(true);
    });

    test('shouldTimeout returns false for recent playback', () => {
      const item = new VideoQueueItem({
        tokenId: 'tok1', videoPath: '/v.mp4', requestedBy: 'p1'
      });
      item.startPlayback();
      expect(item.shouldTimeout(300)).toBe(false);
    });
  });

  describe('serialization', () => {
    test('toJSON round-trips via fromJSON', () => {
      const original = new VideoQueueItem({
        tokenId: 'tok1', videoPath: '/v.mp4', requestedBy: 'p1'
      });
      original.startPlayback();
      const json = original.toJSON();
      const restored = VideoQueueItem.fromJSON(json);
      expect(restored.tokenId).toBe('tok1');
      expect(restored.status).toBe('playing');
    });
  });
});
