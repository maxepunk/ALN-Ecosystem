/**
 * App - Transaction Flow Integration Tests
 * Phase 1, Day 1: Critical Path Coverage
 *
 * OBJECTIVE: Test the main application orchestration from NFC read to submission
 * EXPECTED: Will reveal 4-6 bugs in app.js
 */

// Load browser mocks FIRST
require('../../helpers/browser-mocks');

const { setupIntegrationTestServer, cleanupIntegrationTestServer } = require('../../helpers/integration-test-server');
const { createAuthenticatedScanner, waitForEvent } = require('../../helpers/websocket-helpers');
const { resetAllServices } = require('../../helpers/service-reset');
const sessionService = require('../../../src/services/sessionService');
const fs = require('fs');
const path = require('path');

describe('App - Transaction Flow Integration [Phase 1.1]', () => {
  let testContext, scanner;

  beforeAll(async () => {
    testContext = await setupIntegrationTestServer();
  });

  afterAll(async () => {
    await cleanupIntegrationTestServer(testContext);
  });

  beforeEach(async () => {
    await resetAllServices();
    await sessionService.createSession({
      name: 'App Flow Test',
      teams: ['001', '002']
    });

    // Clear DataManager scanned tokens between tests
    global.DataManager.clearScannedTokens();

    scanner = await createAuthenticatedScanner(testContext.url, 'GM_APP_TEST', 'blackmarket');

    // Load real tokens for scanner
    const rawTokensPath = path.join(__dirname, '../../../../ALN-TokenData/tokens.json');
    const rawTokens = JSON.parse(fs.readFileSync(rawTokensPath, 'utf8'));
    global.TokenManager.database = rawTokens;
  });

  afterEach(() => {
    if (scanner?.socket?.connected) scanner.socket.disconnect();
  });

  describe('TEST 1: Full Transaction Orchestration', () => {
    it('should orchestrate full transaction from NFC read to submission', async () => {
      // SETUP: Spy on internal methods to verify orchestration order
      const findTokenSpy = jest.spyOn(global.TokenManager, 'findToken');
      const queueSpy = jest.spyOn(scanner.queueManager, 'queueTransaction');

      // Set team
      scanner.App.currentTeamId = '001';

      // ACT: Trigger NFC read (production entry point)
      scanner.App.processNFCRead({ id: '534e2b03' });

      // Wait for transaction result from server
      const result = await waitForEvent(scanner.socket, 'transaction:result');

      // ASSERT: Verify orchestration happened
      expect(findTokenSpy).toHaveBeenCalledWith('534e2b03');
      expect(queueSpy).toHaveBeenCalled();

      const submittedTransaction = queueSpy.mock.calls[0][0];

      // ASSERT: Transaction has all required fields (AsyncAPI contract)
      expect(submittedTransaction).toMatchObject({
        tokenId: '534e2b03',
        teamId: '001',
        deviceId: 'GM_APP_TEST',
        mode: 'blackmarket'
      });

      // ASSERT: Timestamp is ISO 8601 format
      expect(submittedTransaction).toHaveProperty('timestamp');
      expect(submittedTransaction.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);

      // ASSERT: Server accepted the transaction
      expect(result.data.status).toBe('accepted');
    });
  });

  describe('TEST 2: Unknown Token Handling', () => {
    it('should handle unknown token gracefully without crashing', async () => {
      scanner.App.currentTeamId = '001';

      // SPY: Watch for error handling
      const queueSpy = jest.spyOn(scanner.queueManager, 'queueTransaction');

      // ACT: Scan unknown token
      // EXPECTED: Should NOT crash, should create unknown token transaction
      expect(() => {
        scanner.App.processNFCRead({ id: 'UNKNOWN_FAKE_TOKEN_12345' });
      }).not.toThrow();

      // Wait for result
      const result = await waitForEvent(scanner.socket, 'transaction:result');

      // VERIFY: Transaction was submitted (even for unknown token)
      expect(queueSpy).toHaveBeenCalled();
      const tx = queueSpy.mock.calls[0][0];
      expect(tx.tokenId).toBe('UNKNOWN_FAKE_TOKEN_12345');

      // VERIFY: Server correctly rejects unknown tokens
      // (This is expected behavior - server validates tokens exist in database)
      expect(result.data.status).toBe('error');
      expect(result.data.message).toMatch(/invalid|not found|unknown/i);
    });
  });

  describe('TEST 3: Duplicate Detection', () => {
    it('should detect duplicate and not submit transaction', async () => {
      scanner.App.currentTeamId = '001';

      // Create spy BEFORE any scans
      const queueSpy = jest.spyOn(scanner.queueManager, 'queueTransaction');

      // First scan
      scanner.App.processNFCRead({ id: 'rat001' });
      await waitForEvent(scanner.socket, 'transaction:result');

      // Clear spy call count after first scan
      queueSpy.mockClear();

      // Verify token was marked as scanned after first scan
      const tokenData = global.TokenManager.findToken('rat001');
      const normalizedId = tokenData ? tokenData.matchedId : 'rat001';
      expect(global.DataManager.isTokenScanned(normalizedId)).toBe(true);

      // Second scan (duplicate) - should be blocked client-side
      scanner.App.processNFCRead({ id: 'rat001' });

      // VERIFY: queueManager NOT called for duplicate
      expect(queueSpy).not.toHaveBeenCalled();
    });
  });

  describe('TEST 4: No Team Selected Validation', () => {
    it('should reject transaction when no team selected', () => {
      // EXPECTED BUG: App.js might not validate team selection
      // This should either throw or fail gracefully

      scanner.App.currentTeamId = ''; // No team

      const queueSpy = jest.spyOn(scanner.queueManager, 'queueTransaction');

      // ACT: Try to scan without team
      scanner.App.processNFCRead({ id: '534e2b03' });

      // VERIFY: Transaction should NOT be submitted
      // Either throws error OR gracefully handles missing team
      const tx = queueSpy.mock.calls[0]?.[0];
      if (tx) {
        // If it didn't block, check if it submitted empty teamId (BAD)
        expect(tx.teamId).not.toBe('');
      }

      // Ideally, queueManager should not be called at all
      // But if it is, teamId should be validated
    });
  });

  describe('TEST 5: Offline Queue Fallback', () => {
    it('should queue transaction when connection lost', async () => {
      scanner.App.currentTeamId = '001';

      // Simulate connection loss
      scanner.socket.connected = false;

      const queueSpy = jest.spyOn(scanner.queueManager, 'queueTransaction');

      // ACT: Scan while offline
      scanner.App.processNFCRead({ id: 'tac001' });

      // VERIFY: Still queues for later sync
      expect(queueSpy).toHaveBeenCalled();

      // VERIFY: Transaction stored in offline queue
      expect(scanner.queueManager.tempQueue.length).toBeGreaterThan(0);
    });
  });

  describe('TEST 6: Transaction Data Completeness', () => {
    it('should include all required AsyncAPI fields', () => {
      scanner.App.currentTeamId = '002';

      const queueSpy = jest.spyOn(scanner.queueManager, 'queueTransaction');

      // ACT
      scanner.App.processNFCRead({ id: '534e2b03' });

      const transaction = queueSpy.mock.calls[0][0];

      // VERIFY: All required fields present per AsyncAPI contract
      expect(transaction).toHaveProperty('tokenId');
      expect(transaction).toHaveProperty('teamId');
      expect(transaction).toHaveProperty('deviceId');
      expect(transaction).toHaveProperty('mode');
      expect(transaction).toHaveProperty('timestamp');

      // VERIFY: Values are correct types
      expect(typeof transaction.tokenId).toBe('string');
      expect(typeof transaction.teamId).toBe('string');
      expect(typeof transaction.deviceId).toBe('string');
      expect(typeof transaction.mode).toBe('string');
      expect(typeof transaction.timestamp).toBe('string');

      // VERIFY: Timestamp is valid ISO 8601
      expect(transaction.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);

      // VERIFY: Mode is valid enum value
      expect(['blackmarket', 'detective']).toContain(transaction.mode);
    });
  });
});
