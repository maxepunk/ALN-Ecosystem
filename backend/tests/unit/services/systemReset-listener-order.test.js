/**
 * Unit tests: listener ORDER after performSystemReset() (H1)
 *
 * The other systemReset suite mocks broadcasts.js, so it cannot see this class of
 * bug. Here the REAL broadcasts listeners and the REAL sessionService score
 * listener are registered through the reset path, and the assertion is on the
 * OUTCOME (what the sync:full carries), never on registration order — so it keeps
 * holding if the wiring is restructured again.
 *
 * Background: on `scores:reset` two listeners run on transactionService.
 *   1. sessionService's score listener clears session.transactions (synchronously,
 *      before its first await — persistenceListeners.js setupScoreListeners).
 *   2. broadcasts.js builds the follow-up sync:full, and buildSyncFullPayload
 *      reads session.transactions synchronously before ITS first await.
 * EventEmitter runs them in registration order, so the clear must be registered
 * first. app.js/server.js do that at startup (sessionService.init() runs inside
 * initializeServices(), before setupServiceListeners()). systemReset.js must match
 * it, or a mid-game "Reset All Scores" after a pre-show system reset ships the
 * PRE-reset transactions — and the GM Scanner marks every token in a sync:full as
 * scanned (A-9), re-blocking them on every station.
 */

jest.mock('../../../src/utils/logger');
jest.mock('../../../src/services/persistenceService', () => ({
  archiveSession: jest.fn().mockResolvedValue(),
  save: jest.fn().mockResolvedValue(),
  load: jest.fn().mockResolvedValue(null),
}));
jest.mock('../../../src/services/cueEngineWiring', () => ({
  setupCueEngineForwarding: jest.fn(),
}));
// transactionService must be ONE object for both listeners: persistenceListeners
// lazily require()s the singleton, and the harness hands the same module to
// performSystemReset. An EventEmitter (not a bare object) because broadcasts.js
// calls listenerCount() on everything it tracks.
jest.mock('../../../src/services/transactionService', () => {
  const { EventEmitter } = require('events');
  const mock = new EventEmitter();
  mock.reset = jest.fn();
  mock.registerSessionListener = jest.fn();
  mock.getTeamScores = jest.fn();
  mock.getToken = jest.fn();
  return mock;
});
// Real registry would start a 15s revalidation interval (open handle) and pull in
// every hardware service singleton. EventEmitter for the same listenerCount reason.
jest.mock('../../../src/services/serviceHealthRegistry', () => {
  const { EventEmitter } = require('events');
  const mock = new EventEmitter();
  mock.reset = jest.fn();
  mock.report = jest.fn();
  mock.getState = jest.fn();
  mock.getSnapshot = jest.fn();
  mock.startRevalidation = jest.fn();
  mock.stopRevalidation = jest.fn();
  return mock;
});

const { createMockSessionService, createMockVideoQueueService, createMockOfflineQueueService }
  = require('../../helpers/mocks');
const persistenceListeners = require('../../../src/services/session/persistenceListeners');

describe('performSystemReset — listener order on transactionService', () => {
  let performSystemReset;
  let broadcasts;
  let listenerRegistry;
  let transactionService;
  let serviceHealthRegistry;
  let mockIo;
  let mockServices;
  let session;

  beforeEach(() => {
    jest.clearAllMocks();

    broadcasts = require('../../../src/websocket/broadcasts');
    listenerRegistry = require('../../../src/websocket/listenerRegistry');
    transactionService = require('../../../src/services/transactionService');
    serviceHealthRegistry = require('../../../src/services/serviceHealthRegistry');
    ({ performSystemReset } = require('../../../src/services/systemReset'));

    // resetMocks: true (jest.config.base.js) wipes return values between tests.
    transactionService.getTeamScores.mockReturnValue([]);
    transactionService.getToken.mockReturnValue(null);
    serviceHealthRegistry.getState.mockReturnValue({});
    serviceHealthRegistry.getSnapshot.mockReturnValue({});

    mockIo = {
      emit: jest.fn(),
      to: jest.fn().mockReturnThis(),
      sockets: { sockets: new Map(), adapter: { rooms: new Map() } },
    };

    // A post-reset session holding one transaction from the new game.
    session = {
      id: 'session-after-reset',
      name: 'Post Reset',
      startTime: new Date().toISOString(),
      endTime: null,
      status: 'active',
      teams: ['Team Alpha'],
      transactions: [{
        id: 'tx-1',
        tokenId: 'token-1',
        teamId: 'Team Alpha',
        deviceId: 'GM_01',
        mode: 'blackmarket',
        status: 'accepted',
        points: 100,
        timestamp: new Date().toISOString(),
      }],
      connectedDevices: [],
      playerScans: [],
      scores: [],
      metadata: { totalScans: 1, uniqueTokensScanned: ['token-1'], scannedTokensByDevice: {} },
      toJSON() { return { id: this.id, name: this.name, status: this.status, teams: this.teams }; },
    };

    const sessionService = createMockSessionService({
      getCurrentSession: jest.fn(() => session),
      endSession: jest.fn().mockResolvedValue(),
      reset: jest.fn().mockResolvedValue(),
      saveCurrentSession: jest.fn().mockResolvedValue(),
      setupPersistenceListeners: jest.fn(),
      setupGameClockListeners: jest.fn(),
    });
    sessionService.currentSession = session;
    // The REAL registration — this is the listener whose position we care about.
    sessionService.setupScoreListeners = jest.fn(() => {
      persistenceListeners.setupScoreListeners(sessionService);
    });

    mockServices = {
      sessionService,
      transactionService,
      videoQueueService: createMockVideoQueueService(),
      offlineQueueService: createMockOfflineQueueService(),
    };
  });

  afterEach(() => {
    broadcasts.cleanupBroadcastListeners();
    listenerRegistry.cleanup();
    transactionService.removeAllListeners();
    serviceHealthRegistry.removeAllListeners();
  });

  it('ships an EMPTY transaction list in the sync:full that follows scores:reset', async () => {
    await performSystemReset(mockIo, mockServices);

    transactionService.emit('scores:reset', { teamsReset: ['Team Alpha'] });
    await new Promise(resolve => setTimeout(resolve, 50));

    const syncFull = mockIo.emit.mock.calls.find(call => call[0] === 'sync:full');
    expect(syncFull).toBeDefined();
    expect(syncFull[1].data.recentTransactions).toEqual([]);
  });

  it('clears the session transactions before the payload is built', async () => {
    await performSystemReset(mockIo, mockServices);

    transactionService.emit('scores:reset', { teamsReset: ['Team Alpha'] });
    await new Promise(resolve => setTimeout(resolve, 50));

    // Dedup state too — a stale uniqueTokensScanned would re-block tokens just
    // as effectively as a stale transaction list.
    expect(session.transactions).toEqual([]);
    expect(session.metadata.uniqueTokensScanned).toEqual([]);
  });
});
