/**
 * Unit tests for syncHelpers
 * Tests buildHeldItemsState() graceful degradation
 */

'use strict';

const { buildHeldItemsState } = require('../../../src/websocket/syncHelpers');

describe('buildHeldItemsState()', () => {
  it('should return empty array when no held items exist', () => {
    const mockVideoQueueService = { getHeldVideos: jest.fn().mockReturnValue([]) };
    const mockCueEngineService = { getHeldCues: jest.fn().mockReturnValue([]) };

    const result = buildHeldItemsState(mockCueEngineService, mockVideoQueueService);
    expect(result).toEqual([]);
  });

  it('should return held video items from videoQueueService', () => {
    const heldItems = [
      { id: 'held-1', type: 'video', tokenId: 'tok1', reason: 'service_down', status: 'held', heldAt: Date.now() },
      { id: 'held-2', type: 'video', tokenId: 'tok2', reason: 'service_down', status: 'held', heldAt: Date.now() },
    ];
    const mockVideoQueueService = { getHeldVideos: jest.fn().mockReturnValue(heldItems) };

    const result = buildHeldItemsState(null, mockVideoQueueService);
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('held-1');
    expect(result[1].id).toBe('held-2');
  });

  it('should gracefully return empty array when videoQueueService is null', () => {
    const result = buildHeldItemsState(null, null);
    expect(result).toEqual([]);
  });

  it('should gracefully return empty array when getHeldVideos throws', () => {
    const mockVideoQueueService = {
      getHeldVideos: jest.fn().mockImplementation(() => { throw new Error('unexpected'); }),
    };

    const result = buildHeldItemsState(null, mockVideoQueueService);
    expect(result).toEqual([]);
  });

  it('should return held cue items from cueEngineService', () => {
    const heldCues = [
      { id: 'held-cue-1', type: 'cue', cueId: 'test-cue', reason: 'service_down', status: 'held', heldAt: Date.now() },
    ];
    const mockCueEngineService = { getHeldCues: jest.fn().mockReturnValue(heldCues) };
    const mockVideoQueueService = { getHeldVideos: jest.fn().mockReturnValue([]) };

    const result = buildHeldItemsState(mockCueEngineService, mockVideoQueueService);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('cue');
    expect(result[0].cueId).toBe('test-cue');
  });

  it('should combine held cues and held videos', () => {
    const heldCues = [
      { id: 'held-cue-1', type: 'cue', cueId: 'cue1', reason: 'service_down', status: 'held', heldAt: Date.now() },
    ];
    const heldVideos = [
      { id: 'held-video-1', type: 'video', tokenId: 'tok1', reason: 'service_down', status: 'held', heldAt: Date.now() },
    ];
    const mockCueEngineService = { getHeldCues: jest.fn().mockReturnValue(heldCues) };
    const mockVideoQueueService = { getHeldVideos: jest.fn().mockReturnValue(heldVideos) };

    const result = buildHeldItemsState(mockCueEngineService, mockVideoQueueService);
    expect(result).toHaveLength(2);
    expect(result.find(i => i.type === 'cue')).toBeDefined();
    expect(result.find(i => i.type === 'video')).toBeDefined();
  });

  it('should gracefully handle cueEngineService.getHeldCues throwing', () => {
    const mockCueEngineService = {
      getHeldCues: jest.fn().mockImplementation(() => { throw new Error('cue error'); }),
    };
    const mockVideoQueueService = { getHeldVideos: jest.fn().mockReturnValue([]) };

    const result = buildHeldItemsState(mockCueEngineService, mockVideoQueueService);
    expect(result).toEqual([]);
  });
});
