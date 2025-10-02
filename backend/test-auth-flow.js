/**
 * Test script to verify authentication flow
 */

const io = require('socket.io-client');
const fetch = require('node-fetch');

const ORCHESTRATOR_URL = 'http://localhost:3000';
const GM_PASSWORD = 'test-admin-password';

async function testAuthFlow() {
  console.log('\n=== Testing Authentication Flow ===\n');

  try {
    // 1. First authenticate to get token
    console.log('1. Authenticating with backend...');
    const authResponse = await fetch(`${ORCHESTRATOR_URL}/api/admin/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: GM_PASSWORD })
    });

    if (!authResponse.ok) {
      throw new Error(`Auth failed: ${authResponse.status}`);
    }

    const { token } = await authResponse.json();
    console.log('✅ Got token:', token.substring(0, 20) + '...');

    // 2. Connect with token in handshake
    console.log('\n2. Connecting WebSocket with token in handshake...');
    const socket = io(ORCHESTRATOR_URL, {
      auth: {
        token,
        stationId: 'TEST_STATION_1',
        deviceType: 'gm',
        version: '1.0.0'
      }
    });

    // 3. Listen for events
    let receivedIdentified = false;
    let receivedError = false;

    socket.on('connect', () => {
      console.log('✅ WebSocket connected, socketId:', socket.id);
    });

    socket.on('gm:identified', (data) => {
      console.log('✅ Received gm:identified event:', JSON.stringify(data, null, 2));
      receivedIdentified = true;

      // Check if we got sessionId
      if (data.sessionId) {
        console.log('✅ Got sessionId:', data.sessionId);
      } else {
        console.log('❌ No sessionId in gm:identified response!');
      }
    });

    socket.on('error', (error) => {
      console.log('❌ Socket error:', error);
      receivedError = true;
    });

    socket.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason);
    });

    // 4. Wait and check results
    await new Promise(resolve => setTimeout(resolve, 2000));

    console.log('\n=== Test Results ===');
    if (receivedIdentified) {
      console.log('✅ Authentication flow WORKING - received gm:identified');
    } else if (receivedError) {
      console.log('❌ Authentication failed - received error');
    } else {
      console.log('❌ Authentication flow BROKEN - no gm:identified received');
    }

    // Cleanup
    socket.disconnect();
    process.exit(receivedIdentified ? 0 : 1);

  } catch (error) {
    console.error('Test failed:', error.message);
    process.exit(1);
  }
}

// Check if server is running first
fetch(`${ORCHESTRATOR_URL}/api/state/status`)
  .then(() => {
    console.log('Server is running, starting test...');
    testAuthFlow();
  })
  .catch(() => {
    console.log('Server not running. Starting server first...');
    console.log('Please run: npm run dev:no-video');
    process.exit(1);
  });