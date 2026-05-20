jest.mock('mpd2', () => {
  const { EventEmitter } = require('events');
  class MockMpdClient extends EventEmitter {
    constructor() {
      super();
      this._connected = true;
      this.sendCommand = jest.fn().mockResolvedValue('');
      this.sendCommands = jest.fn().mockResolvedValue([]);
      this.disconnect = jest.fn(async () => { this._connected = false; });
    }
  }
  return { connect: jest.fn(async () => new MockMpdClient()) };
});

const mpd2 = require('mpd2');
const registry = require('../../../src/services/serviceHealthRegistry');
const { MusicService } = require('../../../src/services/musicService');

beforeEach(() => {
  jest.spyOn(registry, 'report').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
  mpd2.connect.mockClear();
});

describe('MusicService — construction', () => {
  let service;
  beforeEach(() => {
    service = new MusicService();
  });

  it('has correct initial state', () => {
    expect(service.getState()).toEqual({
      connected: false,
      state: 'stopped',
      volume: 70,
      track: null,
      playlist: null,
      pausedByGameClock: false,
    });
  });

  it('getState returns a defensive copy', () => {
    const snap = service.getState();
    snap.state = 'mutated';
    expect(service.getState().state).toBe('stopped');
  });
});

describe('MusicService — lifecycle', () => {
  let service;

  beforeEach(() => {
    service = new MusicService();
    mpd2.connect.mockImplementation(async () => {
      const { EventEmitter } = require('events');
      const client = new EventEmitter();
      client._connected = true;
      client.sendCommand = jest.fn().mockResolvedValue('');
      client.sendCommands = jest.fn().mockResolvedValue([]);
      client.disconnect = jest.fn(async () => { client._connected = false; });
      return client;
    });
  });

  it('init() connects mpd2 and reports healthy', async () => {
    await service.init();
    expect(mpd2.connect).toHaveBeenCalledWith(expect.objectContaining({
      path: expect.stringMatching(/mpd\.sock$/),
    }));
    expect(service.connected).toBe(true);
    expect(registry.report).toHaveBeenCalledWith('music', 'healthy', expect.any(String));
  });

  it('init() handles connection failure', async () => {
    mpd2.connect.mockRejectedValueOnce(new Error('ECONNREFUSED'));
    await service.init();
    expect(service.connected).toBe(false);
    expect(registry.report).toHaveBeenCalledWith('music', 'down', expect.stringContaining('ECONNREFUSED'));
  });

  it('cleanup() disconnects and clears state', async () => {
    await service.init();
    await service.cleanup();
    expect(service.connected).toBe(false);
  });

  it('checkConnection() pings via ping command', async () => {
    await service.init();
    const ok = await service.checkConnection();
    expect(ok).toBe(true);
    expect(service._mpd.sendCommand).toHaveBeenCalledWith('ping');
  });

  it('checkConnection() returns false on failure', async () => {
    await service.init();
    service._mpd.sendCommand = jest.fn().mockRejectedValue(new Error('socket closed'));
    const ok = await service.checkConnection();
    expect(ok).toBe(false);
  });

  it('checkConnection() returns false when not initialized', async () => {
    const ok = await service.checkConnection();
    expect(ok).toBe(false);
  });
});
