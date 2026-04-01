/**
 * Barrel export for shared mock factories.
 *
 * Usage:
 *   const { createMockSessionService, createMockTransactionService } = require('../../helpers/mocks');
 *   const mockSession = createMockSessionService({ getCurrentSession: jest.fn().mockReturnValue({...}) });
 */
module.exports = {
  ...require('./sessionService'),
  ...require('./transactionService'),
  ...require('./videoQueueService'),
  ...require('./bluetoothService'),
  ...require('./audioRoutingService'),
  ...require('./lightingService'),
  ...require('./offlineQueueService'),
};
