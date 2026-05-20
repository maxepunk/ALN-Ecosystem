// Music command dispatch (mirrors the spotify pattern in commandExecutor.js).

jest.mock('../../../src/services/musicService', () => ({
  play: jest.fn().mockResolvedValue(undefined),
  pause: jest.fn().mockResolvedValue(undefined),
  stop: jest.fn().mockResolvedValue(undefined),
  next: jest.fn().mockResolvedValue(undefined),
  previous: jest.fn().mockResolvedValue(undefined),
  setVolume: jest.fn().mockResolvedValue(undefined),
  setShuffle: jest.fn().mockResolvedValue(undefined),
  setLoop: jest.fn().mockResolvedValue(undefined),
  loadPlaylist: jest.fn().mockResolvedValue(undefined),
  checkConnection: jest.fn().mockResolvedValue(true),
}));

const musicService = require('../../../src/services/musicService');
const registry = require('../../../src/services/serviceHealthRegistry');
const { executeCommand } = require('../../../src/services/commandExecutor');

beforeEach(() => {
  jest.spyOn(registry, 'isHealthy').mockImplementation((id) => id === 'music');
  jest.spyOn(registry, 'getStatus').mockReturnValue({ status: 'down', message: 'unreachable' });
  musicService.play.mockResolvedValue(undefined);
  musicService.pause.mockResolvedValue(undefined);
  musicService.stop.mockResolvedValue(undefined);
  musicService.next.mockResolvedValue(undefined);
  musicService.previous.mockResolvedValue(undefined);
  musicService.setVolume.mockResolvedValue(undefined);
  musicService.setShuffle.mockResolvedValue(undefined);
  musicService.setLoop.mockResolvedValue(undefined);
  musicService.loadPlaylist.mockResolvedValue(undefined);
});

describe('commandExecutor — music:*', () => {
  it.each([
    ['music:play', 'play'],
    ['music:pause', 'pause'],
    ['music:stop', 'stop'],
    ['music:next', 'next'],
    ['music:previous', 'previous'],
  ])('%s calls musicService.%s and reports success', async (action, method) => {
    const res = await executeCommand({ action, payload: {}, source: 'gm' });
    expect(musicService[method]).toHaveBeenCalled();
    expect(res.success).toBe(true);
    expect(res.message).toMatch(new RegExp(method, 'i'));
  });

  it('music:setVolume passes volume payload', async () => {
    const res = await executeCommand({ action: 'music:setVolume', payload: { volume: 60 }, source: 'gm' });
    expect(musicService.setVolume).toHaveBeenCalledWith(60);
    expect(res.success).toBe(true);
  });

  it('music:setVolume rejects when volume is missing', async () => {
    const res = await executeCommand({ action: 'music:setVolume', payload: {}, source: 'gm' });
    expect(res.success).toBe(false);
    expect(res.message).toMatch(/volume required/i);
  });

  it('music:setShuffle passes enabled flag', async () => {
    await executeCommand({ action: 'music:setShuffle', payload: { enabled: true }, source: 'gm' });
    expect(musicService.setShuffle).toHaveBeenCalledWith(true);
  });

  it('music:setLoop passes enabled flag', async () => {
    await executeCommand({ action: 'music:setLoop', payload: { enabled: false }, source: 'gm' });
    expect(musicService.setLoop).toHaveBeenCalledWith(false);
  });

  it('music:loadPlaylist passes playlistId', async () => {
    const res = await executeCommand({ action: 'music:loadPlaylist', payload: { playlistId: 'p1' }, source: 'gm' });
    expect(musicService.loadPlaylist).toHaveBeenCalledWith('p1');
    expect(res.success).toBe(true);
  });

  it('music:loadPlaylist rejects missing playlistId', async () => {
    const res = await executeCommand({ action: 'music:loadPlaylist', payload: {}, source: 'gm' });
    expect(res.success).toBe(false);
    expect(res.message).toMatch(/playlistId required/i);
  });

  it('pre-dispatch rejects when music service is down', async () => {
    registry.isHealthy.mockImplementation(() => false);
    const res = await executeCommand({ action: 'music:play', payload: {}, source: 'gm' });
    expect(res.success).toBe(false);
    expect(res.message).toMatch(/music/i);
    expect(musicService.play).not.toHaveBeenCalled();
  });
});
