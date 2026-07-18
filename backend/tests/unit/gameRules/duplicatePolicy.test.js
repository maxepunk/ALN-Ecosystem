/**
 * Pure duplicate policy (Phase 2 engine/game seam)
 *
 * gameRules/duplicatePolicy.js holds GM duplicate rules as pure functions —
 * no session reads, no events. Player/ESP32 scans never reach this policy:
 * they go through scanRoutes, which performs no duplicate checks by design
 * (players re-view memories freely).
 *
 * Rules encoded (per-session):
 * - Per-device: a GM device processes each token at most once
 * - FCFS: once ANY team claims a token (accepted), no other team can
 * - A7: the rejection identifies the claiming team
 *
 * The old unreachable non-GM analytics branch (transaction:rescan, never
 * consumed) died with this extraction (F-BCORE-12).
 */

const duplicatePolicy = require('../../../src/gameRules/duplicatePolicy');

const SESSION_ID = 'sess-1';

const accepted = (tokenId, teamId, overrides = {}) => ({
  tokenId,
  teamId,
  status: 'accepted',
  sessionId: SESSION_ID,
  ...overrides,
});

const gmScan = (tokenId, teamId, deviceId = 'GM_A') => ({
  tokenId,
  teamId,
  deviceId,
  deviceType: 'gm',
  sessionId: SESSION_ID,
});

describe('gameRules/duplicatePolicy (pure)', () => {
  describe('checkDuplicate', () => {
    it('accepts a first-time token (no duplicate)', () => {
      const result = duplicatePolicy.checkDuplicate({
        transaction: gmScan('tok1', 'Team Alpha'),
        transactions: [],
        scannedTokensByDevice: {},
      });
      expect(result.isDuplicate).toBe(false);
      expect(result.original).toBeNull();
    });

    it('rejects when the same device already scanned the token', () => {
      const result = duplicatePolicy.checkDuplicate({
        transaction: gmScan('tok1', 'Team Alpha', 'GM_A'),
        transactions: [],
        scannedTokensByDevice: { GM_A: ['tok1'] },
      });
      expect(result.isDuplicate).toBe(true);
    });

    it('rejects FCFS when ANY team already claimed the token, identifying the claimant (A7)', () => {
      const original = accepted('tok1', 'Team Beta');
      const result = duplicatePolicy.checkDuplicate({
        transaction: gmScan('tok1', 'Team Alpha', 'GM_OTHER'),
        transactions: [original],
        scannedTokensByDevice: {},
      });
      expect(result.isDuplicate).toBe(true);
      expect(result.original).toBe(original);
      expect(result.original.teamId).toBe('Team Beta');
    });

    it('ignores non-accepted and other-session transactions for FCFS', () => {
      const result = duplicatePolicy.checkDuplicate({
        transaction: gmScan('tok1', 'Team Alpha'),
        transactions: [
          accepted('tok1', 'Team Beta', { status: 'duplicate' }),
          accepted('tok1', 'Team Beta', { sessionId: 'other-session' }),
        ],
        scannedTokensByDevice: {},
      });
      expect(result.isDuplicate).toBe(false);
    });

    it('never flags non-GM device types (defensive — players re-scan freely)', () => {
      const result = duplicatePolicy.checkDuplicate({
        transaction: { ...gmScan('tok1', 'Team Alpha'), deviceType: 'player' },
        transactions: [accepted('tok1', 'Team Beta')],
        scannedTokensByDevice: { GM_A: ['tok1'] },
      });
      expect(result.isDuplicate).toBe(false);
    });
  });

  describe('findOriginalTransaction', () => {
    it('returns the first accepted claim for the token in this session', () => {
      const first = accepted('tok1', 'Team Beta');
      const found = duplicatePolicy.findOriginalTransaction({
        transactions: [accepted('tok1', 'Team Beta', { status: 'rejected' }), first, accepted('tok1', 'Team Gamma')],
        tokenId: 'tok1',
        sessionId: SESSION_ID,
      });
      expect(found).toBe(first);
    });

    it('returns null when no accepted claim exists', () => {
      const found = duplicatePolicy.findOriginalTransaction({
        transactions: [],
        tokenId: 'tok1',
        sessionId: SESSION_ID,
      });
      expect(found).toBeNull();
    });
  });

  describe('per-mode claims flag (D3s2 — non-consuming actions are repeatable by design)', () => {
    // A pack declaring one consuming and one non-consuming mode
    const CLAIMS_CONFIG = {
      modes: [
        { id: 'sell', label: 'Sell', scoringPolicy: 'standard', entityRole: 'ledger', countsTowardGroups: true },
        {
          id: 'appraise', label: 'Appraise', scoringPolicy: 'none', entityRole: 'ledger',
          countsTowardGroups: false, claims: 'non-consuming',
        },
      ],
    };

    it('a non-consuming scan is NEVER blocked — not per-device, not FCFS', () => {
      const result = duplicatePolicy.checkDuplicate({
        transaction: { ...gmScan('tok1', 'Team Beta'), mode: 'appraise' },
        transactions: [{ ...accepted('tok1', 'Team Alpha'), mode: 'sell' }], // consuming claim exists
        scannedTokensByDevice: { GM_A: ['tok1'] },                           // and this device saw it
        gameConfig: CLAIMS_CONFIG,
      });
      expect(result.isDuplicate).toBe(false);
      expect(result.original).toBeNull();
    });

    it('a stored non-consuming transaction never registers the FCFS claim', () => {
      const result = duplicatePolicy.checkDuplicate({
        transaction: { ...gmScan('tok1', 'Team Beta'), mode: 'sell' },
        transactions: [{ ...accepted('tok1', 'Team Alpha'), mode: 'appraise' }],
        scannedTokensByDevice: {},
        gameConfig: CLAIMS_CONFIG,
      });
      expect(result.isDuplicate).toBe(false);
    });

    it('findOriginalTransaction skips non-consuming claims and returns the first CONSUMING one', () => {
      const consuming = { ...accepted('tok1', 'Team Gamma'), mode: 'sell' };
      const found = duplicatePolicy.findOriginalTransaction({
        transactions: [{ ...accepted('tok1', 'Team Alpha'), mode: 'appraise' }, consuming],
        tokenId: 'tok1',
        sessionId: SESSION_ID,
        gameConfig: CLAIMS_CONFIG,
      });
      expect(found).toBe(consuming);
    });

    it('consuming FCFS behavior is unchanged when claims flags are in play', () => {
      const result = duplicatePolicy.checkDuplicate({
        transaction: { ...gmScan('tok1', 'Team Beta'), mode: 'sell' },
        transactions: [{ ...accepted('tok1', 'Team Alpha'), mode: 'sell' }],
        scannedTokensByDevice: {},
        gameConfig: CLAIMS_CONFIG,
      });
      expect(result.isDuplicate).toBe(true);
      expect(result.original.teamId).toBe('Team Alpha');
    });

    it('an UNRESOLVABLE stored mode is treated as consuming (legacy history keeps blocking)', () => {
      const legacy = { ...accepted('tok1', 'Team Alpha'), mode: 'blackmarket' }; // not in CLAIMS_CONFIG
      const result = duplicatePolicy.checkDuplicate({
        transaction: { ...gmScan('tok1', 'Team Beta'), mode: 'sell' },
        transactions: [legacy],
        scannedTokensByDevice: {},
        gameConfig: CLAIMS_CONFIG,
      });
      expect(result.isDuplicate).toBe(true);
      expect(result.original).toBe(legacy);
    });

    it('NO gameConfig (packless) — every transaction is consuming, exactly the pre-D3s2 behavior', () => {
      const result = duplicatePolicy.checkDuplicate({
        transaction: gmScan('tok1', 'Team Beta'),
        transactions: [accepted('tok1', 'Team Alpha')],
        scannedTokensByDevice: {},
      });
      expect(result.isDuplicate).toBe(true);
    });

    it('isConsumingClaim: absent flag defaults to consuming; explicit non-consuming is not', () => {
      expect(duplicatePolicy.isConsumingClaim(CLAIMS_CONFIG, 'sell')).toBe(true);
      expect(duplicatePolicy.isConsumingClaim(CLAIMS_CONFIG, 'appraise')).toBe(false);
      expect(duplicatePolicy.isConsumingClaim(CLAIMS_CONFIG, 'unknown-mode')).toBe(true);
      expect(duplicatePolicy.isConsumingClaim(null, 'anything')).toBe(true);
    });
  });
});
