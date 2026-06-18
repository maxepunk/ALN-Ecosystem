/**
 * Scan response builder (pure wire-format shaping)
 */

const { buildScanResponse, responseMessage } = require('../../../src/websocket/scanResponse');

const fakeTx = (status, overrides = {}) => ({
  id: 'tx-1',
  status,
  points: 100,
  originalTransactionId: null,
  rejectionReason: null,
  isAccepted: () => status === 'accepted',
  isDuplicate: () => status === 'duplicate',
  isRejected: () => status === 'rejected',
  ...overrides,
});

describe('websocket/scanResponse', () => {
  describe('responseMessage', () => {
    it('describes accepted scans with points', () => {
      expect(responseMessage(fakeTx('accepted'))).toBe('Token scanned successfully. 100 points awarded.');
    });

    it('identifies the claiming team on duplicates (A7)', () => {
      expect(responseMessage(fakeTx('duplicate'), 'Team Beta')).toBe('Token already claimed by Team Beta');
      expect(responseMessage(fakeTx('duplicate'))).toBe('Token already claimed');
    });

    it('uses the rejection reason when rejected', () => {
      expect(responseMessage(fakeTx('rejected', { rejectionReason: 'Invalid token ID' })))
        .toBe('Invalid token ID');
      expect(responseMessage(fakeTx('rejected'))).toBe('Scan rejected.');
    });
  });

  describe('buildScanResponse', () => {
    it('includes points only when accepted', () => {
      const accepted = buildScanResponse({
        transaction: fakeTx('accepted'), token: { id: 't1' }, videoPlaying: false,
      });
      expect(accepted.points).toBe(100);
      expect(accepted.status).toBe('accepted');

      const rejected = buildScanResponse({
        transaction: fakeTx('rejected'), token: null, videoPlaying: false,
      });
      expect(rejected.points).toBeUndefined();
    });

    it('carries duplicate provenance (originalTransactionId + claimedBy)', () => {
      const response = buildScanResponse({
        transaction: fakeTx('duplicate', { originalTransactionId: 'tx-0' }),
        token: { id: 't1' },
        videoPlaying: false,
        extras: { claimedBy: 'Team Beta' },
      });
      expect(response.originalTransactionId).toBe('tx-0');
      expect(response.claimedBy).toBe('Team Beta');
      expect(response.message).toBe('Token already claimed by Team Beta');
    });

    it('reports video status with waitTime only while playing', () => {
      const playing = buildScanResponse({
        transaction: fakeTx('accepted'), token: null, videoPlaying: true, waitTime: 30,
      });
      expect(playing.videoPlaying).toBe(true);
      expect(playing.waitTime).toBe(30);

      const idle = buildScanResponse({
        transaction: fakeTx('accepted'), token: null, videoPlaying: false,
      });
      expect(idle.videoPlaying).toBe(false);
      expect(idle.waitTime).toBeUndefined();
    });
  });
});
