/**
 * Test Helper Utility: Service Reset
 *
 * Centralizes service state cleanup for test isolation.
 * Production services are unaware of testing needs - this helper
 * provides clean separation between production and test code.
 *
 * Anti-Pattern Prevention: Removes test-only methods from production services.
 */

const sessionService = require('../../src/services/sessionService');
const transactionService = require('../../src/services/transactionService');
const videoQueueService = require('../../src/services/videoQueueService');
const stateService = require('../../src/services/stateService');
const offlineQueueService = require('../../src/services/offlineQueueService');

// Enable/disable diagnostic logging via environment variable
const ENABLE_LISTENER_DIAGNOSTICS = process.env.LISTENER_DIAGNOSTICS === 'true';

/**
 * Service event definitions for listener leak detection
 * Maps service name to events that should have 0 listeners after reset
 */
const SERVICE_EVENTS = {
  sessionService: [
    'session:created',
    'session:updated',
    'transaction:added',
    'device:updated',
    'device:removed'
  ],
  transactionService: [
    'transaction:accepted',
    'transaction:new',
    'group:completed',
    'score:updated',
    'score:adjusted',  // Slice 2: Admin score adjustments
    'scores:reset',
    'transaction:deleted'
  ],
  stateService: [
    'state:updated',
    'state:sync',
    'state:reset'
  ],
  videoQueueService: [
    'video:queued',
    'video:playing',
    'video:completed',
    'video:skipped',
    'queue:updated'
  ],
  offlineQueueService: [
    'offline:status:changed',
    'offline:queue:updated'
  ]
};

/**
 * Get listener counts for a service across all its events
 * @param {EventEmitter} service - Service instance
 * @param {string} serviceName - Service name for lookup
 * @returns {Object} Event name -> listener count map
 */
function getServiceListenerCounts(service, serviceName) {
  const events = SERVICE_EVENTS[serviceName] || [];
  const counts = {};

  for (const eventName of events) {
    const count = service.listenerCount(eventName);
    if (count > 0) {
      counts[eventName] = count;
    }
  }

  return counts;
}

/**
 * Get total listener count across all events for a service
 * @param {Object} listenerCounts - Event -> count map
 * @returns {number} Total listener count
 */
function getTotalListenerCount(listenerCounts) {
  return Object.values(listenerCounts).reduce((sum, count) => sum + count, 0);
}

/**
 * Check for listener leaks and log diagnostic information
 * @param {Object} beforeCounts - Listener counts before reset
 * @param {Object} afterCounts - Listener counts after reset
 */
function checkForListenerLeaks(beforeCounts, afterCounts) {
  const leaks = [];

  for (const [serviceName, afterEvents] of Object.entries(afterCounts)) {
    const totalAfter = getTotalListenerCount(afterEvents);
    const totalBefore = getTotalListenerCount(beforeCounts[serviceName] || {});

    if (totalAfter > 0) {
      leaks.push({
        service: serviceName,
        totalBefore,
        totalAfter,
        events: afterEvents
      });
    }
  }

  if (leaks.length > 0) {
    console.log('\n⚠️  LISTENER LEAK DETECTED ⚠️');
    console.log('═══════════════════════════════════════════════════════');

    for (const leak of leaks) {
      console.log(`\n${leak.service}:`);
      console.log(`  Before reset: ${leak.totalBefore} listeners`);
      console.log(`  After reset:  ${leak.totalAfter} listeners 🔴`);
      console.log(`  Leaked events:`);
      for (const [event, count] of Object.entries(leak.events)) {
        console.log(`    - ${event}: ${count} listener(s)`);
      }
    }

    console.log('\n═══════════════════════════════════════════════════════');
    console.log('💡 Diagnosis:');
    console.log('  - If listeners remain AFTER reset() → Implementation bug');
    console.log('    (reset() should call removeAllListeners() or cleanup properly)');
    console.log('  - If listeners accumulate across test files → Test isolation bug');
    console.log('    (need to add explicit listener cleanup in test setup)');
    console.log('═══════════════════════════════════════════════════════\n');
  }
}

/**
 * Resets all services that have internal reset methods.
 * Used in test beforeEach() hooks to ensure clean state between tests.
 *
 * @param {Object} options - Reset options
 * @param {boolean} options.diagnostics - Force enable diagnostics (overrides env var)
 * @returns {Promise<void>}
 */
async function resetAllServices(options = {}) {
  const enableDiagnostics = options.diagnostics || ENABLE_LISTENER_DIAGNOSTICS;

  // Capture BEFORE state
  const beforeCounts = {
    sessionService: getServiceListenerCounts(sessionService, 'sessionService'),
    transactionService: getServiceListenerCounts(transactionService, 'transactionService'),
    stateService: getServiceListenerCounts(stateService, 'stateService'),
    videoQueueService: getServiceListenerCounts(videoQueueService, 'videoQueueService'),
    offlineQueueService: getServiceListenerCounts(offlineQueueService, 'offlineQueueService')
  };

  if (enableDiagnostics) {
    const totalBefore = Object.values(beforeCounts)
      .reduce((sum, counts) => sum + getTotalListenerCount(counts), 0);

    if (totalBefore > 0) {
      console.log('\n📊 Listener counts BEFORE reset:');
      for (const [serviceName, counts] of Object.entries(beforeCounts)) {
        const total = getTotalListenerCount(counts);
        if (total > 0) {
          console.log(`  ${serviceName}: ${total} total`);
          for (const [event, count] of Object.entries(counts)) {
            console.log(`    - ${event}: ${count}`);
          }
        }
      }
    }
  }

  // Reset services that have reset methods
  if (typeof sessionService.reset === 'function') {
    await sessionService.reset();
  }
  if (typeof transactionService.reset === 'function') {
    transactionService.reset(); // Synchronous
  }
  if (typeof videoQueueService.reset === 'function') {
    videoQueueService.reset(); // Synchronous
  }
  if (typeof stateService.reset === 'function') {
    await stateService.reset(); // Async
  }
  if (typeof offlineQueueService.reset === 'function') {
    await offlineQueueService.reset(); // Async
  }

  // Re-register cross-service listeners after reset
  // Services that listen to sessionService must re-register (listeners cleared by reset)
  if (typeof stateService.setupTransactionListeners === 'function') {
    stateService.setupTransactionListeners();
  }
  if (typeof transactionService.registerSessionListener === 'function') {
    transactionService.registerSessionListener();
  }

  // Re-register sessionService persistence listeners (Slice 2)
  // These listeners are ON transactionService and were cleared by transactionService.reset()
  if (typeof sessionService.setupPersistenceListeners === 'function') {
    sessionService.setupPersistenceListeners();
  }

  // Capture AFTER state
  const afterCounts = {
    sessionService: getServiceListenerCounts(sessionService, 'sessionService'),
    transactionService: getServiceListenerCounts(transactionService, 'transactionService'),
    stateService: getServiceListenerCounts(stateService, 'stateService'),
    videoQueueService: getServiceListenerCounts(videoQueueService, 'videoQueueService'),
    offlineQueueService: getServiceListenerCounts(offlineQueueService, 'offlineQueueService')
  };

  if (enableDiagnostics) {
    const totalAfter = Object.values(afterCounts)
      .reduce((sum, counts) => sum + getTotalListenerCount(counts), 0);

    if (totalAfter > 0) {
      console.log('\n📊 Listener counts AFTER reset:');
      for (const [serviceName, counts] of Object.entries(afterCounts)) {
        const total = getTotalListenerCount(counts);
        if (total > 0) {
          console.log(`  ${serviceName}: ${total} total 🔴`);
          for (const [event, count] of Object.entries(counts)) {
            console.log(`    - ${event}: ${count}`);
          }
        }
      }
    } else {
      console.log('\n✅ All listeners cleaned up successfully');
    }
  }

  // Check for leaks (always run, even without diagnostics)
  checkForListenerLeaks(beforeCounts, afterCounts);
}

/**
 * Complete reset cycle for integration tests
 * Uses production performSystemReset() for consistency
 *
 * @param {Object} io - Socket.io server instance
 * @param {Object} services - Service instances
 * @param {Object} options - Reset options
 * @param {boolean} options.diagnostics - Force enable diagnostics
 * @returns {Promise<void>}
 */
async function resetAllServicesForTesting(io, services, options = {}) {
  const enableDiagnostics = options.diagnostics || ENABLE_LISTENER_DIAGNOSTICS;

  if (enableDiagnostics) {
    console.log('\n🔄 Starting resetAllServicesForTesting cycle...');
  }

  // Capture BEFORE state for diagnostics
  let beforeCounts = {};
  if (enableDiagnostics) {
    beforeCounts = {
      sessionService: getServiceListenerCounts(sessionService, 'sessionService'),
      transactionService: getServiceListenerCounts(transactionService, 'transactionService'),
      stateService: getServiceListenerCounts(stateService, 'stateService'),
      videoQueueService: getServiceListenerCounts(videoQueueService, 'videoQueueService'),
      offlineQueueService: getServiceListenerCounts(offlineQueueService, 'offlineQueueService')
    };

    const totalBefore = Object.values(beforeCounts)
      .reduce((sum, counts) => sum + getTotalListenerCount(counts), 0);

    if (totalBefore > 0) {
      console.log('\n📊 Listener counts BEFORE reset:');
      for (const [serviceName, counts] of Object.entries(beforeCounts)) {
        const total = getTotalListenerCount(counts);
        if (total > 0) {
          console.log(`  ${serviceName}: ${total} total`);
        }
      }
    }
  }

  // Use production performSystemReset() for consistency
  const { performSystemReset } = require('../../src/services/systemReset');

  // Ensure we have all services
  const fullServices = {
    ...services,
    displayControlService: services.displayControlService || require('../../src/services/displayControlService'),
    vlcService: services.vlcService || require('../../src/services/vlcService')
  };

  await performSystemReset(io, fullServices);

  // Capture AFTER state for diagnostics
  if (enableDiagnostics) {
    const afterCounts = {
      sessionService: getServiceListenerCounts(sessionService, 'sessionService'),
      transactionService: getServiceListenerCounts(transactionService, 'transactionService'),
      stateService: getServiceListenerCounts(stateService, 'stateService'),
      videoQueueService: getServiceListenerCounts(videoQueueService, 'videoQueueService'),
      offlineQueueService: getServiceListenerCounts(offlineQueueService, 'offlineQueueService')
    };

    const totalAfter = Object.values(afterCounts)
      .reduce((sum, counts) => sum + getTotalListenerCount(counts), 0);

    if (totalAfter > 0) {
      console.log('\n📊 Listener counts AFTER reset:');
      for (const [serviceName, counts] of Object.entries(afterCounts)) {
        const total = getTotalListenerCount(counts);
        if (total > 0) {
          console.log(`  ${serviceName}: ${total} total 🔴`);
        }
      }
    } else {
      console.log('\n✅ All listeners cleaned up successfully');
    }

    // Check for leaks
    checkForListenerLeaks(beforeCounts, afterCounts);

    console.log('✅ resetAllServicesForTesting cycle complete\n');
  }
}

/**
 * Log test file entry for diagnostic tracking
 * Call this in beforeAll() to track which test file is running
 * @param {string} testFileName - Name of the test file
 */
function logTestFileEntry(testFileName) {
  if (ENABLE_LISTENER_DIAGNOSTICS) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`🧪 Starting test file: ${testFileName}`);
    console.log(`${'='.repeat(60)}`);
  }
}

/**
 * Log test file exit for diagnostic tracking
 * Call this in afterAll() to track when test file completes
 * @param {string} testFileName - Name of the test file
 */
function logTestFileExit(testFileName) {
  if (ENABLE_LISTENER_DIAGNOSTICS) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`✅ Completed test file: ${testFileName}`);
    console.log(`${'='.repeat(60)}\n`);
  }
}

module.exports = {
  resetAllServices,
  resetAllServicesForTesting,
  getServiceListenerCounts,
  checkForListenerLeaks,
  logTestFileEntry,
  logTestFileExit
};
