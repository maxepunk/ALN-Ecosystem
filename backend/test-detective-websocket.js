#!/usr/bin/env node
/**
 * WebSocket test for Detective mode - tests ACTUAL GM scanner flow
 */

const io = require('socket.io-client');
const fetch = require('node-fetch');
const BASE_URL = 'http://localhost:3000';

async function authenticate() {
    const response = await fetch(`${BASE_URL}/api/admin/auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: 'test-admin-password' })
    });
    const { token } = await response.json();
    return token;
}

async function getGameState(token) {
    const response = await fetch(`${BASE_URL}/api/state`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    return response.json();
}

async function runTest() {
    console.log('🧪 Testing Detective Mode via WebSocket (Real GM Scanner Flow)...\n');

    try {
        // 1. Authenticate to get token
        console.log('1. Authenticating...');
        const token = await authenticate();
        console.log('   ✅ Got auth token\n');

        // 2. Connect via WebSocket with auth in handshake (like GM scanner does)
        console.log('2. Connecting via WebSocket with auth handshake...');
        const socket = io(BASE_URL, {
            auth: {
                token,
                stationId: 'TEST_GM_STATION',
                deviceType: 'gm',
                version: '1.0.0'
            }
        });

        // Set up gm:identified listener BEFORE connection
        const sessionPromise = new Promise((resolve) => {
            socket.on('gm:identified', (data) => {
                console.log('   ✅ Identified with session:', data.sessionId, '\n');
                resolve(data.sessionId);
            });
        });

        await new Promise((resolve, reject) => {
            socket.on('connect', () => {
                console.log('   ✅ WebSocket connected\n');
                resolve();
            });
            socket.on('connect_error', (error) => {
                reject(error);
            });
            setTimeout(() => reject(new Error('Connection timeout')), 5000);
        });

        // 3. Wait for gm:identified event (confirms session)
        console.log('3. Waiting for identification...');
        const sessionId = await Promise.race([
            sessionPromise,
            new Promise((resolve) => setTimeout(() => {
                console.log('   ⚠️  No gm:identified received after 2 seconds');
                console.log('   Continuing without sessionId...\n');
                resolve(null);
            }, 2000))
        ]);

        // 4. Submit Black Market transaction for Team A
        console.log('4. Submitting Black Market transaction for Team A...');
        socket.emit('transaction:submit', {
            tokenId: '534e2b02',  // Real token ID from database
            teamId: 'TEAM_A',
            scannerId: 'TEST_GM_STATION',
            stationMode: 'blackmarket',
            timestamp: new Date().toISOString()
        });

        // Wait for transaction result
        await new Promise((resolve) => {
            socket.once('transaction:result', (result) => {
                console.log('   Result:', result.message);
                console.log('   Points:', result.points || 0, '\n');
                resolve();
            });
        });

        // 5. Submit Detective transaction for Team B
        console.log('5. Submitting Detective transaction for Team B...');
        socket.emit('transaction:submit', {
            tokenId: 'hos001',  // Different token to avoid duplicate
            teamId: 'TEAM_B',
            scannerId: 'TEST_GM_STATION',
            stationMode: 'detective',
            timestamp: new Date().toISOString()
        });

        // Wait for transaction result
        await new Promise((resolve) => {
            socket.once('transaction:result', (result) => {
                console.log('   Result:', result.message);
                console.log('   Points:', result.points || 0, '\n');
                resolve();
            });
        });

        // 6. Check final scores
        console.log('6. Checking final scores...');
        const finalState = await getGameState(token);

        const teamAScore = finalState.scores?.find(s => s.teamId === 'TEAM_A');
        const teamBScore = finalState.scores?.find(s => s.teamId === 'TEAM_B');

        console.log('   Team A (Black Market):', teamAScore?.currentScore || 0, 'points');
        console.log('   Team B (Detective):', teamBScore?.currentScore || 0, 'points\n');

        // 7. Verify results
        console.log('📊 Test Results:');
        if (teamAScore && teamAScore.currentScore > 0) {
            console.log('   ✅ Black Market mode correctly adds points');
        } else {
            console.log('   ❌ Black Market mode failed to add points');
        }

        if (!teamBScore || teamBScore.currentScore === 0) {
            console.log('   ✅ Detective mode correctly skips scoring');
        } else {
            console.log('   ❌ Detective mode incorrectly added points');
        }

        // 8. Test Team C can scan a new token successfully
        console.log('\n7. Testing Team C with a new token...');
        socket.emit('transaction:submit', {
            tokenId: 'tac001',  // New token for Team C
            teamId: 'TEAM_C',
            scannerId: 'TEST_GM_STATION',
            stationMode: 'detective',
            timestamp: new Date().toISOString()
        });

        await new Promise((resolve) => {
            socket.once('transaction:result', (result) => {
                console.log('   Result:', result.message);
                console.log('   Status:', result.status);
                resolve();
            });
        });

        // 9. Now test duplicate detection - Team D tries to scan Team B's token
        console.log('\n8. Testing duplicate detection (Team D tries Team B\'s token)...');
        socket.emit('transaction:submit', {
            tokenId: 'hos001',  // Same token as Team B - should be duplicate
            teamId: 'TEAM_D',
            scannerId: 'TEST_GM_STATION',
            stationMode: 'detective',
            timestamp: new Date().toISOString()
        });

        await new Promise((resolve) => {
            socket.once('transaction:result', (result) => {
                console.log('   Result:', result.message);
                if (result.status === 'duplicate' || result.message?.includes('already claimed')) {
                    console.log('   ✅ Detective mode respects duplicate detection');
                } else {
                    console.log('   ❌ Detective mode duplicate detection failed');
                }
                resolve();
            });
        });

        // Disconnect
        socket.disconnect();
        process.exit(0);

    } catch (error) {
        console.error('❌ Test failed:', error.message);
        process.exit(1);
    }
}

// Check if server is running
fetch(`${BASE_URL}/health`)
    .then(() => runTest())
    .catch(() => {
        console.error('❌ Backend server not running. Start it with: cd backend && npm run dev');
        process.exit(1);
    });