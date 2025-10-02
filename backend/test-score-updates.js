/**
 * Test score update events
 */

const io = require('socket.io-client');
const fetch = require('node-fetch');

const ORCHESTRATOR_URL = 'http://localhost:3000';
const GM_PASSWORD = 'test-admin-password';

async function testScoreUpdates() {
  console.log('\n=== Testing Score Update Events ===\n');

  try {
    // 1. Authenticate
    console.log('1. Authenticating...');
    const authResponse = await fetch(`${ORCHESTRATOR_URL}/api/admin/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: GM_PASSWORD })
    });

    const { token } = await authResponse.json();
    console.log('✅ Got token');

    // 2. Connect socket
    console.log('\n2. Connecting WebSocket...');
    const socket = io(ORCHESTRATOR_URL, {
      auth: {
        token,
        stationId: 'TEST_STATION_SCORES',
        deviceType: 'gm',
        version: '1.0.0'
      }
    });

    let scoreUpdateReceived = false;
    let groupCompletionReceived = false;

    socket.on('connect', () => {
      console.log('✅ Connected');
    });

    // Wait for gm:identified to ensure we're in the gm-stations room
    await new Promise(resolve => {
      socket.on('gm:identified', (data) => {
        console.log('✅ Identified as GM station, joined room');
        resolve();
      });
    });

    // Listen for score updates
    socket.on('score:updated', (data) => {
      console.log('\n✅ SCORE UPDATE RECEIVED:', JSON.stringify(data, null, 2));
      scoreUpdateReceived = true;
    });

    // Listen for group completions
    socket.on('group:completed', (data) => {
      console.log('\n✅ GROUP COMPLETION RECEIVED:', JSON.stringify(data, null, 2));
      groupCompletionReceived = true;
    });

    // 3. Submit a transaction via WebSocket
    console.log('\n3. Submitting transaction via WebSocket...');
    socket.emit('transaction:submit', {
      tokenId: 'jaw001',
      teamId: 'TEAM_TEST',
      scannerId: 'TEST_SCANNER'
    });

    // 4. Also test HTTP endpoint
    console.log('\n4. Submitting transaction via HTTP...');
    const scanResponse = await fetch(`${ORCHESTRATOR_URL}/api/scan`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        tokenId: '86ab4259',  // Different token to test
        teamId: 'TEAM_TEST',
        scannerId: 'HTTP_SCANNER'
      })
    });

    const scanResult = await scanResponse.json();
    console.log('Scan result:', scanResult.status);

    // Wait for events
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Results
    console.log('\n=== Test Results ===');
    console.log(`Score Update Events: ${scoreUpdateReceived ? '✅ WORKING' : '❌ NOT RECEIVED'}`);
    console.log(`Group Completion Events: ${groupCompletionReceived ? '✅ WORKING (if group completed)' : '⚠️ Not received (normal if group not complete)'}`);

    socket.disconnect();
    process.exit(scoreUpdateReceived ? 0 : 1);

  } catch (error) {
    console.error('Test failed:', error.message);
    process.exit(1);
  }
}

// Check server and run test
fetch(`${ORCHESTRATOR_URL}/api/state/status`)
  .then(() => {
    console.log('Server running, starting test...');
    testScoreUpdates();
  })
  .catch(() => {
    console.log('Server not running. Please start with: npm run dev:no-video');
    process.exit(1);
  });