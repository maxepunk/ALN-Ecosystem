#!/usr/bin/env node
/**
 * Quick utility to start a new game session
 */

const io = require('socket.io-client');
const axios = require('axios');

const ORCHESTRATOR_URL = process.env.ORCHESTRATOR_URL || 'http://localhost:3000';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

async function startSession() {
  console.log('Starting new ALN session...\n');

  try {
    // Step 1: Authenticate
    console.log('1. Authenticating...');
    const authResponse = await axios.post(`${ORCHESTRATOR_URL}/api/admin/auth`, {
      password: ADMIN_PASSWORD
    });

    const token = authResponse.data.token;
    console.log('✓ Authenticated successfully\n');

    // Step 2: Connect WebSocket
    console.log('2. Connecting to orchestrator...');
    const socket = io(ORCHESTRATOR_URL, {
      auth: {
        token: token,
        deviceId: 'CLI_GM_STATION',
        deviceType: 'gm',
        version: '1.0.0'
      }
    });

    // Handle connection
    socket.on('connect', () => {
      console.log('✓ Connected to orchestrator\n');

      // Step 3: Create session
      console.log('3. Creating session...');
      const sessionData = {
        event: 'gm:command',
        data: {
          action: 'session:create',
          payload: {
            name: `ALN Session - ${new Date().toLocaleDateString()}`,
            teams: ['001', '002', '003']
          }
        },
        timestamp: new Date().toISOString()
      };

      socket.emit('gm:command', sessionData);
    });

    // Handle acknowledgment
    socket.on('gm:command:ack', (response) => {
      console.log('✓ Session created successfully!\n');
      console.log('Response:', JSON.stringify(response, null, 2));

      // Disconnect and exit
      socket.disconnect();
      process.exit(0);
    });

    // Handle errors
    socket.on('connect_error', (error) => {
      console.error('✗ Connection error:', error.message);
      process.exit(1);
    });

    socket.on('error', (error) => {
      console.error('✗ Error:', error);
      socket.disconnect();
      process.exit(1);
    });

    // Timeout after 10 seconds
    setTimeout(() => {
      console.error('✗ Timeout waiting for session creation');
      socket.disconnect();
      process.exit(1);
    }, 10000);

  } catch (error) {
    if (error.response) {
      console.error('✗ Authentication failed:', error.response.data);
    } else {
      console.error('✗ Error:', error.message);
    }
    process.exit(1);
  }
}

startSession();
