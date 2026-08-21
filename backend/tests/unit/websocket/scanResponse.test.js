/**
 * Scan response builder (pure wire-format shaping)
 *
 * packService is mocked to the UNDECLARED state (getStrings → null) so
 * the pins here exercise the BAKED wording; the pack-template tests
 * override per-test. The real ALN sidecar declares scoring.awardMessage
 * VERBATIM (drift-pinned below), so production output is unchanged.
 */

jest.mock('../../../src/services/packService', () => ({
  getStrings: jest.fn(() => null),
}));

const packService = require('../../../src/services/packService');
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
  afterEach(() => {
    packService.getStrings.mockReturnValue(null);
  });

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

  describe('award message from the pack strings sidecar (slice 3a)', () => {
    it('applies the pack template with every {points} placeholder substituted', () => {
      packService.getStrings.mockReturnValue({
        scoring: { awardMessage: 'Take fenced. {points} added to the haul ({points}!).' },
      });
      expect(responseMessage(fakeTx('accepted'))).toBe('Take fenced. 100 added to the haul (100!).');
    });

    it('falls back to the baked wording for a blank/non-string/missing template', () => {
      for (const bad of [{ scoring: { awardMessage: '' } }, { scoring: { awardMessage: 42 } }, { scoring: {} }, {}]) {
        packService.getStrings.mockReturnValue(bad);
        expect(responseMessage(fakeTx('accepted'))).toBe('Token scanned successfully. 100 points awarded.');
      }
    });

    it('only the accepted branch is pack-worded — duplicate/rejected chrome stays engine (A7 contract-adjacent)', () => {
      packService.getStrings.mockReturnValue({
        scoring: { awardMessage: 'Take fenced. {points} in the bag.' },
      });
      expect(responseMessage(fakeTx('duplicate'), 'Team Beta')).toBe('Token already claimed by Team Beta');
      expect(responseMessage(fakeTx('rejected'))).toBe('Scan rejected.');
    });

    it('DRIFT TRIPWIRE: the ALN sidecar declares the baked wording verbatim (zero visible change)', () => {
      // If ALN rewords the template, the baked fallback must follow (or
      // packless environments silently diverge from the shipped game).
      const fs = require('fs');
      const path = require('path');
      const aln = JSON.parse(fs.readFileSync(
        path.resolve(__dirname, '../../../../ALN-TokenData/strings.json'), 'utf8'
      ));
      expect(aln.scoring.awardMessage).toBe('Token scanned successfully. {points} points awarded.');
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
