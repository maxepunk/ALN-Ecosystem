/**
 * Debug score update events
 */

const io = require('socket.io-client');
const fetch = require('node-fetch');

const ORCHESTRATOR_URL = 'http://localhost:3000';
const GM_PASSWORD = 'test-admin-password';

async function testScoreDebug() {
  console.log('\n=== Debugging Score Updates ===\n');

  try {
    // 1. Authenticate
    const authResponse = await fetch(`${ORCHESTRATOR_URL}/api/admin/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: GM_PASSWORD })
    });

    const { token } = await authResponse.json();
    console.log('✅ Got token');

    // 2. Connect socket with full logging
    const socket = io(ORCHESTRATOR_URL, {
      auth: {
        token,
        stationId: 'DEBUG_STATION',
        deviceType: 'gm',
        version: '1.0.0'
      }
    });

    // Track all events
    let eventsReceived = [];

    socket.onAny((event, ...args) => {
      console.log(`📨 Event received: ${event}`);
      eventsReceived.push(event);
      if (event === 'score:updated') {
        console.log('  Score data:', JSON.stringify(args[0], null, 2));
      }
    });

    socket.on('connect', () => {
      console.log('✅ Connected');
    });

    socket.on('error', (error) => {
      console.log('❌ Socket error:', error);
    });

    socket.on('transaction:result', (data) => {
      console.log('📊 Transaction result:', JSON.stringify(data, null, 2));
    });

    socket.on('state:update', (data) => {
      console.log('📊 State update received');
    });

    // Wait for identification
    await new Promise(resolve => {
      socket.on('gm:identified', (data) => {
        console.log('✅ Identified as GM station');
        resolve();
      });
    });

    // 3. Submit transaction and capture result
    console.log('\n📤 Submitting VALID transaction (534e2b03 token)...');

    // Use a known valid token that exists in the system
    socket.emit('transaction:submit', {
      tokenId: '534e2b03',
      teamId: 'FIX_TEST_TEAM',
      scannerId: 'DEBUG_SCANNER'
    });

    // Wait longer to see all events
    console.log('\n⏳ Waiting 5 seconds for events...');
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Results
    console.log('\n=== Debug Results ===');
    console.log('All events received:', eventsReceived.join(', '));
    console.log(`Score updates: ${eventsReceived.includes('score:updated') ? '✅ RECEIVED' : '❌ NOT RECEIVED'}`);

    // Check server state via HTTP
    console.log('\n📊 Checking server state...');
    const stateResponse = await fetch(`${ORCHESTRATOR_URL}/api/state/status`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const state = await stateResponse.json();

    console.log('Server scores:', state.data?.scores?.map(s => ({
      team: s.teamId,
      score: s.currentScore,
      tokens: s.tokensScanned
    })));

    socket.disconnect();

  } catch (error) {
    console.error('Test failed:', error);
  }
}

fetch(`${ORCHESTRATOR_URL}/api/state/status`)
  .then(() => testScoreDebug())
  .catch(() => {
    console.log('Server not running');
    process.exit(1);
  });