/**
 * Integration Tests: Transaction Processing
 *
 * Tests transaction processing via real GM Scanner App entry point:
 * blackmarket scoring, detective ratings, duplicate detection,
 * group completion bonuses, and session state enforcement.
 *
 * Uses createAuthenticatedScanner (real ALNScanner App code) for
 * end-to-end validation through the actual NFC processing path.
 *
 * IMPORTANT: Token IDs used here must exist in BOTH:
 * - tests/fixtures/test-tokens.js (backend side, loaded by integration-test-server)
 * - ALN-TokenData/tokens.json (scanner side, loaded by TokenManager)
 */

// Load browser mocks first
require('../helpers/browser-mocks');

const { setupIntegrationTestServer, cleanupIntegrationTestServer } = require('../helpers/integration-test-server');
const { createAuthenticatedScanner, waitForEvent } = require('../helpers/websocket-helpers');
const { clearEventCache } = require('../helpers/websocket-core');
const { resetAllServicesForTesting } = require('../helpers/service-reset');
const sessionService = require('../../src/services/sessionService');
const transactionService = require('../../src/services/transactionService');
const fs = require('fs');
const path = require('path');

describe('Transaction Processing (via App entry point)', () => {
  let testContext, scanner;

  beforeAll(async () => {
    testContext = await setupIntegrationTestServer();
  });

  afterAll(async () => {
    await cleanupIntegrationTestServer(testContext);
  });

  beforeEach(async () => {
    // Full reset cycle including broadcast listener re-registration
    // (required for tests that wait on broadcast events like session:update, group:completed)
    await resetAllServicesForTesting(testContext.io, {
      sessionService,
      transactionService,
      videoQueueService: require('../../src/services/videoQueueService'),
      offlineQueueService: require('../../src/services/offlineQueueService')
    });

    // Re-initialize tokens after reset
    const TestTokens = require('../fixtures/test-tokens');
    await transactionService.init(TestTokens.getAllAsArray());

    const session = await sessionService.createSession({
      name: 'FR Test Session',
      teams: ['Team Alpha', 'Detectives']
    });
    await sessionService.startGame();

    // Clear DataManager scanned tokens between tests
    global.DataManager.clearScannedTokens();

    // CRITICAL: Pre-set currentSessionId to match the session
    global.DataManager.currentSessionId = session.id;

    // Create scanner (AFTER session created)
    scanner = await createAuthenticatedScanner(testContext.url, 'GM_FR_TEST', 'blackmarket');

    // Load raw tokens for scanner (expects ALN-TokenData format)
    const rawTokensPath = path.join(__dirname, '../../../ALN-TokenData/tokens.json');
    const rawTokens = JSON.parse(fs.readFileSync(rawTokensPath, 'utf8'));
    global.TokenManager.database = rawTokens;
  });

  afterEach(async () => {
    if (scanner?.cleanup) await scanner.cleanup();
    global.DataManager.clearScannedTokens();
  });

  describe('Blackmarket Mode Scoring', () => {
    it('should calculate and assign scores in blackmarket mode', async () => {
      clearEventCache(scanner.socket);

      scanner.App.currentTeamId = 'Team Alpha';

      const resultPromise = waitForEvent(scanner.socket, 'transaction:result');
      scanner.App.processNFCRead({ id: '534e2b03' });

      const result = await resultPromise;

      expect(result.data.status).toBe('accepted');
      expect(result.data.points).toBeGreaterThan(0);
    });

    it('should assign points to correct team', async () => {
      clearEventCache(scanner.socket);

      scanner.App.currentTeamId = 'Detectives';

      const resultPromise = waitForEvent(scanner.socket, 'transaction:result');
      scanner.App.processNFCRead({ id: 'tac001' });

      const result = await resultPromise;

      expect(result.data.status).toBe('accepted');
    });
  });

  describe('Detective Mode Star Ratings', () => {
    it('should assign star ratings but NOT update scores in detective mode', async () => {
      clearEventCache(scanner.socket);

      scanner.Settings.mode = 'detective';
      scanner.App.currentTeamId = 'Team Alpha';

      const resultPromise = waitForEvent(scanner.socket, 'transaction:result');
      scanner.App.processNFCRead({ id: '534e2b03' });

      const result = await resultPromise;

      expect(result.data.status).toBe('accepted');
    });
  });

  describe('Duplicate Detection', () => {
    it('should detect duplicate scans by same team (client-side)', async () => {
      scanner.App.currentTeamId = 'Team Alpha';

      const queueSpy = jest.spyOn(scanner.queueManager, 'queueTransaction');

      // First scan
      scanner.App.processNFCRead({ id: '534e2b03' });
      await waitForEvent(scanner.socket, 'transaction:result');

      queueSpy.mockClear();

      // Second scan (duplicate) - blocked client-side
      scanner.App.processNFCRead({ id: '534e2b03' });

      expect(queueSpy).not.toHaveBeenCalled();
    });

    it('should mark token as scanned after first scan', async () => {
      scanner.App.currentTeamId = 'Team Alpha';

      scanner.App.processNFCRead({ id: 'rat001' });
      await waitForEvent(scanner.socket, 'transaction:result');

      const tokenData = global.TokenManager.findToken('rat001');
      const normalizedId = tokenData ? tokenData.matchedId : 'rat001';
      expect(global.DataManager.isTokenScanned(normalizedId)).toBe(true);
    });
  });

  describe('Group Completion Bonuses', () => {
    it('should award bonus when team completes a group', async () => {
      const TestTokens = require('../fixtures/test-tokens');
      const groupTokens = TestTokens.MARCUS_SUCKS.tokens;

      if (groupTokens.length < 2) {
        throw new Error('Test fixture invalid: MARCUS_SUCKS group must have 2+ tokens');
      }

      // CRITICAL: Set up group:completed listener BEFORE any scans
      const groupPromise = waitForEvent(scanner.socket, 'group:completed');

      scanner.App.currentTeamId = 'Team Alpha';

      // Scan first token
      scanner.App.processNFCRead({ id: groupTokens[0].id });
      await waitForEvent(scanner.socket, 'transaction:result');

      // Scan second token - should complete group
      scanner.App.processNFCRead({ id: groupTokens[1].id });

      const groupEvent = await groupPromise;

      expect(groupEvent.data.group).toBeDefined();
      expect(groupEvent.data.bonusPoints).toBeGreaterThan(0);
      expect(groupEvent.data.teamId).toBe('Team Alpha');
    });
  });

  describe('Session State Enforcement', () => {
    it('should block transactions when session is paused', async () => {
      clearEventCache(scanner.socket);

      // Set up listener BEFORE emit
      const pausePromise = waitForEvent(scanner.socket, 'session:update');

      scanner.socket.emit('gm:command', {
        event: 'gm:command',
        data: { action: 'session:pause', payload: {} },
        timestamp: new Date().toISOString()
      });

      const pauseEvent = await pausePromise;
      expect(pauseEvent.data.status).toBe('paused');

      clearEventCache(scanner.socket);

      // Attempt transaction while paused
      const resultPromise = waitForEvent(scanner.socket, 'transaction:result');
      scanner.App.currentTeamId = 'Team Alpha';
      scanner.App.processNFCRead({ id: 'hos001' });

      const result = await resultPromise;

      expect(result.data.status).toBe('error');
      expect(result.data.message).toMatch(/paused|not active/i);
    });

    it('should allow transactions when session is active', async () => {
      clearEventCache(scanner.socket);

      const currentSession = sessionService.getCurrentSession();
      expect(currentSession.status).toBe('active');

      const resultPromise = waitForEvent(scanner.socket, 'transaction:result');
      scanner.App.currentTeamId = 'Team Alpha';
      scanner.App.processNFCRead({ id: 'fli001' });

      const result = await resultPromise;

      expect(result.data.status).toBe('accepted');
    });

    it('should resume accepting transactions after session is resumed', async () => {
      clearEventCache(scanner.socket);

      // Pause - set up listener BEFORE emit
      const pausePromise = waitForEvent(scanner.socket, 'session:update');
      scanner.socket.emit('gm:command', {
        event: 'gm:command',
        data: { action: 'session:pause', payload: {} },
        timestamp: new Date().toISOString()
      });
      await pausePromise;

      clearEventCache(scanner.socket);

      // Resume - set up listener BEFORE emit
      const resumePromise = waitForEvent(scanner.socket, 'session:update');
      scanner.socket.emit('gm:command', {
        event: 'gm:command',
        data: { action: 'session:resume', payload: {} },
        timestamp: new Date().toISOString()
      });
      await resumePromise;

      clearEventCache(scanner.socket);

      // Submit transaction
      const resultPromise = waitForEvent(scanner.socket, 'transaction:result');
      scanner.App.currentTeamId = 'Team Alpha';
      scanner.App.processNFCRead({ id: 'hos001' });

      const result = await resultPromise;

      expect(result.data.status).toBe('accepted');
    });
  });
});
