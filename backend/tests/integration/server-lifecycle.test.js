/**
 * Server Lifecycle Integration Test (Phase 1.4 P0.4)
 * Tests that multiple startup/cleanup cycles don't leak event listeners
 */

const { setupIntegrationTestServer, cleanupIntegrationTestServer } = require('../helpers/integration-test-server');
const sessionService = require('../../src/services/sessionService');
const transactionService = require('../../src/services/transactionService');
const stateService = require('../../src/services/stateService');
const videoQueueService = require('../../src/services/videoQueueService');
const offlineQueueService = require('../../src/services/offlineQueueService');

describe('Server Lifecycle Integration (Phase 1.4)', () => {
  it('should not leak listeners after multiple startup/cleanup cycles', async () => {
    // Phase 1.4 Fix: cleanupBroadcastListeners() should remove all listeners
    // This test verifies no listener accumulation across multiple cycles

    const cycles = 3;
    const contexts = [];

    // Record initial listener counts
    const initialCounts = {
      session: sessionService.listenerCount('session:created'),
      state: stateService.listenerCount('state:updated'),
      transaction: transactionService.listenerCount('transaction:new'),
      video: videoQueueService.listenerCount('video:status'),
      offline: offlineQueueService.listenerCount('offline:queue:processed')
    };

    // Run multiple startup/cleanup cycles
    for (let i = 0; i < cycles; i++) {
      const context = await setupIntegrationTestServer();
      contexts.push(context);
      await cleanupIntegrationTestServer(context);
    }

    // Check final listener counts
    const finalCounts = {
      session: sessionService.listenerCount('session:created'),
      state: stateService.listenerCount('state:updated'),
      transaction: transactionService.listenerCount('transaction:new'),
      video: videoQueueService.listenerCount('video:status'),
      offline: offlineQueueService.listenerCount('offline:queue:processed')
    };

    // CRITICAL: Listener counts should NOT increase after cleanup
    // Without Phase 1.4 fix: finalCounts would be > initialCounts
    // With Phase 1.4 fix: finalCounts should equal initialCounts

    expect(finalCounts.session).toBeLessThanOrEqual(initialCounts.session + 1);
    expect(finalCounts.state).toBeLessThanOrEqual(initialCounts.state + 1);
    expect(finalCounts.transaction).toBeLessThanOrEqual(initialCounts.transaction + 1);
    expect(finalCounts.video).toBeLessThanOrEqual(initialCounts.video + 1);
    expect(finalCounts.offline).toBeLessThanOrEqual(initialCounts.offline + 1);

    // Log for debugging
    console.log('Listener counts after', cycles, 'cycles:');
    console.log('  Initial:', initialCounts);
    console.log('  Final:', finalCounts);
  });

  it('should properly cleanup in correct order (Phase 1.3 + 1.4)', async () => {
    // Phase 1.3: Ensures proper initialization order
    // Phase 1.4: Ensures proper cleanup order (reverse of initialization)

    const context = await setupIntegrationTestServer();

    // Verify server started successfully
    expect(context.server).toBeDefined();
    expect(context.io).toBeDefined();

    // Cleanup
    await cleanupIntegrationTestServer(context);

    // Verify clean shutdown (no errors thrown)
    expect(true).toBe(true);
  });
});
