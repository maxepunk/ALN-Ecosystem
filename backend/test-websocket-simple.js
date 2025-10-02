#!/usr/bin/env node
/**
 * Simple WebSocket test to debug gm:identified issue
 */

const io = require('socket.io-client');
const fetch = require('node-fetch');
const BASE_URL = 'http://localhost:3000';

async function test() {
    console.log('1. Authenticating...');
    const authRes = await fetch(`${BASE_URL}/api/admin/auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: 'test-admin-password' })
    });
    const authResult = await authRes.json();
    console.log('   Auth response:', authResult);

    if (!authResult.token) {
        console.error('   ❌ No token received');
        return;
    }

    console.log('\n2. Connecting with token in handshake...');
    const socket = io(BASE_URL, {
        auth: {
            token: authResult.token,
            stationId: 'TEST_GM',
            deviceType: 'gm',
            version: '1.0.0'
        }
    });

    // Listen to ALL events
    socket.onAny((eventName, ...args) => {
        console.log(`   📨 Event: ${eventName}`, args);
    });

    socket.on('connect', () => {
        console.log('   ✅ Connected, socket ID:', socket.id);

        // Try submitting a transaction after 1 second
        setTimeout(() => {
            console.log('\n3. Submitting test transaction...');
            socket.emit('transaction:submit', {
                tokenId: 'TEST_TOKEN',
                teamId: 'TEAM_A',
                scannerId: 'TEST_GM',
                stationMode: 'blackmarket'
            });
        }, 1000);
    });

    socket.on('connect_error', (error) => {
        console.log('   ❌ Connection error:', error.message);
    });

    // Exit after 5 seconds
    setTimeout(() => {
        console.log('\n4. Test complete, disconnecting...');
        socket.disconnect();
        process.exit(0);
    }, 5000);
}

test().catch(console.error);