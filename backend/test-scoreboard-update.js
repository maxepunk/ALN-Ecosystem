#!/usr/bin/env node
/**
 * Test script to verify scoreboard live updates
 * Simulates score changes and watches for updates
 */

const io = require('socket.io-client');
const fetch = require('node-fetch');

const ORCHESTRATOR_URL = 'http://localhost:3000';
const ADMIN_PASSWORD = '@LN-c0nn3ct';

async function testScoreboardUpdates() {
  console.log('🧪 Testing Scoreboard Live Updates\n');

  // 1. Authenticate
  console.log('1️⃣  Authenticating...');
  const authResponse = await fetch(`${ORCHESTRATOR_URL}/api/admin/auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: ADMIN_PASSWORD }),
  });
  const { token } = await authResponse.json();
  console.log('✅ Authenticated\n');

  // 2. Connect WebSocket as GM (like scoreboard does)
  console.log('2️⃣  Connecting WebSocket as GM...');
  const socket = io(ORCHESTRATOR_URL, {
    auth: {
      token,
      deviceId: 'TEST_SCOREBOARD',
      deviceType: 'gm',
      version: '1.0.0',
    },
  });

  await new Promise((resolve) => socket.on('connect', resolve));
  console.log('✅ Connected to WebSocket\n');

  // 3. Listen for score updates (via transaction:new.teamScore)
  console.log('3️⃣  Listening for transaction:new events (with teamScore)...');
  socket.on('transaction:new', (eventData) => {
    console.log('📊 Received transaction:new event:');
    console.log('Transaction:', JSON.stringify(eventData.data?.transaction, null, 2));
    console.log('Team Score:', JSON.stringify(eventData.data?.teamScore, null, 2));
  });

  // 4. Create a test scan to trigger score update
  console.log('\n4️⃣  Triggering test scan...');
  const scanResponse = await fetch(`${ORCHESTRATOR_URL}/api/scan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tokenId: '534e2b03',
      teamId: '001',
      deviceId: 'TEST_DEVICE',
      mode: 'blackmarket',
    }),
  });
  const scanResult = await scanResponse.json();
  console.log('✅ Scan triggered:', scanResult.status);

  // Wait for event
  console.log('\n⏳ Waiting 3 seconds for transaction:new event...\n');
  await new Promise((resolve) => setTimeout(resolve, 3000));

  socket.disconnect();
  console.log('\n✅ Test complete!');
  process.exit(0);
}

testScoreboardUpdates().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
