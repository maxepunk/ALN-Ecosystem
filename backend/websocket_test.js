#!/usr/bin/env node

/**
 * WebSocket Connectivity Test for ALN Orchestrator
 * Tests WebSocket connection, message handling, and session management
 */

const io = require('socket.io-client');

const SOCKET_URL = 'http://localhost:3000';
const TEST_TIMEOUT = 10000;

async function testWebSocketConnection() {
  console.log('🔌 Testing WebSocket Connectivity...\n');

  return new Promise((resolve, reject) => {
    const socket = io(SOCKET_URL, {
      forceNew: true,
      transports: ['websocket'],
    });

    const results = {
      connected: false,
      events: [],
      errors: [],
    };

    // Set timeout
    const timeout = setTimeout(() => {
      socket.disconnect();
      reject(new Error('WebSocket test timed out'));
    }, TEST_TIMEOUT);

    // Connection successful
    socket.on('connect', () => {
      console.log('✅ WebSocket connected successfully');
      results.connected = true;
      results.events.push('connect');
      
      // Register as a device
      socket.emit('device:register', {
        deviceId: 'TEST_DEVICE_001',
        deviceType: 'scanner',
        location: 'Integration Test',
      });
    });

    // Device registration response
    socket.on('device:registered', (data) => {
      console.log('✅ Device registered:', data);
      results.events.push('device:registered');
    });

    // State updates
    socket.on('state:update', (data) => {
      console.log('✅ Received state update');
      results.events.push('state:update');
    });

    // Test transaction events
    socket.on('transaction:new', (data) => {
      console.log('✅ Received transaction event:', data.transactionId);
      results.events.push('transaction:new');
    });

    // Video status events
    socket.on('video:status', (data) => {
      console.log('✅ Received video status:', data.status);
      results.events.push('video:status');
    });

    // Error handling
    socket.on('connect_error', (error) => {
      console.log('❌ Connection error:', error.message);
      results.errors.push(error.message);
    });

    socket.on('disconnect', (reason) => {
      console.log('🔌 Disconnected:', reason);
      results.events.push('disconnect');
      
      clearTimeout(timeout);
      resolve(results);
    });

    // After 3 seconds, emit a test scan to trigger events
    setTimeout(() => {
      console.log('📡 Emitting test scan...');
      socket.emit('scan:request', {
        tokenId: 'MEM_001',
        teamId: 'TEAM_A',
        scannerId: 'TEST_DEVICE_001',
      });
    }, 1000);

    // Disconnect after 5 seconds
    setTimeout(() => {
      socket.disconnect();
    }, 5000);
  });
}

async function runWebSocketTests() {
  try {
    const results = await testWebSocketConnection();
    
    console.log('\n📊 WebSocket Test Results:');
    console.log('='.repeat(40));
    console.log(`Connection: ${results.connected ? '✅ SUCCESS' : '❌ FAILED'}`);
    console.log(`Events received: ${results.events.length}`);
    console.log(`Errors: ${results.errors.length}`);
    
    if (results.events.length > 0) {
      console.log('\n📝 Events received:');
      results.events.forEach(event => console.log(`  - ${event}`));
    }
    
    if (results.errors.length > 0) {
      console.log('\n❌ Errors:');
      results.errors.forEach(error => console.log(`  - ${error}`));
    }
    
    const success = results.connected && results.errors.length === 0;
    console.log(`\n${success ? '✅ WebSocket tests PASSED' : '❌ WebSocket tests FAILED'}`);
    
    process.exit(success ? 0 : 1);
    
  } catch (error) {
    console.error('❌ WebSocket test failed:', error.message);
    process.exit(1);
  }
}

runWebSocketTests();