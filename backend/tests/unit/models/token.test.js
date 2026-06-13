/**
 * Token Model Unit Tests
 * Covers the plain helpers (media, priority, grouping, clone) — the
 * scoring-rule computations over token fields live in gameRules/scoring.
 */

const Token = require('../../../src/models/token');

const makeToken = (overrides = {}) => new Token({
  id: 'tok1',
  name: 'Token 1',
  value: 100,
  memoryType: 'Technical',
  groupId: 'g1',
  groupMultiplier: 3,
  mediaAssets: { image: null, audio: null, video: 'tok1.mp4', processingImage: null },
  metadata: { rating: 3, duration: 42, priority: 2 },
  ...overrides,
});

describe('Token model', () => {
  it('hasVideo() reflects the video media asset', () => {
    expect(makeToken().hasVideo()).toBe(true);
    expect(makeToken({
      mediaAssets: { image: null, audio: null, video: null, processingImage: null },
    }).hasVideo()).toBe(false);
  });

  it('getVideoDuration() returns metadata duration or 0', () => {
    expect(makeToken().getVideoDuration()).toBe(42);
    expect(makeToken({ metadata: { rating: 3 } }).getVideoDuration()).toBe(0);
  });

  it('getPriority() returns metadata priority or default 5', () => {
    expect(makeToken().getPriority()).toBe(2);
    expect(makeToken({ metadata: { rating: 3 } }).getPriority()).toBe(5);
  });

  it('isGrouped() reflects groupId presence', () => {
    expect(makeToken().isGrouped()).toBe(true);
    expect(makeToken({ groupId: null, groupMultiplier: 1 }).isGrouped()).toBe(false);
  });

  it('exposes plain group fields for the scoring rules (no method indirection)', () => {
    const token = makeToken();
    expect(token.groupId).toBe('g1');
    expect(token.groupMultiplier).toBe(3);
  });

  it('clone() round-trips through JSON to an equal independent Token', () => {
    const token = makeToken();
    const copy = token.clone();
    expect(copy).toBeInstanceOf(Token);
    expect(copy).not.toBe(token);
    expect(copy.toJSON()).toEqual(token.toJSON());
  });
});
