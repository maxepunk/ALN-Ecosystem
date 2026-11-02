/**
 * Session Model - Unit Tests
 * Tests for Phase 1.1 (P0.1): Server-side per-device duplicate detection
 */

const Session = require('../../../src/models/session');

describe('Session Model - Per-Device Duplicate Detection (P0.1)', () => {
  let session;

  beforeEach(() => {
    session = new Session({
      name: 'Test Session',
      teams: ['Team Alpha', 'Detectives']
    });
  });

  describe('scannedTokensByDevice initialization', () => {
    test('should initialize scannedTokensByDevice as empty object for new session', () => {
      expect(session.metadata.scannedTokensByDevice).toBeDefined();
      expect(session.metadata.scannedTokensByDevice).toEqual({});
    });

    test('should migrate old sessions without scannedTokensByDevice', () => {
      const oldSession = new Session({
        name: 'Old Session',
        metadata: {
          gmStations: 1,
          playerDevices: 2,
          totalScans: 10,
          uniqueTokensScanned: ['kaa001']
          // No scannedTokensByDevice (old session)
        }
      });

      expect(oldSession.metadata.scannedTokensByDevice).toBeDefined();
      expect(oldSession.metadata.scannedTokensByDevice).toEqual({});
    });
  });

  describe('getDeviceScannedTokens()', () => {
    test('should return empty Set for device with no scans', () => {
      const tokens = session.getDeviceScannedTokens('GM_001');

      expect(tokens).toBeInstanceOf(Set);
      expect(tokens.size).toBe(0);
    });

    test('should return Set of scanned tokens for device', () => {
      session.metadata.scannedTokensByDevice['GM_001'] = ['kaa001', 'kaa002'];

      const tokens = session.getDeviceScannedTokens('GM_001');

      expect(tokens).toBeInstanceOf(Set);
      expect(tokens.size).toBe(2);
      expect(tokens.has('kaa001')).toBe(true);
      expect(tokens.has('kaa002')).toBe(true);
    });

    test('should initialize empty array if device not in object', () => {
      const tokens = session.getDeviceScannedTokens('NEW_DEVICE');

      expect(tokens).toBeInstanceOf(Set);
      expect(tokens.size).toBe(0);
      expect(session.metadata.scannedTokensByDevice['NEW_DEVICE']).toEqual([]);
    });
  });

  describe('hasDeviceScannedToken()', () => {
    test('should return false for unscanned token', () => {
      const hasScanned = session.hasDeviceScannedToken('GM_001', 'kaa001');
      expect(hasScanned).toBe(false);
    });

    test('should return true for scanned token', () => {
      session.metadata.scannedTokensByDevice['GM_001'] = ['kaa001'];

      const hasScanned = session.hasDeviceScannedToken('GM_001', 'kaa001');
      expect(hasScanned).toBe(true);
    });

    test('should return false for token scanned by different device', () => {
      session.metadata.scannedTokensByDevice['GM_001'] = ['kaa001'];

      const hasScanned = session.hasDeviceScannedToken('GM_002', 'kaa001');
      expect(hasScanned).toBe(false);
    });

    test('should handle non-existent device', () => {
      const hasScanned = session.hasDeviceScannedToken('NONEXISTENT', 'kaa001');
      expect(hasScanned).toBe(false);
    });
  });

  describe('addDeviceScannedToken()', () => {
    test('should add token to device scanned list', () => {
      session.addDeviceScannedToken('GM_001', 'kaa001');

      expect(session.metadata.scannedTokensByDevice['GM_001']).toContain('kaa001');
      expect(session.hasDeviceScannedToken('GM_001', 'kaa001')).toBe(true);
    });

    test('should not add duplicate tokens', () => {
      session.addDeviceScannedToken('GM_001', 'kaa001');
      session.addDeviceScannedToken('GM_001', 'kaa001'); // Duplicate

      const tokens = session.metadata.scannedTokensByDevice['GM_001'];
      expect(tokens.length).toBe(1);
      expect(tokens).toEqual(['kaa001']);
    });

    test('should allow multiple tokens for same device', () => {
      session.addDeviceScannedToken('GM_001', 'kaa001');
      session.addDeviceScannedToken('GM_001', 'kaa002');
      session.addDeviceScannedToken('GM_001', 'kaa003');

      const tokens = session.metadata.scannedTokensByDevice['GM_001'];
      expect(tokens.length).toBe(3);
      expect(tokens).toEqual(['kaa001', 'kaa002', 'kaa003']);
    });

    test('should allow same token for different devices', () => {
      session.addDeviceScannedToken('GM_001', 'kaa001');
      session.addDeviceScannedToken('GM_002', 'kaa001');

      expect(session.hasDeviceScannedToken('GM_001', 'kaa001')).toBe(true);
      expect(session.hasDeviceScannedToken('GM_002', 'kaa001')).toBe(true);
    });

    test('should initialize array if device not exists', () => {
      session.addDeviceScannedToken('NEW_DEVICE', 'kaa001');

      expect(session.metadata.scannedTokensByDevice['NEW_DEVICE']).toBeDefined();
      expect(session.metadata.scannedTokensByDevice['NEW_DEVICE']).toContain('kaa001');
    });
  });

  describe('getDeviceScannedTokensArray()', () => {
    test('should return empty array for device with no scans', () => {
      const tokens = session.getDeviceScannedTokensArray('GM_001');
      expect(tokens).toEqual([]);
    });

    test('should return array of scanned tokens', () => {
      session.addDeviceScannedToken('GM_001', 'kaa001');
      session.addDeviceScannedToken('GM_001', 'kaa002');

      const tokens = session.getDeviceScannedTokensArray('GM_001');
      expect(Array.isArray(tokens)).toBe(true);
      expect(tokens).toEqual(['kaa001', 'kaa002']);
    });

    test('should return empty array for non-existent device', () => {
      const tokens = session.getDeviceScannedTokensArray('NONEXISTENT');
      expect(tokens).toEqual([]);
    });
  });

  describe('toJSON() serialization', () => {
    test('should include scannedTokensByDevice in JSON output', () => {
      session.addDeviceScannedToken('GM_001', 'kaa001');
      session.addDeviceScannedToken('PLAYER_001', 'kaa002');

      const json = session.toJSON();

      expect(json.metadata.scannedTokensByDevice).toBeDefined();
      expect(json.metadata.scannedTokensByDevice).toEqual({
        GM_001: ['kaa001'],
        PLAYER_001: ['kaa002']
      });
    });

    test('should serialize empty scannedTokensByDevice as empty object', () => {
      const json = session.toJSON();

      expect(json.metadata.scannedTokensByDevice).toEqual({});
    });
  });

  describe('legacy transaction hydration (train-review P1-2)', () => {
    it('a persisted pre-`mode` transaction hydrates with the legacy-history default', () => {
      // Persisted transactions are hydrated RAW (never re-run through
      // the Transaction constructor), so the constructor's stable
      // 'blackmarket' literal used to guard only fresh constructions —
      // a restored legacy session's transactions stayed modeless and
      // the delete-rebuild path could not resolve their mode.
      const now = new Date().toISOString();
      const sessionId = '11111111-2222-4333-8444-555555555555';
      const tx = (id, extra = {}) => ({
        id, tokenId: 'abc', teamId: 'A', deviceId: 'GM_1', deviceType: 'gm',
        points: 100, timestamp: now, sessionId, status: 'accepted', ...extra,
      });
      const session = Session.fromJSON({
        id: sessionId,
        name: 'Legacy Session',
        startTime: now,
        transactions: [
          tx('aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeee1'),
          tx('aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeee2', { mode: 'detective' }),
        ],
      });
      expect(session.transactions[0].mode).toBe('blackmarket');
      // A recorded mode is never overwritten
      expect(session.transactions[1].mode).toBe('detective');
    });
  });

  describe('Integration with existing Session functionality', () => {
    test('should not interfere with addTransaction()', () => {
      const transaction = {
        id: 'tx-001',
        tokenId: 'kaa001',
        deviceId: 'GM_001',
        teamId: 'Team Alpha',
        timestamp: new Date().toISOString()
      };

      session.addTransaction(transaction);

      expect(session.transactions).toHaveLength(1);
      expect(session.metadata.totalScans).toBe(1);
      // scannedTokensByDevice is managed by transactionService, not addTransaction
      expect(session.metadata.scannedTokensByDevice).toEqual({});
    });

    test('should persist across session serialization/deserialization', () => {
      session.addDeviceScannedToken('GM_001', 'kaa001');
      session.addDeviceScannedToken('GM_001', 'kaa002');

      const json = session.toJSON();
      const restored = Session.fromJSON(json);

      expect(restored.hasDeviceScannedToken('GM_001', 'kaa001')).toBe(true);
      expect(restored.hasDeviceScannedToken('GM_001', 'kaa002')).toBe(true);
      expect(restored.getDeviceScannedTokensArray('GM_001')).toEqual(['kaa001', 'kaa002']);
    });
  });
});

describe('Session Model - pack stamp (Phase 3 A2)', () => {
  const PACK = {
    packId: 'about-last-night',
    version: '1.0.0',
    contentHash: `sha256:${'a'.repeat(64)}`,
  };

  test('new sessions default metadata.pack to null (stamped by sessionService)', () => {
    const session = new Session({ name: 'Fresh' });
    expect(session.metadata.pack).toBeNull();
  });

  test('legacy sessions without a pack stamp migrate to explicit null', () => {
    const legacy = new Session({
      name: 'Old Session',
      metadata: {
        gmStations: 1,
        playerDevices: 2,
        totalScans: 10,
        uniqueTokensScanned: ['kaa001'],
        // No pack (pre-A2 session)
      },
    });
    expect(legacy.metadata.pack).toBeNull();
  });

  test('a stamped pack survives the toJSON/fromJSON persistence round-trip', () => {
    const session = new Session({ name: 'Stamped' });
    session.metadata.pack = PACK;
    const restored = Session.fromJSON(session.toJSON());
    expect(restored.metadata.pack).toEqual(PACK);
  });
  test('preflight and preflightOverride default to null on a NEW session (T1a D8)', () => {
    const session = new Session({ name: 'Fresh' });
    expect(session.metadata.preflight).toBeNull();
    expect(session.metadata.preflightOverride).toBeNull();
  });

  test('an OLDER session file with neither field restores with both null (the A2 precedent)', () => {
    const legacy = Session.fromJSON({
      name: 'Pre-T1a Session',
      startTime: new Date().toISOString(),
      status: 'ended',
      metadata: {
        gmStations: 0, playerDevices: 0, totalScans: 0, uniqueTokensScanned: [],
      },
    });
    expect(legacy.metadata.preflight).toBeNull();
    expect(legacy.metadata.preflightOverride).toBeNull();
  });

  test('a stamped preflight and override survive the persistence round-trip', () => {
    const session = new Session({ name: 'Stamped' });
    session.metadata.preflight = {
      status: 'no-go',
      computedAt: '2026-09-12T10:00:00.000Z',
      profileId: 'toy-dormant-lighting',
      packHash: `sha256:${'a'.repeat(64)}`,
      blocking: ["required endpoint 'lighting.instruments' not installed at this venue"],
      dormantNeeds: ['lighting.instruments'],
    };
    session.metadata.preflightOverride = {
      reason: 'the rig is in the van',
      at: '2026-09-12T10:00:01.000Z',
      blocking: ['x'],
      byDeviceId: 'GM_STATION_1',
      byTier: 'operator',
    };
    const restored = Session.fromJSON(session.toJSON());
    expect(restored.metadata.preflight).toEqual(session.metadata.preflight);
    expect(restored.metadata.preflightOverride).toEqual(session.metadata.preflightOverride);
  });
});
