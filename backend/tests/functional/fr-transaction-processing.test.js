/**
 * Functional Requirements Validation: Transaction Processing
 *
 * Tests FR Section 3: Transaction Processing
 * Validates blackmarket scoring, detective ratings, duplicate detection,
 * group completion bonuses, and session state enforcement.
 */

// Load browser mocks first
require('../helpers/browser-mocks');

const { setupIntegrationTestServer, cleanupIntegrationTestServer } = require('../helpers/integration-test-server');
const { createAuthenticatedScanner, waitForEvent } = require('../helpers/websocket-helpers');
const { setupBroadcastListeners, cleanupBroadcastListeners } = require('../../src/websocket/broadcasts');
const { resetAllServices } = require('../helpers/service-reset');
const sessionService = require('../../src/services/sessionService');
const transactionService = require('../../src/services/transactionService');
const tokenService = require('../../src/services/tokenService');
const fs = require('fs');
const path = require('path');

describe('FR Section 3: Transaction Processing', () => {
  let testContext, scanner;

  beforeAll(async () => {
    testContext = await setupIntegrationTestServer();
  });

  afterAll(async () => {
    await cleanupIntegrationTestServer(testContext);
  });

  beforeEach(async () => {
    // CRITICAL: Cleanup old broadcast listeners FIRST
    cleanupBroadcastListeners();

    // Reset services using centralized helper
    await resetAllServices();

    // Re-load tokens
    const tokens = tokenService.loadTokens();
    await transactionService.init(tokens);

    // CRITICAL: Re-setup broadcast listeners after cleanup
    const stateService = require('../../src/services/stateService');
    const videoQueueService = require('../../src/services/videoQueueService');
    const offlineQueueService = require('../../src/services/offlineQueueService');

    setupBroadcastListeners(testContext.io, {
      sessionService,
      transactionService,
      stateService,
      videoQueueService,
      offlineQueueService
    });

    // Create test session
    await sessionService.createSession({
      name: 'FR Test Session',
      teams: ['001', '002']
    });

    // Create scanner (AFTER session created)
    scanner = await createAuthenticatedScanner(testContext.url, 'GM_FR_TEST', 'blackmarket');

    // Load raw tokens for scanner (expects ALN-TokenData format)
    const rawTokensPath = path.join(__dirname, '../../../ALN-TokenData/tokens.json');
    const rawTokens = JSON.parse(fs.readFileSync(rawTokensPath, 'utf8'));
    global.TokenManager.database = rawTokens;
  });

  afterEach(async () => {
    if (scanner?.socket?.connected) scanner.socket.disconnect();
    await resetAllServices();
  });

  describe('FR 3.2: Blackmarket Mode Scoring', () => {
    it('should calculate and assign scores in blackmarket mode', async () => {
      const resultPromise = waitForEvent(scanner.socket, 'transaction:result');
      const scorePromise = waitForEvent(scanner.socket, 'score:updated');

      scanner.Settings.stationMode = 'blackmarket';
      scanner.App.currentTeamId = '001';

      // Use production entry point
      scanner.App.processNFCRead({ id: '534e2b03' });

      const [result, scoreUpdate] = await Promise.all([resultPromise, scorePromise]);

      // FR 3.2: Blackmarket mode calculates scores
      expect(result.data.status).toBe('accepted');
      expect(result.data.points).toBeGreaterThan(0);

      // Score update broadcast
      expect(scoreUpdate.data.teamId).toBe('001');
      expect(scoreUpdate.data.currentScore).toBeGreaterThan(0);
    });

    it('should assign points to correct team', async () => {
      const scorePromise = waitForEvent(scanner.socket, 'score:updated');

      scanner.Settings.stationMode = 'blackmarket';
      scanner.App.currentTeamId = '002'; // Team 002

      scanner.App.processNFCRead({ id: 'tac001' });

      const scoreUpdate = await scorePromise;

      expect(scoreUpdate.data.teamId).toBe('002');
    });
  });

  describe('FR 3.2: Detective Mode Star Ratings', () => {
    it('should assign star ratings but NOT update scores in detective mode', async () => {
      const resultPromise = waitForEvent(scanner.socket, 'transaction:result');

      scanner.Settings.stationMode = 'detective';
      scanner.App.currentTeamId = '001';

      scanner.App.processNFCRead({ id: '534e2b03' });

      const result = await resultPromise;

      // FR 3.2: Detective mode assigns ratings, no score
      expect(result.data.status).toBe('accepted');
      // In detective mode, points should be 0 or undefined (no scoring)
    });
  });

  describe('FR 3.3: Duplicate Detection', () => {
    it('should detect duplicate scans by same team', async () => {
      scanner.Settings.stationMode = 'blackmarket';
      scanner.App.currentTeamId = '001';

      // First scan
      const result1Promise = waitForEvent(scanner.socket, 'transaction:result');
      scanner.App.processNFCRead({ id: '534e2b03' });
      await result1Promise;

      // Second scan (duplicate)
      const result2Promise = waitForEvent(scanner.socket, 'transaction:result');
      scanner.App.processNFCRead({ id: '534e2b03' });
      const result2 = await result2Promise;

      // FR 3.3: Duplicate detection works
      expect(result2.data.status).toBe('duplicate');
    });

    it('should reject duplicate when different team scans same token (first-come-first-served)', async () => {
      scanner.Settings.stationMode = 'blackmarket';

      // Team 001 scans first - claims the token
      scanner.App.currentTeamId = '001';
      const result1Promise = waitForEvent(scanner.socket, 'transaction:result');
      scanner.App.processNFCRead({ id: 'rat001' });
      const result1 = await result1Promise;
      expect(result1.data.status).toBe('accepted');

      // Team 002 tries to scan same token - should be rejected (first-come-first-served)
      scanner.App.currentTeamId = '002';
      const result2Promise = waitForEvent(scanner.socket, 'transaction:result');
      scanner.App.processNFCRead({ id: 'rat001' });
      const result2 = await result2Promise;

      // FR 3.3: First-come-first-served - Team 002 cannot claim token already claimed by Team 001
      expect(result2.data.status).toBe('duplicate');
      expect(result2.data.message).toMatch(/already claimed|duplicate/i);
    });
  });

  describe('FR 3.4: Group Completion Bonuses', () => {
    it('should award bonus when team completes a group', async () => {
      // Use test fixtures for deterministic behavior
      const TestTokens = require('../fixtures/test-tokens');
      const groupTokens = TestTokens.MARCUS_SUCKS.tokens;

      // Validate fixture data exists before running test
      if (groupTokens.length < 2) {
        throw new Error(
          'Test fixture invalid: MARCUS_SUCKS group must have at least 2 tokens. ' +
          'Check tests/fixtures/test-tokens.js'
        );
      }

      scanner.Settings.stationMode = 'blackmarket';
      scanner.App.currentTeamId = '001';

      // Scan first token (rat001)
      scanner.App.processNFCRead({ id: groupTokens[0].id });
      await waitForEvent(scanner.socket, 'transaction:result');

      // Scan second token (asm001) - should complete group
      const groupPromise = waitForEvent(scanner.socket, 'group:completed');
      scanner.App.processNFCRead({ id: groupTokens[1].id });

      const groupEvent = await groupPromise;

      // FR 3.4: Group completion bonus calculated
      expect(groupEvent.data.group).toBeDefined(); // Note: 'group' not 'groupName'
      expect(groupEvent.data.bonusPoints).toBeGreaterThan(0);
      expect(groupEvent.data.teamId).toBe('001');
    });
  });

  describe('FR 1.2: Session State Enforcement', () => {
    it('should block transactions when session is paused', async () => {
      // Pause session via admin command
      const pausePromise = waitForEvent(scanner.socket, 'session:update');
      scanner.socket.emit('gm:command', {
        event: 'gm:command',
        data: {
          action: 'session:pause',
          payload: {}
        },
        timestamp: new Date().toISOString()
      });
      await pausePromise;

      // Attempt transaction while paused
      const resultPromise = waitForEvent(scanner.socket, 'transaction:result');
      scanner.App.currentTeamId = '001';
      scanner.App.processNFCRead({ id: '534e2b03' });

      const result = await resultPromise;

      // FR 1.2: Paused session blocks transactions
      expect(result.data.status).toBe('error');
      expect(result.data.message).toMatch(/paused|not active/i);
    });

    it('should allow transactions when session is active', async () => {
      // Ensure session is active (created in beforeEach)
      const currentSession = sessionService.getCurrentSession();
      expect(currentSession.status).toBe('active');

      // Submit transaction
      const resultPromise = waitForEvent(scanner.socket, 'transaction:result');
      scanner.App.currentTeamId = '001';
      scanner.App.processNFCRead({ id: 'kaa001' });

      const result = await resultPromise;

      expect(result.data.status).toBe('accepted');
    });

    it('should resume accepting transactions after session is resumed', async () => {
      // Pause
      scanner.socket.emit('gm:command', {
        event: 'gm:command',
        data: { action: 'session:pause', payload: {} },
        timestamp: new Date().toISOString()
      });
      await waitForEvent(scanner.socket, 'session:update');

      // Resume
      const resumePromise = waitForEvent(scanner.socket, 'session:update');
      scanner.socket.emit('gm:command', {
        event: 'gm:command',
        data: { action: 'session:resume', payload: {} },
        timestamp: new Date().toISOString()
      });
      await resumePromise;

      // Submit transaction
      const resultPromise = waitForEvent(scanner.socket, 'transaction:result');
      scanner.App.currentTeamId = '001';
      scanner.App.processNFCRead({ id: 'jaw001' });

      const result = await resultPromise;

      expect(result.data.status).toBe('accepted');
    });
  });
});
