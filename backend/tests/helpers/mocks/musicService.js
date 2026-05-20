const { EventEmitter } = require('events');

/**
 * Create a mock musicService matching the real service's public API.
 * Returns an EventEmitter with jest.fn() stubs for all public methods.
 *
 * IMPORTANT: Method names must match backend/src/services/musicService.js exactly.
 * If the real service API changes, update this factory.
 *
 * @param {Object} overrides - Override any default mock return values
 * @returns {EventEmitter} Mock musicService
 */
function createMockMusicService(overrides = {}) {
  const mock = new EventEmitter();

  // Public state
  mock.connected = false;
  mock.state = 'stopped';
  mock.volume = 70;
  mock.track = null;
  mock.playlist = null;
  mock._pausedByGameClock = false;

  // Lifecycle
  mock.init = jest.fn().mockResolvedValue(undefined);
  mock.cleanup = jest.fn().mockResolvedValue(undefined);
  mock.checkConnection = jest.fn().mockResolvedValue(true);
  mock.reset = jest.fn();

  // Transports
  mock.play = jest.fn().mockResolvedValue(undefined);
  mock.pause = jest.fn().mockResolvedValue(undefined);
  mock.stop = jest.fn().mockResolvedValue(undefined);
  mock.next = jest.fn().mockResolvedValue(undefined);
  mock.previous = jest.fn().mockResolvedValue(undefined);

  // Settings
  mock.setVolume = jest.fn().mockResolvedValue(undefined);
  mock.setShuffle = jest.fn().mockResolvedValue(undefined);
  mock.setLoop = jest.fn().mockResolvedValue(undefined);

  // Playlist
  mock.loadPlaylist = jest.fn().mockResolvedValue(undefined);
  mock.getPlaylists = jest.fn().mockReturnValue([]);
  mock.getPlaylist = jest.fn().mockReturnValue(null);

  // Game clock integration
  mock.pauseForGameClock = jest.fn().mockResolvedValue(undefined);
  mock.resumeFromGameClock = jest.fn().mockResolvedValue(undefined);

  // State snapshot
  mock.getState = jest.fn(() => ({
    connected: mock.connected,
    state: mock.state,
    volume: mock.volume,
    track: mock.track,
    playlist: mock.playlist,
    pausedByGameClock: mock._pausedByGameClock,
  }));

  // Apply overrides
  Object.assign(mock, overrides);

  return mock;
}

module.exports = { createMockMusicService };
