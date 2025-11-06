// Quick test to debug sync:full event timing
const { setupIntegrationTestServer, cleanupIntegrationTestServer } = require('./tests/helpers/integration-test-server');
const { connectAndIdentify, waitForEvent } = require('./tests/helpers/websocket-helpers');
const sessionService = require('./src/services/sessionService');

(async () => {
  console.log('=== Testing sync:full Event Reception ===');

  const testContext = await setupIntegrationTestServer();
  console.log('Test server started');

  await sessionService.createSession({
    name: 'Debug Test',
    teams: ['001']
  });
  console.log('Session created');

  // Register listener BEFORE connecting
  console.log('Creating socket with pre-registered listener...');
  const io = require('socket.io-client');
  const { generateAdminToken } = require('./src/middleware/auth');
  const token = generateAdminToken('test-admin');

  const socket = io(testContext.socketUrl, {
    transports: ['websocket'],
    reconnection: false,
    auth: {
      token,
      deviceId: 'DEBUG_GM',
      deviceType: 'gm',
      version: '1.0.0'
    }
  });

  let receivedEvents = [];

  // Register ALL event listeners BEFORE connecting
  socket.onAny((eventName, data) => {
    console.log(`[CLIENT] Received event: ${eventName}`, JSON.stringify(data).substring(0, 100));
    receivedEvents.push({ eventName, data, timestamp: Date.now() });
  });

  console.log('Waiting for connection...');
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Connect timeout')), 5000);
    socket.once('connect', () => {
      console.log('[CLIENT] Connected!');
      clearTimeout(timeout);
      resolve();
    });
    socket.once('connect_error', (err) => {
      console.error('[CLIENT] Connect error:', err.message);
      clearTimeout(timeout);
      reject(err);
    });
  });

  // Wait a bit for sync:full
  await new Promise(resolve => setTimeout(resolve, 1000));

  console.log('\n=== Events Received ===');
  receivedEvents.forEach(e => {
    console.log(`- ${e.eventName} at ${e.timestamp}`);
  });

  const syncFull = receivedEvents.find(e => e.eventName === 'sync:full');
  if (syncFull) {
    console.log('\n✅ sync:full received!');
    console.log('   deviceScannedTokens:', syncFull.data?.data?.deviceScannedTokens);
  } else {
    console.log('\n❌ sync:full NOT received!');
  }

  socket.disconnect();
  await cleanupIntegrationTestServer(testContext);
  console.log('\nTest complete');
  process.exit(syncFull ? 0 : 1);
})().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
