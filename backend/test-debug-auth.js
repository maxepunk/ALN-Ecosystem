#!/usr/bin/env node
/**
 * Debug auth flow
 */

const io = require('socket.io-client');
const fetch = require('node-fetch');
const BASE_URL = 'http://localhost:3000';

async function test() {
    console.log('1. Getting token via HTTP...');
    const authRes = await fetch(`${BASE_URL}/api/admin/auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: 'admin123' })
    });
    const { token } = await authRes.json();
    console.log('   Token received:', token?.substring(0, 50) + '...');

    console.log('\n2. Parsing JWT...');
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
    console.log('   JWT payload:', JSON.stringify(payload, null, 2));

    console.log('\n3. Connecting WebSocket with token...');
    const socket = io(BASE_URL, {
        auth: {
            token,
            stationId: 'TEST_STATION',
            deviceType: 'gm',
            version: '1.0.0'
        }
    });

    socket.on('connect', () => {
        console.log('   Connected!');
    });

    socket.on('error', (error) => {
        console.log('   Error:', error);
    });

    socket.on('gm:identified', (data) => {
        console.log('   ✅ Got gm:identified:', data);
        socket.disconnect();
        process.exit(0);
    });

    setTimeout(() => {
        console.log('   ❌ No gm:identified received');
        socket.disconnect();
        process.exit(1);
    }, 5000);
}

test();